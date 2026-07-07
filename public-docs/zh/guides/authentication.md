---
title: 认证
description: Better Auth、邮件 OAuth、Turnstile、会话、管理员访问与前端集成
group: Guides
order: 1
---

# 认证

OPCStack 使用 [Better Auth](https://www.better-auth.com/) 进行认证。认证状态存储在全局 Meta DB 中，而不是租户分片，因为系统必须在不知道用户分片的情况下解析用户身份。支持多种登录方式：邮件密码、邮件 OTP 验证、Google、GitHub 和 LinuxDo OAuth。

## 认证模型

`src/backend/api/auth/index.ts` 导出 `authCore(env, db)`，用于构建 Better Auth 实例。该实例组合了多个 Better Auth 插件：

- `bearer` 为 API 客户端启用 Bearer token 访问
- `emailOTP` 处理验证码和密码重置流程
- `captcha` 在注册和密码重置端点添加 Cloudflare Turnstile 保护
- `genericOAuth` 驱动 LinuxDo 社交登录

邮件密码不是插件，而是在 `emailAndPassword` 字段中配置的原生 Better Auth provider。Google 和 GitHub 是在 `socialProviders` 中配置的原生社交 provider。

会话有效期 30 天，在 27 天时刷新。密码哈希器使用 Workers 运行时 `crypto.subtle` 配合 SHA-1 和随机盐，而不是纯 JS 回退实现。

## 请求路由

所有认证相关的 HTTP 请求都通过 `/api/*` 前缀。在处理器之前按顺序运行三层中间件：

```
Client request
  |
  v
/metaDbSessionMiddleware (/api/*)
  -- 注入 ctx.get('metaDb')，带 D1 session bookmark
  |
  v
/emailAuthMiddleware (/api/auth/*)
  -- 拦截 OTP 登录，检查注册、allowlist、冷却时间
  |
  v
Better Auth handler (/api/auth/*)
  -- 委托给 authCore().handler
  |
  v
/authMiddleware + betaGateMiddleware + tenantDbMiddleware (/api/*, 认证路由)
  -- 验证会话，设置 userId，检查内测码，挂载 tenantDb
```

公开 API 链（`publicApi`）只为 `/api/auth/*` 路径挂载 `emailAuthMiddleware`。认证用户 API 链（`userApi`）按顺序挂载 `authMiddleware`、`betaGateMiddleware` 和 `tenantDbMiddleware`。管理员 API 链（`adminApi`）使用 `adminUserMiddleware` 代替用户链。

## 认证数据归属

认证 schema 定义在 `src/backend/db/schema.auth.ts` 中，存储在 Meta DB。四张表：

| 表 | 用途 |
| --- | --- |
| `user` | 用户身份：id、name、email、emailVerified、image、affCode、registrationUtmSource |
| `session` | 会话 token、到期时间、userId 引用 |
| `account` | Provider 账户：邮件密码、Google、GitHub、LinuxDo，每用户可有多条 |
| `verification` | 邮件 OTP 和验证 token |

认证表不存储在租户分片中，因为请求层需要在知道分片之前解析身份。`account` 每用户支持多行，每个 provider 一行。

## 登录方式

### 邮件密码

由 `EMAIL_SIGNUP_ENABLED` 和 `EMAIL_REQUIRE_VERIFICATION` 控制。启用注册后，用户通过邮件和密码注册。需要验证时，前端在注册后调用 `sendVerificationOtp` 发送 6 位验证码。

```
用户输入邮件 + 密码
  |
  v
POST /api/auth/sign-up/email
  -- 创建用户（EMAIL_SIGNUP_ENABLED=false 时禁用）
  |
  v
POST /api/auth/email-otp/send-verification-otp  (EMAIL_REQUIRE_VERIFICATION=true 时)
  -- 发送 6 位 OTP 到邮件
  |
  v
POST /api/auth/email-otp/verify-email
  -- 标记 emailVerified=true
```

`buildPasswordHasher` 中的密码哈希器使用 `crypto.subtle.digest('SHA-1', ...)` 配合随机 8 字节盐。哈希格式为 `saltHex:keyHex`。

### 邮件 OTP

邮件 OTP 是插件级功能，不是登录方式。插件配置中的 `disableSignUp: true` 意味着 OTP 不能创建新用户。OTP 登录路由被 `emailAuthMiddleware` 硬拦截：

```ts
if (ctx.req.path === '/api/auth/sign-in/email-otp') {
    return ctx.json({ code: 'EMAIL_OTP_SIGN_IN_DISABLED' }, 400)
}
```

OTP 用于三个流程：注册后邮件验证、密码重置和邮件变更。OTP 为 6 位数字，300 秒后过期，允许 3 次尝试。OTP 以哈希形式存储。

### Google OAuth

由 `GOOGLE_AUTH_ENABLED` 控制。Client ID 和 Secret 配置原生 Google 社交 provider。回调 URI 为 `https://your-domain.com/api/auth/callback/google`。

### GitHub OAuth

由 `GITHUB_AUTH_ENABLED` 控制。与 Google 相同的原生社交 provider 模式。回调 URI 为 `https://your-domain.com/api/auth/callback/github`。

### LinuxDo OAuth

由 `LINUXDO_AUTH_ENABLED` 控制。使用 `genericOAuth` 插件，因为 LinuxDo 不是 Better Auth 的原生 provider。Profile 映射将 LinuxDo 用户 id 转换为合成邮件：

```ts
email: `linuxdo-${id}@linuxdo.local`
```

这个邮件不是真实邮件，只用于确保 `user` 表中的唯一性。`mapProfileToUser` 函数还从 `avatar_template` 字段构建头像 URL。

## 平台配置

使用 `APP_BASE_URL` 作为回调 URL 的事实来源。生产环境解析为 `https://<APP_DOMAIN>`。本地开发时 `APP_DOMAIN=localhost`，解析为 `http://localhost:5173`。

| 平台 | 控制台操作 | 环境变量 |
| --- | --- | --- |
| Cloudflare Email Service | 接入发送域名，使用生成的 `SEND_EMAIL` binding | `EMAIL_PROVIDER=cloudflare`、`SYSTEM_EMAIL` |
| Resend | 验证发送域名，创建带发送权限的 API key | `EMAIL_PROVIDER=resend`、`EMAIL_RESEND_API_KEY`、`SYSTEM_EMAIL` |
| Cloudflare Turnstile | 为 `APP_DOMAIN` 和可选的 `APP_CN_DOMAIN` 创建或复用 widget | `TURNSTILE_ENABLED`、`TURNSTILE_SITE_KEY`、`TURNSTILE_SECRET_KEY` |
| Google OAuth | 创建 Web application OAuth client | `GOOGLE_AUTH_ENABLED`、`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET` |
| GitHub OAuth | 创建 OAuth App | `GITHUB_AUTH_ENABLED`、`GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET` |
| LinuxDo OAuth | 在 LinuxDo 控制台创建 OAuth 应用 | `LINUXDO_AUTH_ENABLED`、`LINUXDO_CLIENT_ID`、`LINUXDO_CLIENT_SECRET` |

### Cloudflare Email Service

当 `EMAIL_PROVIDER=cloudflare` 时使用。Worker 在 `wrangler.jsonc.tpl` 中已有名为 `SEND_EMAIL` 的 `send_email` binding，不要再添加新的 binding。

配置步骤：

1. 打开 Cloudflare 控制台
2. 进入 **Compute > Email Service > Email Sending**
3. 选择 **Onboard Domain**，选择 `SYSTEM_EMAIL` 使用的域名
4. 让 Cloudflare 创建所需的 SPF、DKIM、DMARC 和 bounce 记录
5. 等待发送域名激活
6. 设置 `EMAIL_PROVIDER=cloudflare`
7. 将 `SYSTEM_EMAIL` 设置为接入域名上的地址
8. 部署前运行 `pnpm prepare:cloudflare:prod`

如果需要本地真实发送而不依赖 Cloudflare 远端邮件行为，使用 Resend。

文档：[Cloudflare Email Service](https://developers.cloudflare.com/email-service/get-started/send-emails/)、[Workers send email binding](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/)

### Resend

当 `EMAIL_PROVIDER=resend` 时使用。

配置步骤：

1. 打开 Resend 控制台
2. 添加并验证发送域名
3. 创建带发送权限的 API key
4. 设置 `EMAIL_PROVIDER=resend`
5. 将 `SYSTEM_EMAIL` 设置为已验证域名上的地址
6. 将 API key 填入 `EMAIL_RESEND_API_KEY`
7. 运行 `pnpm prepare:cloudflare:dev` 或 `pnpm prepare:cloudflare:prod`

`from` 地址始终是 `SYSTEM_EMAIL`。如果 Resend 拒绝邮件，先修复发件域名，不要在代码中绕过。

文档：[Resend domains](https://resend.com/docs/dashboard/domains/introduction)、[Resend API keys](https://resend.com/docs/create-an-api-key)

### Cloudflare Turnstile

`prepare-cloudflare` 可以在生产环境中管理此项。当 `TURNSTILE_ENABLED=true` 且 prepare 命令以 prod 模式运行时，会为 `APP_DOMAIN` 和可选的 `APP_CN_DOMAIN` 创建或复用一个名为 `APP_NAME` 的 Turnstile widget。

正常生产步骤：

1. 设置 `TURNSTILE_ENABLED=true`
2. 除非想强制使用已知 widget，否则留空 `TURNSTILE_SITE_KEY`
3. 运行 `pnpm prepare:cloudflare:prod`
4. 仅在需要检查时才复制生成的值；运行时通过生成的配置和 secrets 获取

手动配置步骤：

1. 打开 Cloudflare 控制台
2. 进入 **Turnstile**
3. 创建 widget
4. 将 `APP_DOMAIN` 和可选的 `APP_CN_DOMAIN` 添加为允许的主机名
5. 将 site key 复制到 `TURNSTILE_SITE_KEY`
6. 将 secret key 复制到 `TURNSTILE_SECRET_KEY`
7. 再次运行 prepare

Turnstile 附加到邮件注册、邮件登录和密码重置请求端点。

文档：[Turnstile widget management](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/)、[Turnstile testing keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)

### Google OAuth

回调 URL：

```text
<APP_BASE_URL>/api/auth/callback/google
```

生产示例：

```text
https://app.example.com/api/auth/callback/google
```

本地示例：

```text
http://localhost:5173/api/auth/callback/google
```

配置步骤：

1. 打开 Google Cloud Console
2. 选择或创建项目
3. 配置 OAuth 同意屏幕
4. 创建类型为 **Web application** 的 OAuth client
5. 将上述回调 URL 添加到 **Authorized redirect URIs**
6. Google 要求时，将应用域名添加到 **Authorized domains**
7. 将 client ID 复制到 `GOOGLE_CLIENT_ID`
8. 将 client secret 复制到 `GOOGLE_CLIENT_SECRET`
9. 设置 `GOOGLE_AUTH_ENABLED=true`
10. 再次运行 prepare

Google 要求 redirect URI 完全匹配。scheme、host、port 或 path 不匹配会返回 `redirect_uri_mismatch`。

文档：[Google OAuth web server flow](https://developers.google.com/identity/protocols/oauth2/web-server)、[Google redirect URI setup](https://developers.google.com/identity/openid-connect/openid-connect)

### GitHub OAuth

回调 URL：

```text
<APP_BASE_URL>/api/auth/callback/github
```

生产示例：

```text
https://app.example.com/api/auth/callback/github
```

本地示例：

```text
http://localhost:5173/api/auth/callback/github
```

配置步骤：

1. 打开 GitHub
2. 进入 **Settings > Developer settings > OAuth Apps**
3. 创建新 OAuth App
4. 将 **Homepage URL** 设置为 `APP_BASE_URL`
5. 将 **Authorization callback URL** 设置为上述回调 URL
6. 将 client ID 复制到 `GITHUB_CLIENT_ID`
7. 生成 client secret 并填入 `GITHUB_CLIENT_SECRET`
8. 设置 `GITHUB_AUTH_ENABLED=true`
9. 再次运行 prepare

GitHub OAuth App 只有一个回调 URL。如果本地和生产需要同时工作，请为它们分别创建独立的 OAuth App。

文档：[GitHub OAuth App setup](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)

### LinuxDo OAuth

回调 URL：

```text
<APP_BASE_URL>/api/auth/oauth2/callback/linuxdo
```

生产示例：

```text
https://app.example.com/api/auth/oauth2/callback/linuxdo
```

本地示例：

```text
http://localhost:5173/api/auth/oauth2/callback/linuxdo
```

配置步骤：

1. 打开 LinuxDo OAuth 应用控制台
2. 创建 OAuth 应用
3. 设置上述回调 URL
4. 将 client ID 复制到 `LINUXDO_CLIENT_ID`
5. 将 client secret 复制到 `LINUXDO_CLIENT_SECRET`
6. 设置 `LINUXDO_AUTH_ENABLED=true`
7. 再次运行 prepare

运行时直接使用以下 LinuxDo 端点：

```text
https://connect.linux.do/oauth2/authorize
https://connect.linux.do/oauth2/token
https://connect.linux.do/api/user
```

LinuxDo 不向本应用提供真实邮件。映射后的用户邮件是合成的，因此密码重置和邮件验证不适用于 LinuxDo 账户流程。

## 邮件规则

`src/backend/api/middleware/email-auth.ts` 中的 `emailAuthMiddleware` 在所有 `/api/auth/*` 请求上运行，执行四条规则：

1. **OTP 登录拦截。** 路由 `/api/auth/sign-in/email-otp` 始终返回 400 `EMAIL_OTP_SIGN_IN_DISABLED`。

2. **注册门控。** 如果 `scene === 'signup'` 且 `EMAIL_SIGNUP_ENABLED` 不为 `'true'`，返回 400 `EMAIL_SIGNUP_DISABLED`。

3. **域名 allowlist。** `EMAIL_SIGNUP_DOMAIN_ALLOWLIST` 是分号分隔的允许注册域名列表。为空表示允许所有域名。域名不在列表中的注册邮件返回 400 `EMAIL_DOMAIN_NOT_ALLOWED`。

4. **每邮件冷却时间。** 每个 (scene, email) 对有一个由 `EMAIL_USER_ACTION_COOLDOWN_SECONDS` 控制的冷却窗口。冷却时间通过本地内存 `Map` 和 KV 双重追踪。KV 键为 `email:cooldown:{scene}:{sha256(email)}`。冷却期内返回 429 `EMAIL_ACTION_RATE_LIMITED`。

## 用户创建副作用

Better Auth 创建新用户时，在 `authCore` 中运行两个钩子：

**`create.before`** 在写入用户行之前运行：
- 调用 `aff.createCode()` 为新用户生成唯一的推广码
- 从请求头中读取 `registration_utm_source` cookie
- 将两个字段都添加到用户记录中

**`create.after`** 在写入用户行之后运行：
- 调用 `createTenantShardAccess(env, db).openUserDb(userId, region)` 将用户分配到租户分片。region 从 `request.cf.continent` 解析，使用与分片路由器相同的映射：`AS -> apac`、`EU -> weur`、`OC -> oc`，默认 `apac`
- 通过 `CreditsService.createBalance` 在租户分片 DB 中创建用户的积分余额
- 如果 `CREDITS_SIGNUP_ENABLED` 为 `'true'` 且 `CREDITS_SIGNUP_AMOUNT` 为正数，则以 `sourceType: 'signup'` 和 `sourceId: userId` 授予注册积分

这意味着认证创建是跨 DB 流程：用户行在 Meta DB，分片分配在 Meta DB（`user_shards`），积分余额在 Tenant Shard DB。没有跨 DB 事务。如果进程在 Meta 写入和 Shard 写入之间崩溃，用户存在但没有余额行。注册授予通过 `source_type + source_id` 保证幂等性。

## 会话管理

会话存储在 Meta DB 的 `session` 表中。Better Auth 处理会话创建和验证。`bearer` 插件启用 Bearer token 访问：客户端可以传递 `Authorization: Bearer <token>` 代替 cookie。

D1 读一致性由 `metaDbSessionMiddleware` 处理，该中间件在所有 `/api/*` 路由上运行。它从请求头 `x-d1-meta-bookmark` 或 cookie `d1_meta_bookmark` 解析 session bookmark，默认为 `first-primary`。请求完成后，将下一个 bookmark 写回响应头和 cookie。

```
带 bookmark 头/cookie 的请求
  |
  v
metaDbSessionMiddleware
  -- 解析 bookmark: header > cookie > 'first-primary'
  -- 将带会话的 MetaDb 挂载到 ctx
  |
  v
Handler 读写 Meta DB
  |
  v
中间件将下一个 bookmark 写入响应头 + cookie
```

会话有效期 30 天。Better Auth 在 27 天活跃后刷新会话。

## 路由保护

### authMiddleware

`src/backend/api/middleware/auth.ts`。使用请求头调用 `authCore().api.getSession()`。无会话时返回 401 `UNAUTHORIZED`。有会话时设置 `ctx.set('userId', session.user.id)` 并调用 `next()`。

### betaGateMiddleware

`src/backend/api/middleware/beta-gate.ts`。如果 `BETA_CODE_ENABLED` 为 `'true'`，在 Meta DB 中查询 `betaCode`，查找 `usedBy === userId` 的行。未找到则返回 403 `BETA_CODE_REQUIRED`。功能禁用时直接通过。

### tenantDbMiddleware

`src/backend/api/middleware/tenant-db.ts`。从 Meta DB 的 `user_shards` 解析用户分片，使用 bookmark 一致性打开 D1 会话，并设置 `ctx.set('tenantDb', ...)` 和 `ctx.set('tenantShardId', ...)`。

## 管理员访问

`src/backend/api/middleware/auth.ts` 中的 `adminUserMiddleware` 接受两种路径：

1. **API token。** 如果 `Authorization: Bearer <ADMIN_API_TOKEN>` 与配置的 secret 匹配，则在 Meta DB 中查找邮件等于 `SYSTEM_EMAIL` 的用户。如果找到，将 `userId` 设置为该用户的 id。未找到则返回 401 `UNAUTHORIZED`。

2. **超级管理员会话。** 解析 Better Auth 会话。如果会话用户的邮件等于 `SYSTEM_EMAIL`，设置 `userId`。否则返回 401。

`SYSTEM_EMAIL` 用户必须已存在于数据库中。token 路径不会创建用户。如果没有匹配 `SYSTEM_EMAIL` 的用户，即使 token 正确也会返回 401。

## 前端集成

前端不直接实例化 `createAuthClient`，而是从 `src/api-contract/client` 导入 `client`，该模块封装了 `createAuthClient` 并处理 bookmark、token 存储和类型化 API 方法。

```ts
import { client } from '$apiContract/client'

// 邮件登录
await client.auth.signIn.email({ email, password })

// 邮件注册
await client.auth.signUp.email({ email, password, name: email })

// 发送 OTP
await client.auth.emailOtp.sendVerificationOtp({ email, type: 'email-verification' })

// 验证邮件
await client.auth.emailOtp.verifyEmail({ email, otp })

// 社交登录
await client.auth.signIn.social({ provider: 'google' })
await client.auth.signIn.social({ provider: 'github' })
await client.auth.signIn.oauth2({ providerId: 'linuxdo' })

// 会话
const session = client.auth.useSession()

// 登出
await client.auth.signOut()
```

预构建的认证 UI 组件在 `src/frontend/lib/app-ui/auth/`：
- `LoginCard` 处理邮件登录和社交登录按钮
- `RegisterCard` 处理邮件注册并在需要时触发 OTP
- `OtpCard` 处理 OTP 输入和带冷却时间的重发
- `ForgotPasswordCard` 和 `ResetPasswordCard` 处理密码重置
- `Turnstile` 封装 Cloudflare Turnstile widget
- `UserMenu` 显示会话用户和登出

这些组件从 `clientConfig` 读取功能开关，决定渲染哪些登录方式。

## 配置

### 公开环境变量（.env.dev / .env.prod）

```bash
# 系统
SYSTEM_EMAIL=admin@example.com

# 内测门控
BETA_CODE_ENABLED=false

# 邮件
EMAIL_PROVIDER=cloudflare
EMAIL_SIGNUP_ENABLED=true
EMAIL_REQUIRE_VERIFICATION=false
EMAIL_SIGNUP_DOMAIN_ALLOWLIST=
EMAIL_USER_ACTION_COOLDOWN_SECONDS=50

# Turnstile
TURNSTILE_ENABLED=false
TURNSTILE_SITE_KEY=

# OAuth providers（公开 client ID）
GOOGLE_AUTH_ENABLED=false
GOOGLE_CLIENT_ID=
GITHUB_AUTH_ENABLED=false
GITHUB_CLIENT_ID=
LINUXDO_AUTH_ENABLED=false
LINUXDO_CLIENT_ID=

# 注册积分授予
CREDITS_SIGNUP_ENABLED=false
CREDITS_SIGNUP_AMOUNT=100
```

### 密钥环境变量（.env.secret.dev / .env.secret.prod）

```bash
BETTER_AUTH_SECRET=
ADMIN_API_TOKEN=
EMAIL_RESEND_API_KEY=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_SECRET=
LINUXDO_CLIENT_SECRET=
TURNSTILE_SECRET_KEY=
```

`EMAIL_PROVIDER` 接受 `cloudflare` 或 `resend`。设置为 `resend` 时，密钥文件中必须有 `EMAIL_RESEND_API_KEY`。

## 常见错误

**尝试通过 OTP 登录。** 路由 `/api/auth/sign-in/email-otp` 被中间件硬拦截。OTP 只用于验证和密码重置，不用于登录。

**假设 LinuxDo 用户有真实邮件。** 邮件合成为 `linuxdo-{id}@linuxdo.local`。密码重置等基于邮件的功能对 LinuxDo 用户无效。

**忘记管理员访问需要 SYSTEM_EMAIL 用户存在。** 即使 `ADMIN_API_TOKEN` 正确，如果数据库中没有匹配 `SYSTEM_EMAIL` 的用户行，仍会返回 401。

**期望注册时有跨 DB 事务。** 用户创建分别写入 Meta DB 和 Tenant Shard DB。如果进程在两者之间崩溃，用户存在但没有积分余额。这是设计如此。

**将 registration_utm_source 作为 URL 参数传递。** 钩子从 `registration_utm_source` cookie 读取，不从请求 URL 读取。
