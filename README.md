# OPC Stack

> Cloudflare 全家桶 SaaS 脚手架

OPC Stack 帮你用一套模板跑通 SaaS 的基础设施、认证、支付、积分、AI 能力、文档系统和测试框架

目标很直接：让小产品先用 Cloudflare 免费额度跑起来，等业务验证后再按真实流量扩展

---

## 为什么做这个模板

### Vercel 太贵了

很多小产品不是死在代码上，而是死在还没验证价值之前就开始付平台账单

同样的前端应用，在 Vercel 上账单从 $100 涨到 $800 并不罕见。迁到 Cloudflare Workers 后，同样量级的流量可能只需要几十美元，甚至早期阶段可以直接落在免费额度内

**Cloudflare 免费额度很适合早期 SaaS**

| 产品 | 免费额度 |
| --- | --- |
| Workers | 每天 100,000 请求 |
| D1 | 每天 5,000,000 rows read + 100,000 rows written，账号总存储 5GB |
| R2 | 每月 10GB 存储，1,000,000 Class A 操作，10,000,000 Class B 操作 |
| KV | 每天 100,000 次读取，1,000 次写入，1,000 次删除，1,000 次 list，1GB 存储 |
| Queues | 每天 10,000 次标准操作 |

小项目可以零成本启动，大项目也能把成本控制在更可预测的范围

### 但 Cloudflare 太难用了

Cloudflare 的问题不是能力不够，而是从零搭起来太碎

- 手写 `wrangler.jsonc`
- 手动创建 D1、R2、KV、Queues
- 手动配置 binding
- 手动处理 migration
- 手动配置 Turnstile、邮件、Cron、Durable Objects
- 手动维护本地和生产环境差异

很多模板说自己支持 Cloudflare，实际上只接了 Workers + D1。真正做 SaaS 时，你还是要自己补齐对象存储、队列、定时任务、认证、支付、积分、AI 异步任务和部署自动化

### OPC Stack 解决什么

OPC Stack 把 Cloudflare 的平台能力收束成一个可直接开发产品的模板

```bash
pnpm install
pnpm dev
```

`pnpm dev` 会触发 `pre-build.mjs`，自动生成 Worker 配置，创建需要的 Cloudflare 资源，生成并应用数据库迁移

你需要关注的是产品本身，而不是先花几天把平台胶水粘起来

---

## 你能得到什么

### Cloudflare 全家桶

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

### SaaS 基础能力

- 认证：邮箱、Google、GitHub、LinuxDO、内测码、Turnstile
- 积分：余额、流水、注册赠送、每日签到、邀请奖励、兑换码、过期清理
- 支付：Dodo、Creem、一次性积分包、订阅、Webhook、退款扣回
- 用户反馈：用户提交，后台预留
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

- [ ] 管理后台
- [ ] Agent 框架
- [ ] 指标监控告警
- [ ] 用户私信通知
- [ ] 更多 AI provider
- [ ] 更多支付渠道

---

## 参考

Cloudflare 免费额度会变化，README 中的额度以 2026-06-25 查询到的官方文档为准

- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Workers KV pricing](https://developers.cloudflare.com/kv/platform/pricing/)
- [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)
