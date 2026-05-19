# OPC Stack

> Cloudflare 全家桶脚手架 - 零成本跑通 SaaS 业务

一键启动，自动配置，完整集成 Workers + D1 + R2 + KV + Queues + Cron

---

## 为什么做这个模板？

### Vercel 太贵了

Reddit 上有个 CTO 吐槽：同样的前端应用，Vercel 账单从 $100 涨到 $800

迁到 Cloudflare Workers 之后，同样的流量，账单不到 $20

**Cloudflare 免费额度**：
- Workers：每天 10 万请求
- D1：每天 10 万次读取 + 5 万次写入
- R2：每月 10GB 存储
- KV：每天 10 万次读取
- Queues：每月 100 万次操作
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
cp .env.example .env.dev
pnpm dev  # 自动创建数据库、生成配置、执行 migration
```

**完整集成 Cloudflare 全家桶**
- ✅ Workers（API + SSR）
- ✅ D1（数据库 + 自动 migration + 自动获得遍布全球的 read replication）
- ✅ R2（对象存储 + 公私分离）
- ✅ KV（键值存储）
- ✅ Queues（消息队列）
- ✅ Cron（定时任务）
- ✅ Email Sending（邮件发送）

**开箱即用的核心功能**
- ✅ 认证系统（邮箱 + Google + 内测码）
- ✅ 积分系统（注册赠送 + 签到 + 邀请 + 兑换码 + 过期）
- ✅ 用户反馈收集
- ✅ 系统公告通知
- ✅ AI 能力（Chat + Image + TTS）
- ✅ 文档系统（Git-based CMS）
- ✅ 国际化（中英文）
- ✅ SEO 基础能力（canonical、hreflang、sitemap、robots、Open Graph、Twitter Card、JSON-LD）
- ✅ 测试框架（BDD style + 单元测试 + E2E）

**约定大于配置**
- 运行 `pnpm dev`，自动生成 wrangler.jsonc
- 自动创建 D1、R2、KV、Queues
- 自动执行 migration
- 你只需配置少数几个环境变量，不需要到处配置！

---

## 技术栈

**后端**
- Cloudflare Workers + Hono（API 框架）
- Better Auth（认证）
- Drizzle ORM + D1（数据库）

**前端**
- 极致简单轻量的 SvelteKit + Tailwind CSS + shadcn UI
- 多风格设计系统（Token-based，deploy-time 切换，内置 Apple-SaaS / Neo Brutalism 两套风格，见 [DESIGN.md](./DESIGN.md)）
- 支持 SSR 和 SSG
- 国际化（i18n）

**基础设施**
- Cloudflare R2（对象存储）
- Cloudflare KV（键值存储）
- Cloudflare Queues（消息队列）
- Cloudflare Cron（定时任务）
- Resend Email Sending（邮件发送）

**AI 能力**
- OpenAI SDK（Chat）
- OpenAI SDK（Image）
- Google GenAI SDK（Image + TTS）

**业务能力**
- 积分系统（余额、明细、注册赠送、每日签到、邀请奖励、兑换码、后台补发、过期清理）
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
cp .env.example .env.dev
vim .env.dev # 配置
pnpm dev
```

### 3. 后续同步模板更新

```bash
git fetch upstream --tags
git rebase upstream/main
```

---

## 路线图

- [ ] 落地页
- [ ] 支付系统（Creem, Paypal 等个人资质友好渠道）
- [ ] 管理后台
- [ ] 指标监控告警
- [ ] 用户私信通知
- [ ] 更多 AI 能力集成
