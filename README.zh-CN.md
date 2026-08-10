# OPCStack

[English](README.md) | [简体中文](README.zh-CN.md)

让 OPC 的产品开发更快，部署运维成本更低。

OPCStack 是面向一人公司的 Cloudflare 原生 AI SaaS 模板。内置认证、支付、积分、D1 分片、R2、KV、Queues、Cron、AI 任务、自动部署和完整测试体系。

---

## 更快构建产品

大多数模板只提供页面、登录和几个示例 API，剩下的基础能力仍要从头实现。

拖慢开发的通常不是 AI 不会写代码，而是缺少稳定的工程基础。OPCStack 遵循 Harness Engineering，将需求、上下文、约束、反馈、测试和部署变成可重复的流程。有了固定的基础和验收流程，AI 可以专注产品改动，不必为每个项目重复搭建登录、支付、存储、队列和部署。

| 领域 | 内置能力 |
| --- | --- |
| Web / API | Cloudflare Workers、SvelteKit、Hono API、静态页面预渲染 |
| 数据库 | Cloudflare D1、Drizzle、用户数据分片、只读副本、自动迁移 |
| 文件存储 | Cloudflare R2、公开文件、私有文件、临时文件、浏览器直传、图片变体 |
| 异步任务 | Cloudflare Queues、Cron、Durable Objects |
| 账户 | Better Auth、邮箱登录、Google、GitHub、LinuxDO、Turnstile、内测码 |
| 积分 | 积分钱包、账本、注册赠送、每日签到、邀请奖励、兑换码、过期清理 |
| 支付 | Dodo、Creem、一次性积分包、订阅、Webhook、退款冲正 |
| 运营 | 管理控制台、用户、积分、码、反馈、公告、支付和 AI 任务查看 |
| AI | OpenAI、Gemini、SeedDream、阿里云、豆包、SeedDance、异步任务、R2 结果存储 |
| 前端 | Tailwind CSS、shadcn-svelte、共享 UI、中英文国际化、Web 应用 |
| 浏览器扩展 | Chrome 扩展、WXT、弹窗、设置页、后台脚本、内容脚本 |
| 文档和 SEO | Markdown 文档、Sitemap、Robots、Open Graph、Twitter Card、JSON-LD |
| 部署 | Cloudflare 资源创建、环境模板、Worker 配置生成、中国域名配置、扩展打包 |
| 测试 | TypeScript、Svelte Check、Vitest、BDD 辅助工具、本地和远程 E2E 测试 |

这些能力不是互不相关的演示代码，而是围绕真实产品流程组织：

```text
注册 -> 内测码 -> 积分 -> 邀请奖励 -> 支付和订阅 -> 通知 -> 反馈 -> 管理控制台
```

不需要的模块可以直接删除，不必重新设计这些基础流程。

---

## 为什么选择 Cloudflare

一人公司不该把时间花在维护服务器、自动扩缩容、Kubernetes、对象存储、队列和 CDN 上。按量付费的 Serverless 平台是更合适的默认选择。

Vercel 和 Supabase 是独立开发者常用的选择，早期体验不错。产品开始增长后，流量、调用次数、存储、队列和 CDN 用量可能迅速推高账单。

Cloudflare 将 Workers、D1、R2、KV、Queues、Cron 和 CDN 放在同一个边缘平台上，可以用较低成本承载注册、用量、支付、异步任务和文件存储。

一篇公开迁移讨论提到，某前端应用的 Vercel 月账单从不到 100 美元增长到超过 800 美元。迁移到 Cloudflare Workers 后，相同流量的预计成本低于 20 美元，同时 Lighthouse 得分有所提升：[Is anyone else frustrated with Vercel pricing once you scale?](https://www.reddit.com/r/nextjs/comments/1qnld0e/is_anyone_else_frustrated_with_vercel_pricing/)

免费额度足以验证 MVP。业务增长后，Workers Paid 计划从每月 5 美元起，按用量计费。下表汇总了 OPCStack 使用的核心产品：

| 产品 | 免费额度 | Workers Paid 计划，每月 5 美元起 |
| --- | --- | --- |
| Workers | 每天 100,000 次请求，每次调用 10 ms CPU | 每月包含 1,000 万次请求，超出后每百万次 0.30 美元；每月包含 3,000 万 CPU ms，超出后每百万 CPU ms 0.02 美元 |
| D1 | 每天读取 500 万行、写入 100,000 行，5 GB 存储 | 每月包含读取 250 亿行，超出后每百万行 0.001 美元；每月包含写入 5,000 万行，超出后每百万行 1 美元；存储每 GB 0.75 美元 |
| R2 | 10 GB 存储，每月 100 万次 A 类操作、1,000 万次 B 类操作 | 存储每 GB 0.015 美元；A 类操作每百万次 4.50 美元；B 类操作每百万次 0.36 美元；出站流量免费 |
| KV | 每天读取 100,000 次，写入、删除和列表各 1,000 次，1 GB 存储 | 每月包含 1,000 万次读取和 100 万次写入、删除及列表；超出后每百万次读取 0.50 美元，每百万次写入、删除及列表 5 美元 |
| Queues | 每天 10,000 次操作 | 每月包含 100 万次操作，超出后每百万次 0.40 美元 |
| Cron Triggers | 包含在 Workers 中 | 按 Workers 计费，不单独收费 |
| CDN | 免费，无额外出站流量费用 | 免费，无额外出站流量费用 |

R2 的免费出站流量是相对 S3 的重要优势。KV、Queues 和 D1 同样不收取出站流量费用。以上为本文编写时的公开价格，最新价格请查看 [Cloudflare 官方定价文档](https://developers.cloudflare.com/workers/platform/pricing/)。

---

## 比常规 Cloudflare 模板更接近生产环境

很多 Cloudflare 模板只是连接 Workers、D1 和 R2。这足以运行演示，但不足以支撑 SaaS 产品。

OPCStack 还提供：

- Meta DB 和 Tenant Shard DB 分层，支持近乎无限的横向扩展
- 新用户自动分配到可用分片
- Active 和 Draining 分片状态
- D1 只读副本和 Bookmark
- 跨 Meta DB 与 Tenant DB 流程的 Saga 和幂等副作用
- 公开、私有、临时公开和临时私有的 R2 路径隔离
- 基于 Queues、Tenant DB 和 R2 的 AI 图片、语音和视频任务
- 本地和生产环境的 Cloudflare 资源自动准备

---

## 快速开始

首次使用：

```text
Create an OPCStack app named <APP_NAME> by following:
https://raw.githubusercontent.com/glidea/opcstack/main/QUICK_START.md
```

Agent 会按照当前平台规范安装用户级 `create-opcstack-app` Skill，然后引导创建项目。如果 `<APP_NAME>` 没有替换，Agent 会先询问应用名。

以后创建新项目时直接调用已安装的 Skill：

```text
Use create-opcstack-app to create an app named <APP_NAME>.
```

Skill 每次执行都会读取最新流程，不需要手动更新。

### 手动安装

创建项目：

```bash
git clone https://github.com/glidea/opcstack <your-app-name>
cd <your-app-name>
git remote rename origin upstream
pnpm install
vim .env.dev
cp .env.secret.example .env.secret.dev
vim .env.secret.dev
pnpm dev
```

部署到 Cloudflare：

```bash
pnpm deploy:cloudflare
```

首次远程部署时会提示创建 Cloudflare API Token。打开 CLI 提供的链接，创建并粘贴一次，Token 随后会缓存在 `.wrangler/cloudflare-api-token`。

开发浏览器扩展：

```bash
pnpm dev:extension
pnpm build:extension
```

---

## 项目目录

| 路径 | 职责 |
| --- | --- |
| `AGENTS.md` | AI 开发上下文，包括架构、目录、运行时、数据库、R2、队列、前端和测试规范 |
| `QUICK_START.md` | 安装并调用当前平台原生的 `create-opcstack-app` Skill |
| `CREATE_OPCSTACK_APP.md` | 项目创建和本地初始化的标准流程 |
| `SYNC_TEMPLATE.md` | 从上游模板同步更新的流程 |
| `scripts/prepare-public.mjs` | 生成前端公共产物，包括客户端配置、Web Logo 和扩展图标 |
| `scripts/prepare-cloudflare.mjs` | 本地和部署前的 Cloudflare 配置、资源创建及迁移自动化 |
| `wrangler.jsonc.tpl` | Worker 配置模板 |
| `.env.dev` / `.env.prod` | 可提交的公共环境配置 |
| `.env.secret.example` | 不含真实值的密钥配置模板 |
| `src/api-contract/` | API 请求、响应、Schema 和共享类型 |
| `src/frontend/lib/` | 共享前端层，包括 UI、国际化、配置和客户端逻辑 |
| `src/frontend/web/` | Web 入口，包括 SvelteKit 页面、路由、静态资源和应用外壳 |
| `src/frontend/extension/` | Chrome 扩展入口，包括弹窗、设置页、后台脚本和内容脚本 |
| `src/backend/api/` | Hono API、认证、中间件和业务接口 |
| `src/backend/db/` | Drizzle Schema 和 D1 迁移 |
| `src/backend/r2/` | R2 上传、读取、签名和图片变体 |
| `src/backend/ai/` | 聊天、图片、TTS、实时和视频提供商 |
| `src/backend/payment/` | Dodo 和 Creem 支付及订阅逻辑 |
| `src/backend/credits/` | 积分钱包、账本、发放、扣减和过期逻辑 |
| `src/backend/consumers/` | Cloudflare Queue 消费者 |
| `src/backend/jobs/` | Cron 任务 |
| `src/backend/do/` | Durable Objects |
| `public-docs/` | 面向产品用户的文档 |
| `template-docs/` | 模板开发文档 |
| `e2e/` | E2E 测试 |

---

## 路线图

### 运营

- [x] 统一运营和管理控制台
- [ ] 基于 Cloudflare Analytics 的指标监控和告警

### 支付和计费

- [ ] 支持支付宝
- [ ] 支持 ZPay、Qirun Pay 等低门槛支付服务商
- [ ] 余额订阅
- [ ] 更完善的支付路由和商品配置

### 可靠性和用量控制

- [ ] 统一限流
- [ ] 用户级配额
- [ ] API、AI 任务、存储和积分消耗的用量控制

### 多平台支持

- [ ] 移动端支持
- [ ] 桌面端支持

---

## 开源协议

本项目使用 [Apache License 2.0](LICENSE)。
