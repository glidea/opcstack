# OPCStack

> Cloudflare-native SaaS infrastructure starter

OPCStack 帮你在 Cloudflare 上快速构建可上线、可变现、低成本运行的 SaaS 或 AI 产品

它不是只有页面和登录的模板，而是一套已经打通 Cloudflare 基础设施、SaaS 业务模块、部署自动化和测试体系的产品骨架

---

## 核心卖点

### 让 Vibe Coding 专注业务

AI 很适合写业务页面、表单、局部逻辑和具体产品能力，但不适合反复手搓这些容易写烂的底层模块

OPCStack 已经内置：

- 认证、邮箱验证、OAuth、Turnstile
- D1 Meta DB + Tenant Shard DB
- R2 公私文件、临时文件、浏览器直传、图片变体
- Queues、Cron、Durable Objects
- 积分钱包、流水、兑换码、每日签到、邀请奖励
- 支付、订阅、Webhook、退款扣回
- 通知、反馈、文档、i18n、SEO、E2E 测试
- Cloudflare 资源创建、配置生成、migration、部署脚本

你应该让 AI 写产品差异化部分，而不是让它每天重新造登录、支付、存储、队列和部署胶水

### 开箱即用的商业闭环

OPCStack 已经覆盖早期 SaaS 的最小闭环：

```text
注册 -> 内测码 -> 积分 -> 邀请返利 -> 支付订阅 -> 通知 -> 反馈 -> 管理接口
```

这比普通 boilerplate 更接近真实产品。你可以删除不需要的模块，但不用从零设计这些基础流程

### 低成本、低运维、边缘部署

**Cloudflare 免费额度很适合早期 SaaS**

| 产品 | 免费额度 |
| --- | --- |
| Workers | 每天 100,000 请求 |
| D1 | 每天 5,000,000 rows read + 100,000 rows written，账号总存储 5GB |
| R2 | 每月 10GB 存储，1,000,000 Class A 操作，10,000,000 Class B 操作 |
| KV | 每天 100,000 次读取，1,000 次写入，1,000 次删除，1,000 次 list，1GB 存储 |
| Queues | 每天 10,000 次标准操作 |

低成本不是唯一重点。更重要的是少维护一整套传统后端基础设施：

- 不用维护服务器
- 不用 Kubernetes
- 不用单独部署 API 服务
- 不用单独买对象存储
- 不用单独维护队列服务
- 不用自己拼 CDN 和边缘缓存

小产品可以先落在免费额度里，大项目也能把账单控制在更可预测的范围

### 生产级数据和任务架构

OPCStack 不是把所有数据塞进一个数据库表里糊弄过去

- Meta DB 存全局状态
- Tenant Shard DB 存用户运行时数据
- 新用户自动分配到 active shard
- shard 支持 active / draining 状态
- D1 read replication 和 bookmark 已接入
- 跨 Meta DB + Tenant DB 的流程按 saga 和幂等副作用设计
- R2 路径区分 public、private、tmp public、tmp private
- AI 图片、语音、视频任务走 Queue + Tenant DB + R2

这不是为了炫架构，是为了让早期产品在开始有真实用户后还能继续演进

### Cloudflare 资源和部署自动化

Cloudflare 的问题不是能力不够，而是从零搭起来太碎

- 手写 `wrangler.jsonc`
- 手动创建 D1、R2、KV、Queues
- 手动配置 binding
- 手动处理 migration
- 手动配置 Turnstile、邮件、Cron、Durable Objects
- 手动维护本地和生产环境差异

很多模板说自己支持 Cloudflare，实际上只接了 Workers + D1。真正做 SaaS 时，你还是要自己补齐对象存储、队列、定时任务、认证、支付、积分、AI 异步任务和部署自动化

OPCStack 用 `pre-build.mjs` 把这些自动化收束起来

```bash
pnpm install
pnpm dev
```

`pnpm dev` 会自动生成 Worker 配置，创建需要的 Cloudflare 资源，生成并应用数据库迁移

你不是在读一份 Cloudflare 配置教程，而是在拿一个能直接开发产品的骨架

---

## 和其他模板的区别

市面上的模板大多不是没价值，而是目标不同。很多模板解决的是“怎么跑起来”，OPCStack 解决的是“怎么把一个 SaaS 的地基长期跑下去”

| 类型 | 常见能力 | 常见短板 | OPCStack 的区别 |
| --- | --- | --- | --- |
| Web framework starter | 页面、路由、UI、基础部署 | 不处理真实 SaaS 后端复杂度 | API、数据库、存储、队列、支付、积分、通知、反馈一起打通 |
| Cloudflare demo template | Workers、D1、R2、KV 的单点示例 | 多数偏 demo，不是完整产品架构 | 围绕 SaaS 生命周期组织模块，并接入部署自动化 |
| SaaS boilerplate | Auth、billing、email、dashboard | 常以 Vercel、Node、Postgres 为默认地基 | Cloudflare-native，围绕 Workers、D1、R2、Queues、Cron 设计 |
| AI app template | Chat、image、provider 调用 | 常缺少积分、异步任务、R2 结果存储、付费闭环 | AI 能力接入 credits、tenant shard、queue 和 R2 |
| 自己从零搭 | 完全自由 | 重复造轮子，容易写出不可维护的胶水代码 | 给 Vibe Coding 一个清晰边界，让 AI 主要写业务逻辑 |

OPCStack 的选择很明确：不追求做最多 UI 页面，而是先把 Cloudflare-native SaaS 地基打通

---

## 你能得到什么

### Cloudflare-native 基础设施

- Workers：API + SvelteKit SSR
- D1：Meta DB + Tenant Shard DB + 自动迁移 + read replication
- R2：对象存储，公私分离，临时文件，固定图片变体
- KV：轻量键值存储和限流冷却
- Queues：异步任务
- Cron：定时任务
- Durable Objects：串行协调、WebSocket、小状态
- Turnstile：注册、登录、密码重置人机验证
- Email Sending：Resend 或 Cloudflare Email Sending
- 双域名部署：主域名 + `APP_CN_DOMAIN`，用于大陆访问优选加速

### SaaS 业务模块

- 认证：邮箱、Google、GitHub、LinuxDO、内测码、Turnstile
- 积分：余额、流水、注册赠送、每日签到、邀请奖励、兑换码、过期清理
- 支付：Dodo、Creem、一次性积分包、订阅、Webhook、退款扣回
- 用户反馈：用户提交，后台跨 shard 列表
- 系统通知：全局公告和定向通知
- 文档系统：`public-docs/` Markdown 文档，运行时渲染
- 国际化：中英文
- SEO：canonical、hreflang、sitemap、robots、Open Graph、Twitter Card、JSON-LD
- 测试：Vitest、BDD helper、E2E

### AI 能力

- Chat：OpenAI
- Image：OpenAI、Gemini、SeedDream、Aliyun
- TTS：Gemini、Seed
- Realtime Voice：Doubao Realtime
- Video：SeedDance

AI 的同步和异步流程都已经接入队列、Tenant Shard DB 和 R2，适合直接改成具体产品能力

---

## 适合什么项目

- AI 工具站
- SaaS MVP
- 订阅制小产品
- 积分消费型产品
- 需要低成本全球部署的独立产品
- 想用 Vibe Coding 快速做业务，但不想让 AI 重写基础设施的项目

不适合：

- 强依赖传统长连接后端的产品
- 一开始就需要复杂多租户企业权限的产品
- 不准备部署在 Cloudflare 生态里的产品

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

公开配置放在 `.env.dev` 和 `.env.prod`。密钥放在 `.env.secret.dev` 和 `.env.secret.prod`，不要提交密钥文件

如果需要大陆访问优化，可以配置 `APP_CN_DOMAIN`。`pre-build.mjs` 会自动把它接入 Worker 路由、R2 CORS 和 Turnstile 域名

部署到 Cloudflare：

```bash
pnpm deploycf
```

首次远程部署会提示创建 Cloudflare API Token。按命令行链接创建并粘贴一次，后续 token 会缓存在 `.wrangler/cloudflare-api-token`

---

## 项目地图

README 只负责让用户快速理解项目价值和入口。具体开发规则、架构上下文和实现约定放在对应文件里

| 文件或目录 | 职责 |
| --- | --- |
| `AGENTS.md` | AI 开发上下文，包含架构、目录、运行时、数据库、R2、队列、前端、测试约定 |
| `BOOTSTRAP.md` | 新项目初始化流程，让 Agent 引导配置和启动 |
| `SYNC_TEMPLATE.md` | 从上游模板同步更新的流程 |
| `pre-build.mjs` | 本地和部署前自动化，生成配置、创建资源、应用迁移 |
| `wrangler.jsonc.tpl` | Cloudflare Worker 配置模板 |
| `.env.dev` / `.env.prod` | 可提交的公开环境配置 |
| `.env.secret.example` | 密钥配置模板 |
| `src/api/` | Hono API、认证、middleware、业务接口 |
| `src/web/` | SvelteKit 页面、组件、i18n、SEO、文档渲染 |
| `src/db/` | Drizzle schema 和 D1 migration |
| `src/r2/` | R2 上传、读取、签名、图片变体 |
| `src/ai/` | Chat、Image、TTS、Realtime、Video provider |
| `src/payment/` | Dodo、Creem 支付和订阅逻辑 |
| `src/credits/` | 积分钱包、流水、发放、扣减、过期 |
| `src/consumers/` | Cloudflare Queue 消费者 |
| `src/jobs/` | Cron 定时任务 |
| `src/do/` | Durable Object |
| `public-docs/` | 用户可见产品文档 |
| `e2e/` | E2E 测试 |

---

## 常用命令

```bash
pnpm dev              # 本地开发，自动生成配置并应用 migration
pnpm deploycf         # 部署到 Cloudflare
pnpm test             # TypeScript + Svelte check + Vitest
pnpm test:e2e         # 本地 E2E
pnpm test:e2e:remote  # 已部署环境 E2E
```

---

## 技术栈

- Runtime：Cloudflare Workers
- API：Hono
- Web：SvelteKit + Tailwind CSS + shadcn-svelte
- Auth：Better Auth
- Database：Cloudflare D1 + Drizzle ORM
- Storage：Cloudflare R2 + KV
- Async：Cloudflare Queues + Cron + Durable Objects
- Payment：Dodo + Creem
- AI：OpenAI、Gemini、SeedDream、Aliyun、Doubao、SeedDance
- Test：TypeScript、Svelte Check、Vitest、E2E

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

---

## 参考

Cloudflare 免费额度会变化，README 中的额度以 2026-06-25 查询到的官方文档为准

- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Workers KV pricing](https://developers.cloudflare.com/kv/platform/pricing/)
- [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)
