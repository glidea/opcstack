# OPCStack

让 OPC 开发更快，成本更低，生产可用

OPCStack 是给 One Person Company 准备的 Cloudflare-native AI SaaS 模板。内置认证、支付、积分、D1 Sharding、R2、KV、Queues、Cron、AI 任务、部署自动化和测试体系

---

## 开发更快

多数模板只给你页面、登录和几个示例接口，剩下的活还是得自己从零搭

真正拖慢开发的，往往不是 AI 写不出代码，而是缺一套稳定的工程底座。OPCStack 按 Harness Engineering 思路，把需求、上下文、约束、反馈、测试和部署收束成可重复执行的系统：底座和验收方式固定下来，AI 只需在稳定骨架里持续改业务，不用每次都从登录、支付、存储、队列和部署重新开始

| 模块       | 已内置能力                                                                             |
| ---------- | -------------------------------------------------------------------------------------- |
| Web / API  | Cloudflare Workers，SvelteKit，Hono API，静态页面预渲染                                |
| 数据库     | Cloudflare D1，Drizzle，用户数据分片，读副本，自动 migration                           |
| 文件存储   | Cloudflare R2，公开文件，私有文件，临时文件，浏览器直传，图片变体                      |
| 异步任务   | Cloudflare Queues，Cron 定时任务，Durable Objects                                      |
| 账号系统   | Better Auth，邮箱登录，Google，GitHub，LinuxDO，Turnstile，内测码                      |
| 积分系统   | 积分钱包，积分流水，注册赠送，每日签到，邀请奖励，兑换码，过期清理                     |
| 支付订阅   | Dodo，Creem，一次性积分包，订阅，Webhook，退款扣回                                     |
| 运营功能   | 用户反馈，系统通知，全局公告，定向通知，通知已读                                       |
| AI 能力    | OpenAI，Gemini，SeedDream，Aliyun，Doubao，SeedDance，异步任务，R2 结果存储            |
| 前端体验   | Tailwind CSS，shadcn-svelte，共享 UI，中英文 i18n，Web 端                              |
| 浏览器扩展 | Chrome extension，WXT，popup，options，background，content script                      |
| 文档和 SEO | Markdown 文档，sitemap，robots，Open Graph，Twitter Card，JSON-LD                      |
| 部署配置   | Cloudflare 资源创建，环境变量模板，Worker 配置生成，独立 CN 域名自动优选加速，扩展打包 |
| 测试       | TypeScript，Svelte Check，Vitest，BDD helper，E2E，本地和远程测试                      |

这些模块不是孤立 demo，而是围绕真实产品流程组织起来：

```txt
注册 -> 内测码 -> 积分 -> 邀请返利 -> 支付订阅 -> 通知 -> 反馈 -> 管理接口
```

你可以删除不需要的模块，但不用从零把这些基础流程再设计一遍

---

## 选择 Cloudflare，是为了账单不被打爆

One Person Company 不应该把时间花在养服务器、调扩缩容、维护 Kubernetes、对象存储、队列和 CDN 上，应首选免运维，按量付费的 Serverless 平台

Vercel + Supabase 是很多独立开发者的首选，前期上手很顺。但业务一旦跑通，流量、调用、存储、队列和 CDN 成本会一起变成账单问题

Cloudflare 的优势在这里：Workers、D1、R2、KV、Queues、Cron 和 CDN 都在同一套边缘平台里。可以用很低成本跑通注册、使用、付费、异步任务和文件存储

公开讨论里有类似迁移案例：同一个前端应用在 Vercel 的月账单从不到 $100 涨到 $800 以上，迁到 Cloudflare Workers 后同等流量预计低于 $20，Lighthouse 分数还提高了：[Is anyone else frustrated with Vercel pricing once you scale?](https://www.reddit.com/r/nextjs/comments/1qnld0e/is_anyone_else_frustrated_with_vercel_pricing/)

免费额度足够跑通 MVP，用量上来后 Workers Paid Plan 每月 $5 起，按量付费。下面是 OPCStack 用到的核心产品定价：

| 产品            | 免费额度                                             | Workers Paid Plan（$5/月起）                                                       |
| --------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Workers         | 10 万请求/天，每次调用 10ms CPU                       | 含 1000 万请求/月，超出 $0.30/百万；含 3000 万 CPU 毫秒/月，超出 $0.02/百万毫秒     |
| D1（数据库）    | 读 500 万行/天，写 10 万行/天，存储 5 GB              | 含读 250 亿行/月，超出 $0.001/百万；含写 5000 万行/月，超出 $1/百万；存储 $0.75/GB  |
| R2（文件存储）  | 存储 10 GB，Class A 100 万/月，Class B 1000 万/月     | 存储 $0.015/GB；Class A $4.5/百万；Class B $0.36/百万；出网流量免费                 |
| KV              | 读 10 万/天，写/删/列各 1000/天，存储 1 GB            | 含读 1000 万、写/删/列各 100 万/月；读超出 $0.50/百万，写/删/列超出 $5/百万         |
| Queues（队列）  | 1 万次操作/天                                        | 含 100 万次操作/月，超出 $0.40/百万                                                 |
| Cron 定时任务   | 随 Workers 免费，无额外费用                           | 随 Workers 计费，无额外费用                                                         |
| CDN             | 免费，出网流量不额外计费                              | 免费，出网流量不额外计费                                                            |

R2 出网流量免费是相对 S3 的关键优势，KV、Queues、D1 也都没有 egress 费用。上述为撰写时的公开定价，最新数字以 [Cloudflare 官方文档](https://developers.cloudflare.com/workers/platform/pricing/) 为准

---

## 同样是 Cloudflare 模板，OPCStack 更生产可用

很多 Cloudflare starter 只是把 Workers、D1、R2 接起来，适合演示，不适合直接做 SaaS

OPCStack 多做了这些生产级工作：

- Meta DB 和 Tenant Shard DB 分层，近乎无限的横向拓展
- 新用户自动分配到 active shard
- shard 支持 active / draining 状态
- D1 read replication 和 bookmark 已接入
- 跨 Meta DB + Tenant DB 的流程按 saga 和幂等副作用设计
- R2 路径区分 public、private、tmp public、tmp private
- AI 图片、语音、视频任务走 Queue + Tenant DB + R2
- 本地和生产环境的 Cloudflare 资源自动准备

---

## 快速开始

### 1. 创建你的项目

```bash
git clone https://github.com/glidea/opcstack <your-app-name>
cd <your-app-name>
git remote rename origin upstream
git remote add origin <your-repo-url>
git push -u origin main
pnpm install
```

### 2. 推荐：让 Agent 引导初始化

```text
@AGENTS.md @BOOTSTRAP.md
```

`BOOTSTRAP.md` 负责引导你完成项目初始化。`AGENTS.md` 是开发上下文，后续让 AI 改代码时继续使用

这个路径是推荐路径。README 不重复写完整配置手册，初始化细节应该由 Agent 根据当前环境逐步确认并执行

### 3. 手动启动

```bash
vim .env.dev
cp .env.secret.example .env.secret.dev
vim .env.secret.dev
pnpm dev
```

部署到 Cloudflare：

```bash
pnpm deploy:cloudflare
```

首次远程部署会提示创建 Cloudflare API Token。按命令行链接创建并粘贴一次，后续 token 会缓存在 `.wrangler/cloudflare-api-token`

扩展开发：

```bash
pnpm dev:extension
pnpm build:extension
```

---

## 项目地图

| 文件或目录                       | 职责                                                                    |
| -------------------------------- | ----------------------------------------------------------------------- |
| `AGENTS.md`                      | AI 开发上下文，包含架构、目录、运行时、数据库、R2、队列、前端、测试约定 |
| `BOOTSTRAP.md`                   | 新项目初始化流程，让 Agent 引导配置和启动                               |
| `SYNC_TEMPLATE.md`               | 从上游模板同步更新的流程                                                |
| `scripts/prepare-public.mjs`     | 生成公开前端产物，包括客户端配置、Web logo 和扩展图标                   |
| `scripts/prepare-cloudflare.mjs` | 本地和部署前 Cloudflare 自动化，生成配置、创建资源、应用迁移            |
| `wrangler.jsonc.tpl`             | Cloudflare Worker 配置模板                                              |
| `.env.dev` / `.env.prod`         | 可提交的公开环境配置                                                    |
| `.env.secret.example`            | 密钥配置模板                                                            |
| `src/api-contract/`              | API 请求、响应、schema 和共享类型                                       |
| `src/frontend/lib/`              | 多端共享前端层，复用 UI、i18n、配置和客户端逻辑                         |
| `src/frontend/web/`              | Web 端入口，SvelteKit 页面、路由、静态资源和 Web shell                  |
| `src/frontend/extension/`        | Chrome extension 端入口，popup、options、background 和 content script   |
| `src/backend/api/`               | Hono API、认证、middleware、业务接口                                    |
| `src/backend/db/`                | Drizzle schema 和 D1 migration                                          |
| `src/backend/r2/`                | R2 上传、读取、签名、图片变体                                           |
| `src/backend/ai/`                | Chat、Image、TTS、Realtime、Video provider                              |
| `src/backend/payment/`           | Dodo、Creem 支付和订阅逻辑                                              |
| `src/backend/credits/`           | 积分钱包、流水、发放、扣减、过期                                        |
| `src/backend/consumers/`         | Cloudflare Queue 消费者                                                 |
| `src/backend/jobs/`              | Cron 定时任务                                                           |
| `src/backend/do/`                | Durable Object                                                          |
| `public-docs/`                   | 用户可见产品文档                                                        |
| `template-docs/`                 | 模板开发说明文档                                                        |
| `e2e/`                           | E2E 测试                                                                |

---

## 路线图

### 运营和运维

- [ ] 统一的运营运维管理后台
- [ ] 基于 Cloudflare Analytics 的指标监控和告警

### 支付和计费

- [ ] 支持支付宝
- [ ] 支持 ZPay、启润支付等低门槛支付渠道
- [ ] 支持余额订阅
- [ ] 完善支付渠道路由和商品配置

### 稳定性和用量控制

- [ ] 统一限流
- [ ] 用户级 quota
- [ ] API、AI 任务、存储、积分消费的用量控制

### Agent Runtime

- [ ] 支持大规模多租 agent runtime
- [ ] 集成长期记忆
- [ ] 集成 skill 系统
- [ ] 集成工具调用和运行时隔离

### 多端支持

- [ ] 支持移动端
- [ ] 支持桌面端
