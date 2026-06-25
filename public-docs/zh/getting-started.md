---
title: 快速开始
description: 快速开始运行这个开发模板
group: 入门
order: 1
---

# 快速开始

## 1. 获取项目并配置上游追踪

```bash
git clone https://github.com/glidea/opcstack <your-app-name>
cd <your-app-name>
git remote rename origin upstream
git remote add origin <your-repo-url>
git push -u origin main
pnpm install
```

## 2. 初始化项目

推荐使用 AI 自动引导

```bash
claude
@AGENTS.md @BOOTSTRAP.md
```

手动初始化

```bash
vim .env.dev # 公开配置
cp .env.secret.example .env.secret.dev
vim .env.secret.dev # 密钥配置
pnpm dev
```

启动后访问 http://localhost:5173

## 3. 后续同步模板更新

```bash
git fetch upstream --tags
git merge upstream/main
```

## 核心概念

### 请求分流

```
HTTP Request
  ├── /api/*      -> Hono API（后端接口）
  └── other path  -> SvelteKit SSR（前端页面）

Cron Trigger       -> 定时任务
Queue Consumer     -> 队列消费
```

所有 `/api/*` 的请求会被 Hono 处理，其他请求会被 SvelteKit 处理。

### 目录结构

```
src/
  api/              # 后端 API
    handler/        # 写你的 API handler
    middleware/     # 中间件（认证、内测码等）
  web/              # 前端页面
    routes/         # 写你的页面
    lib/ui/         # UI 组件
  db/               # 数据库
    schema.ts       # 定义表结构
  jobs/             # 定时任务
  consumers/        # 队列消费
```

### 约定

- **API 路由**：在 `src/api/index.ts` 注册
- **数据库**：修改 `src/db/schema.ts`，重启 `pnpm dev` 自动 migration
- **队列 Binding**：`Q_<QUEUE_NAME_UPPER>`（例如 `task-check` → `Q_TASK_CHECK`）
- **R2 文件**：公共 `public/*`，私有 `private/<userId>/*`

## 开发第一个功能

### 后端 API

1. 在 `src/api/handler/` 创建 handler
2. 在 `src/api/index.ts` 注册路由
3. 使用 `ctx.get('userId')` 获取用户 ID
4. 使用 `ctx.get('db')` 获取数据库实例

### 前端页面

1. 在 `src/web/routes/` 创建页面
2. 组件放 `src/web/lib/ui/`
3. 国际化文案放 `src/web/lib/i18n/messages/`

### 数据库

1. 编辑 `src/db/schema.ts` 定义表结构
2. 重启 `pnpm dev` 自动生成并执行 migration

## 使用 AI 辅助开发

推荐使用 `@AGENTS.md` 让 AI 帮助你开发：

```bash
# 在项目根目录
claude

# 引用 AGENTS.md
@AGENTS.md 帮我实现一个用户资料页面
```

AGENTS.md 包含了完整的项目上下文，AI 能够理解项目结构并生成正确的代码。

## 推荐的开发流程

1. **明确需求**：想清楚要实现什么功能
2. **设计数据**：需要哪些表，字段是什么
3. **使用 AI**：`@AGENTS.md` 让 AI 帮你实现
4. **测试验证**：运行 `pnpm test` 和 `pnpm test:e2e`
5. **部署上线**：`pnpm deploycf`

## 常见问题

### 如何获取当前用户？

```ts
const userId = ctx.get('userId')
if (!userId) {
  return ctx.json({ error: 'Unauthorized' }, 401)
}
```

### 如何查询数据库？

```ts
const db = ctx.get('db')
const users = await db.select().from(userTable)
```

### 如何上传文件到 R2？

```ts
import { newR2Client } from './src/r2'

const client = newR2Client(env, userId)
await client.putImage({ dir, imageBase64, mimeType })
```

### 如何发送队列消息？

```ts
await env.Q_TASK_CHECK.send({ data: 'hello' })
```
