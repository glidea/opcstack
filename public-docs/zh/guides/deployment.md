---
title: 部署
description: 部署到 Cloudflare Workers
group: 指南
order: 7
---

# 部署

OPC Stack 部署到 Cloudflare Workers 非常简单。

## 部署前准备

### 1. 配置生产环境变量

编辑 `.env.prod` 写公开配置：

```bash
APP_NAME=your-app
APP_DOMAIN=your-domain.com
EMAIL_ENABLED=true
EMAIL_FROM=noreply@your-domain.com
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
BETA_CODE_ENABLED=false
QUEUE_NAMES=task-check;email-send
CRONS=0 0 * * *,0 */6 * * *
```

创建 `.env.secret.prod` 写密钥配置：

```bash
EMAIL_RESEND_API_KEY=re_xxx
GOOGLE_CLIENT_SECRET=xxx
CHAT_OPENAI_API_KEY=sk-xxx
IMAGE_GEMINI_API_KEY=xxx
```

### 2. 登录 Cloudflare

```bash
wrangler login
```

## 部署

### 一键部署

```bash
pnpm deploy:cloudflare
```

这个命令会：
1. 运行 `scripts/prepare-cloudflare.mjs --mode prod`
2. 创建所有 Cloudflare 资源（D1、R2、KV、Queues）
3. 开启 D1 read replication
4. 执行 migration
5. 部署到 Cloudflare Workers

### 查看部署状态

```bash
# 查看部署日志
wrangler tail

# 查看 Worker 信息
wrangler deployments list
```

## 自定义域名

### 1. 添加域名到 Cloudflare

在 Cloudflare 控制台添加域名，并配置 DNS。

### 2. 绑定域名到 Worker

```bash
wrangler domains add your-domain.com
```

或在 Cloudflare 控制台手动绑定。

### 3. 配置 SSL

Cloudflare 自动提供免费 SSL 证书。

## 环境变量

### 在 Cloudflare 控制台配置

1. 进入 Workers & Pages
2. 选择你的 Worker
3. 进入 Settings → Variables
4. 添加环境变量

### 使用 wrangler 配置

```bash
# 设置环境变量
wrangler secret put CHAT_OPENAI_API_KEY

# 列出环境变量
wrangler secret list
```

## 回滚

### 回滚到上一个版本

```bash
# 查看部署历史
wrangler deployments list

# 回滚到指定版本
wrangler rollback [deployment-id]
```

## 监控

### 查看日志

```bash
# 实时日志
wrangler tail

# 过滤日志
wrangler tail --status error
```

### 查看指标

在 Cloudflare 控制台查看：
- 请求数
- 错误率
- CPU 时间
- 内存使用

## 性能优化

### 1. 启用缓存

```typescript
// 缓存静态资源
return new Response(body, {
  headers: {
    'Cache-Control': 'public, max-age=31536000'
  }
})
```

### 2. 使用 KV 缓存

```typescript
// 缓存 API 响应
const cached = await env.KV.get(cacheKey)
if (cached) {
  return ctx.json(JSON.parse(cached))
}

const data = await fetchData()
await env.KV.put(cacheKey, JSON.stringify(data), {
  expirationTtl: 3600
})
```

### 3. 优化数据库查询

```typescript
// 使用索引
await db.query.users.findFirst({
  where: eq(users.email, email)
})

// 批量查询
const users = await db.query.users.findMany({
  where: inArray(users.id, userIds)
})
```

## CI/CD

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm deploy:cloudflare
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

### 配置 Secrets

在 GitHub 仓库设置中添加：
- `CLOUDFLARE_API_TOKEN`
- 其他环境变量

## 多环境部署

### 配置多个环境

```bash
# 部署到 staging
wrangler deploy --env staging

# 部署到 production
wrangler deploy --env production
```

### wrangler.jsonc 配置

```jsonc
{
  "name": "your-app",
  "main": "src/index.ts",
  "compatibility_date": "2024-01-01",
  "env": {
    "staging": {
      "vars": {
        "ENVIRONMENT": "staging"
      }
    },
    "production": {
      "vars": {
        "ENVIRONMENT": "production"
      }
    }
  }
}
```

## 常见问题

**Q: 部署失败怎么办？**

检查 wrangler 版本是否最新，查看错误日志，确认环境变量配置正确。

**Q: 如何更新依赖？**

修改 `package.json` 后重新部署即可。

**Q: 部署后访问 404？**

检查域名绑定是否正确，DNS 是否生效。
