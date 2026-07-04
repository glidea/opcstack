---
title: 部署
description: 部署架构总览和外部依赖
group: 指南
order: 7
---

# 部署

OPC Stack 的运行时部署单元只有一个：Cloudflare Worker。这个 Worker 承载 Web SSR、JSON API、认证、支付 webhook、定时任务、队列消费者、静态资源和 Cloudflare bindings。Chrome extension 是单独打包的产物，运行时访问同一个线上 origin。

## 运行时总览

```mermaid
flowchart TB
  subgraph Clients["客户端"]
    Browser["浏览器 Web 应用"]
    Extension["Chrome extension"]
  end

  subgraph Edge["Cloudflare edge"]
    DNS["DNS zones<br/>APP_DOMAIN / APP_CN_DOMAIN"]
    Routes["Worker routes<br/>TLS 和请求路由"]
    Turnstile["Turnstile<br/>机器人挑战"]
  end

  subgraph Worker["单个 Cloudflare Worker"]
    Entry["Worker 入口"]
    Web["Web SSR<br/>静态资源"]
    API["JSON API<br/>认证会话"]
    Webhooks["支付 webhooks"]
    Cron["定时任务"]
    Consumers["队列消费者"]
  end

  subgraph Data["Cloudflare 数据平面"]
    Meta["D1 Meta DB<br/>全局状态"]
    Shards["D1 Tenant Shards<br/>用户数据"]
    R2["R2 bucket<br/>对象和媒体"]
    KV["KV namespace<br/>轻量状态"]
    Queues["Queues<br/>异步任务"]
    DO["Durable Objects<br/>可选协调"]
  end

  subgraph SaaS["外部 SaaS 依赖"]
    OAuth["Google / GitHub / LinuxDO<br/>OAuth 登录"]
    Email["Resend 或 Cloudflare Email<br/>事务邮件"]
    Payment["Dodo / Creem<br/>收银台和 webhooks"]
    AI["OpenAI / Gemini / SeedDream / Aliyun / Doubao / SeedDance<br/>AI 能力"]
  end

  Browser --> DNS
  Extension --> DNS
  DNS --> Routes
  Routes --> Entry

  Entry --> Web
  Entry --> API
  Entry --> Webhooks
  Entry --> Cron
  Entry --> Consumers

  API --> Turnstile
  API <--> Meta
  API <--> Shards
  API <--> R2
  API <--> KV
  API --> Queues
  API --> DO

  Cron --> Meta
  Cron --> Shards
  Consumers --> Shards
  Consumers --> R2
  Queues --> Consumers

  API <--> OAuth
  API --> Email
  API --> Payment
  Payment --> Webhooks
  API --> AI
  Consumers --> AI
```

核心边界很简单：用户流量先进入 Cloudflare routes，再由一个 Worker 判断这是 Web、API、webhook、cron 还是 queue work。持久产品状态在 D1。二进制状态在 R2。外部 SaaS 是集成依赖，不是部署单元。

## 数据归属

```mermaid
flowchart LR
  subgraph D1["D1 databases"]
    Meta["Meta DB<br/>认证相关全局状态<br/>shard registry<br/>支付<br/>订阅<br/>通知"]
    ShardA["Tenant shard A<br/>credit ledger<br/>feedback<br/>AI task state"]
    ShardB["Tenant shard B<br/>同一套 schema<br/>不同用户"]
  end

  subgraph ObjectStore["对象存储"]
    R2Public["R2 public / tmp public<br/>可缓存读取"]
    R2Private["R2 private / tmp private<br/>Worker 代理读取"]
  end

  subgraph Async["异步执行"]
    Queue["Queue message<br/>task id + user id"]
    Consumer["Worker queue consumer"]
  end

  Meta --> ShardA
  Meta --> ShardB
  Queue --> Consumer
  Consumer --> ShardA
  Consumer --> ShardB
  Consumer --> R2Public
  Consumer --> R2Private
```

Meta DB 是跨库流程的事实来源。Tenant shard 写入是幂等副作用。D1 没有跨库事务，所以架构使用可恢复状态，不假装存在原子性。

## 部署控制面

```mermaid
flowchart TB
  Operator["开发者或 CI"] --> Env["公开 env<br/>.env.prod"]
  Operator --> Secrets["密钥 env<br/>.env.secret.prod 或 CI secrets"]
  Operator --> Token["Cloudflare API token"]

  Env --> Deploy["pnpm deploy:cloudflare"]
  Secrets --> Deploy
  Token --> Deploy

  Deploy --> Prepare["prepare-cloudflare prod"]
  Prepare --> CFAPI["Cloudflare API"]

  CFAPI --> Routes["Worker routes"]
  CFAPI --> D1["Meta DB<br/>Tenant shard DBs<br/>migrations"]
  CFAPI --> Storage["R2 bucket<br/>CORS<br/>tmp lifecycle"]
  CFAPI --> Bindings["KV<br/>Queues<br/>Cron<br/>Durable Objects<br/>Email binding"]
  CFAPI --> Security["Turnstile<br/>Image Transformations"]

  Prepare --> Generated["生成产物<br/>wrangler.jsonc<br/>client config<br/>runtime secrets file"]
  Generated --> Types["wrangler types"]
  Types --> Build["vite build"]
  Build --> Upload["wrangler deploy"]
  Upload --> Runtime["Cloudflare Worker runtime"]
```

资源创建集中在 `prepare-cloudflare`。不要把手工创建的 Cloudflare 资源当成架构。如果资源属于产品运行时，它应该能从配置表达出来，并进入 Worker 部署产物。

## 外部依赖地图

```mermaid
flowchart LR
  subgraph Required["部署必需"]
    CF["Cloudflare account"]
    Zone["Cloudflare DNS zone"]
    Token["Cloudflare API token"]
    Node["Node + pnpm 构建环境"]
  end

  subgraph Optional["启用功能时必需"]
    Turnstile["Turnstile"]
    Resend["Resend"]
    CFEmail["Cloudflare Email"]
    OAuth["Google / GitHub / LinuxDO OAuth apps"]
    Pay["Dodo / Creem accounts"]
    AI["AI provider accounts"]
  end

  Required --> Runtime["Worker deployment"]
  Optional --> Runtime
```

回调 URL 和 DNS 记录属于外部系统：OAuth callback 使用线上 API origin，支付 webhook 回调 Worker，邮件服务商需要验证发信域名记录。`APP_CN_DOMAIN` 会添加第二个 Worker custom domain。`APP_CN_CNAME_TARGET` 可选创建或更新一条未代理的 CNAME，但优选目标必须来自你自己的网络决策。
