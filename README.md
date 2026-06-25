# OPC Stack

> Cloudflare 全家桶脚手架 - 零成本跑通 SaaS 业务

一键启动，自动配置，完整集成 Workers + D1 分片 + R2 + KV + Queues + Cron + Durable Objects

---

## 为什么做这个模板？

### Vercel 太贵了

Reddit 上有个 CTO 吐槽：同样的前端应用，Vercel 账单从 $100 涨到 $800

迁到 Cloudflare Workers 之后，同样的流量，账单不到 $20

**Cloudflare 免费额度**：
- Workers：每天 10 万请求
- D1：每天 500 万 rows read + 10 万 rows written，账号总存储 5GB
- R2：每月 10GB 存储，100 万 Class A 操作，1000 万 Class B 操作
- KV：每天 10 万次读取，1000 次写入，1000 次删除，1000 次 list，1GB 存储
- Queues：每天 1 万次标准操作
- Cron：不限次数

小项目零成本跑通，大项目成本是 Vercel 的 1/10

### 但 Cloudflare 太难用了

- 手写 wrangler.jsonc 配置
- 手动创建 D1 数据库
- 手动创建 R2 bucket、KV namespace、Queues
- 手动处理 migration
- 手动配置 binding

**其他 Cloudflare 模板的问题**：
- 声称支持 Cloudflare，实际上只接入了 Worker + D1
- R2、KV、Queues、Cron 要自己配
- 没有自动化流程

### OPC Stack 解决了什么？

**一键启动，自动配置**
```bash
pnpm install
vim .env.dev
vim .env.secret.dev
pnpm dev  # 自动创建数据库、生成配置、执行 migration
```

**完整集成 Cloudflare 全家桶**
- ✅ Workers（API + SSR）
- ✅ D1（Meta DB + Tenant Shard DB + 自动 migration + 自动 read replication）
- ✅ R2（对象存储 + 公私分离 + 固定图片变体）
- ✅ KV（键值存储）
- ✅ Queues（消息队列）
- ✅ Cron（定时任务）
- ✅ Durable Objects（串行协调 + WebSocket + 小状态）
- ✅ Email Sending（邮件发送）
- ✅ Turnstile（人机验证 + 自动创建 widget）

**开箱即用的核心功能**
- ✅ 认证系统（邮箱 + Google + GitHub + LinuxDO + 内测码 + Turnstile）
- ✅ 积分系统（注册赠送 + 签到 + 邀请 + 兑换码 + 过期）
- ✅ 支付系统（Dodo + Creem，支持一次性积分包和订阅）
- ✅ 用户反馈收集
- ✅ 系统公告通知
- ✅ AI 能力（Chat + Image + TTS + Realtime Voice + Video）
- ✅ 文档系统（Git-based CMS）
- ✅ 国际化（中英文）
- ✅ SEO 基础能力（canonical、hreflang、sitemap、robots、Open Graph、Twitter Card、JSON-LD）
- ✅ 测试框架（BDD style + 单元测试 + E2E）

**约定大于配置**
- 运行 `pnpm dev`，自动生成 wrangler.jsonc
- 自动创建 Meta D1、Tenant Shard D1、R2、KV、Queues
- 根据 `DO_NAMES` 自动生成 Durable Object binding 和 migration
- 开启 `TURNSTILE_ENABLED=true` 后，本地自动使用 Cloudflare 测试 key，远程部署自动创建或复用名为 `APP_NAME` 的 Turnstile widget
- 首次远程部署会提示创建 Cloudflare API Token，粘贴一次后缓存到 `.wrangler/cloudflare-api-token`
- 自动执行 migration
- 你只需配置少数几个环境变量，不需要到处配置！

---

## 技术栈

**后端**
- Cloudflare Workers + Hono（API 框架）
- Better Auth（认证）
- Drizzle ORM + D1（Meta DB + Tenant Shard DB）

**前端**
- 极致简单轻量的 SvelteKit + Tailwind CSS + shadcn UI
- 多风格设计系统（Token-based，deploy-time 切换，内置 `apple-saas` / `brutalism` 两套风格，见 [AGENTS.md](./AGENTS.md)）
- 支持 SSR 和 SSG
- 国际化（i18n）

**基础设施**
- Cloudflare R2（对象存储）
- Cloudflare KV（键值存储）
- Cloudflare Queues（消息队列）
- Cloudflare Cron（定时任务）
- Cloudflare Durable Objects（串行协调、WebSocket、小状态）
- Cloudflare Turnstile（登录、注册、密码重置人机验证）
- Resend / Cloudflare Email Sending（邮件发送）

**AI 能力**
- OpenAI SDK（Chat）
- OpenAI / Gemini / SeedDream / Aliyun（Image）
- Gemini / Seed（TTS）
- Doubao Realtime（Realtime Voice）
- SeedDance（Video）

**业务能力**
- 积分系统（余额、明细、注册赠送、每日签到、邀请奖励、兑换码、后台补发、过期清理）
- 支付系统（Dodo / Creem，支付 webhook，订阅状态，积分发放和退款扣回）
- 用户反馈收集
- 系统公告通知

---

## 快速开始

### 1. 获取项目并配置上游追踪

```bash
git clone https://github.com/glidea/opcstack <your-app-name>
cd <your-app-name>
git remote rename origin upstream
git remote add origin <your-repo-url>
git push -u origin main
pnpm install
```

### 2. 初始化项目

```bash

# 1. 推荐：Claude Code / Codex /... 自动引导
claude
> @AGENTS.md @BOOTSTRAP.md
# AGENTS.md 是框架的上下文文件，便于 agent 理解项目，可在后续需求开发中继续使用
# BOOTSTRAP.md 是引导流程，让 agent 自动引导你完成项目基础搭建

# 2. 手动
vim .env.dev # 公开配置
vim .env.secret.dev # 密钥配置
pnpm dev
```

仓库提供 `.env.dev` 和 `.env.prod` 作为公开配置入口。密钥放在 `.env.secret.dev` 或 `.env.secret.prod`，由 `pre-build.mjs` 读取并写入 `.wrangler/runtime-secrets.env`，不要提交密钥文件。

### 3. Turnstile 配置

Turnstile 只需要一个开关：

```env
TURNSTILE_ENABLED=true
```

本地 `pnpm dev` 使用 Cloudflare 官方测试 key，不需要手动创建 widget。远程 `pnpm deploycf` 会用 `APP_NAME` 自动创建或复用 Turnstile widget，并把 `sitekey` 写入生成的 `wrangler.jsonc`，把 `secret` 作为 Cloudflare Secret 随部署同步。

首次远程部署如果没有 token，命令行会输出 Cloudflare API Token 创建链接。浏览器里确认创建后，把 token 粘贴回命令行即可继续部署。token 会保存到 `.wrangler/cloudflare-api-token`，该目录默认不会提交到 Git。脚本会按所需 Cloudflare 权限范围生成本地指纹，后续权限范围变化时会自动要求重新粘贴 token 并覆盖旧缓存。

### 4. 邮件发送配置

邮箱注册、邮箱验证和找回密码会走 `EMAIL_PROVIDER`。

使用 Resend：

```env
EMAIL_ENABLED=true
EMAIL_PROVIDER=resend
EMAIL_FROM=noreply@example.com
```

`EMAIL_RESEND_API_KEY` 放到 `.env.secret.dev` 或 `.env.secret.prod`：

```env
EMAIL_RESEND_API_KEY=re_xxx
```

使用 Cloudflare Email Sending：

```env
EMAIL_ENABLED=true
EMAIL_PROVIDER=cloudflare
EMAIL_FROM=noreply@example.com
```

Cloudflare 模式要求发件域已启用 Email Routing。`wrangler.jsonc` 会由 `pnpm dev` 自动生成 `SEND_EMAIL` binding。

### 5. D1 分片配置

OPC Stack 默认会创建一个 Meta DB 和一组 Tenant Shard DB：

```env
D1_SHARDS=wnam:1;apac:1
```

- Meta DB 存认证、支付订单、兑换码、通知正文、分片注册表
- Tenant Shard DB 存用户级数据，比如积分余额、积分流水、反馈、通知已读状态
- `D1_SHARDS` 的格式是 `region:count`，多个 region 用 `;` 分隔
- region code 对应 Cloudflare D1 location hint：`wnam` Western North America，`enam` Eastern North America，`weur` Western Europe，`eeur` Eastern Europe，`apac` Asia Pacific，`oc` Oceania
- `pnpm dev` 和 `pnpm deploycf` 会按 `D1_SHARDS` 生成 `TENANT_DB_WNAM_0000` 这类 binding，并写入 Meta DB 的 `d1_shards`
- 扩容时增加对应 region 的数量后重新部署，新增用户会优先路由到 Worker 所在区域最近的 active shard，已有用户保持原 shard

修改数据库 schema 时：

- Meta 表改 `src/db/schema.meta.ts`
- Tenant Shard 表改 `src/db/schema.shard.ts`
- 重启 `pnpm dev` 自动生成并应用 migration

### 6. R2 图片变体

R2 图片读取仍然走原接口：

```text
GET /api/r2/public/images/a.png
GET /api/r2/private/u1/images/a.png
```

需要压缩图时加固定变体：

```text
GET /api/r2/public/images/a.png?variant=small
GET /api/r2/private/u1/images/a.png?variant=medium
```

只支持 `small` 和 `medium`，不开放动态尺寸。内部回源使用 HMAC，需要配置：

`R2_ORIGIN_SIGNING_SECRET` 放到 `.env.secret.dev` 或 `.env.secret.prod`。

### 7. 队列和异步任务

默认队列配置在 `.env.dev`：

```env
QUEUE_NAMES=image-generate;tts-generate;video-generate
```

- `image-generate`：异步图片生成
- `tts-generate`：异步 TTS
- `video-generate`：异步视频生成

新增队列时，修改 `QUEUE_NAMES`，然后在 `src/consumers/index.ts` 注册 handler。队列 binding 命名规则是 `Q_<QUEUE_NAME_UPPER>`，例如 `video-generate` 对应 `Q_VIDEO_GENERATE`。

### 8. Durable Objects

Durable Objects 通过 `DO_NAMES` 配置：

```env
DO_NAMES=rate-limiter;workflow-lock
```

`pnpm dev` 或 `pnpm deploycf` 会自动生成 binding 和 migration。新增 DO 时，需要创建 `src/do/` 下的 class，并从 `src/index.ts` 导出。

### 9. AI 配置

AI 能力按 capability 拆分配置：

```text
CHAT_OPENAI_*
IMAGE_GEMINI_* / IMAGE_OPENAI_* / IMAGE_SEEDDREAM_* / IMAGE_ALIYUN_*
TTS_GEMINI_* / TTS_SEED_*
REALTIME_DOUBAO_*
VIDEO_SEEDDANCE_*
```

所有 provider 都支持 primary base url / api key 和 fallback base url / api key。fallback 只换 endpoint 和 key，不换 model。

### 10. 测试

```bash
pnpm test
pnpm test:e2e
pnpm test:e2e:remote
```

`pnpm test` 会先跑 TypeScript、Svelte check，再跑 Vitest。

远端 E2E 只验证已经部署好的环境，不会创建 D1、R2、KV、Queue，不会修改 shard 数，也不会执行 migration。

### 11. 后续同步模板更新

```bash
# 1. 推荐：Agent 自动更新，解决冲突，任意 Agent 对话中：
> @SYNC_TEMPLATE.md

# 2. 手动
git fetch upstream --tags
git rebase upstream/main
```

---

## 路线图

- [ ] 管理后台
- [ ] Agent 框架
- [ ] 指标监控告警
- [ ] 用户私信通知
- [ ] 更多 AI provider
- [ ] 更多支付渠道
