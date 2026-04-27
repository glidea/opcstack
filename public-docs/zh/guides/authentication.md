---
title: 认证
description: 邮箱和 Google 登录配置
group: 指南
order: 1
---

# 认证

OPC Stack 基于 [Better Auth](https://www.better-auth.com/) 实现认证，支持邮箱和 Google 登录。

## 邮箱登录

### 配置步骤

1. 购买或使用已有域名
2. 将域名托管到 Cloudflare（支持子域名，如 `mail.example.com`）
3. 注册 [Resend](https://resend.com/) 账号
4. 在 Resend 中添加域名并验证 DNS 记录
5. 创建 API Key
6. 配置环境变量：

```bash
EMAIL_ENABLED=true
EMAIL_FROM=noreply@example.com
RESEND_API_KEY=re_xxx
```

### 工作流程

```
用户输入邮箱
  ↓
发送验证码到邮箱（通过 Resend）
  ↓
用户输入验证码
  ↓
验证通过，创建 session
  ↓
返回 token
```

### 中间件

`emailAuthMiddleware` 会检查：
- `EMAIL_ENABLED` 是否为 true
- `EMAIL_FROM` 和 `RESEND_API_KEY` 是否配置
- 用户邮箱是否已验证

## Google 登录

### 配置步骤

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建 OAuth 2.0 客户端 ID
3. 配置授权重定向 URI：`https://your-domain.com/api/auth/callback/google`
4. 配置环境变量：

```bash
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
```

### 工作流程

```
用户点击 Google 登录
  ↓
跳转到 Google 授权页面
  ↓
用户授权
  ↓
Google 回调到 /api/auth/callback/google
  ↓
创建或更新用户
  ↓
创建 session，返回 token
```

## 认证中间件

### authMiddleware

注入 `userId` 到 `ctx.variables`，不拦截请求。

### betaGateMiddleware

如果 `BETA_CODE_ENABLED=true`，检查用户是否绑定内测码。

## Session 管理

Better Auth 使用 D1 存储 session，通过 `d1SessionMiddleware` 注入 `db` 实例，并处理 bookmark 机制保证读一致性。

## 前端集成

```typescript
// src/web/lib/auth.ts
import { createAuthClient } from 'better-auth/client'

export const authClient = createAuthClient({
  baseURL: '/api/auth'
})

// 登录
await authClient.signIn.email({
  email: 'user@example.com',
  callbackURL: '/'
})

// 登出
await authClient.signOut()

// 获取当前用户
const session = await authClient.getSession()
```

## 常见问题

**Q: 邮箱验证码收不到？**

检查 Resend DNS 记录是否正确配置，查看 Resend 控制台的发送日志。

**Q: Google 登录报错 redirect_uri_mismatch？**

确保 Google Cloud Console 中配置的重定向 URI 与实际回调地址完全一致。

**Q: 如何自定义邮件模板？**

修改 `src/api/auth/index.ts` 中的 `emailAndPassword` 插件配置。
