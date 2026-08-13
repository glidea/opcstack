---
title: 认证
description: Better Auth、邮件 OAuth、Turnstile、会话、管理员访问与前端集成
group: Guides
group_order: 1
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

公开 API 链（`publicApi`）只为 `/api/auth/*` 路径挂载 `emailAuthMiddleware`。受保护 JSON 路由接受 Better Auth 浏览器 Session 或 OAuth Bearer Token，并校验路由注册的业务 scope。管理员路由还通过 `administratorMiddleware` 复核当前用户的 D1 管理员角色。

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

由 Meta D1 中的 Authentication 和 Email 配置文档控制。`registrationEnabled` 统一控制所有首次建号，包括第三方 OAuth。邮件密码注册本身不依赖 Email Provider；只有要求邮件验证时才必须配置 Provider。需要验证时，前端在注册后调用 `sendVerificationOtp` 发送 6 位验证码。

```
用户输入邮件 + 密码
  |
  v
POST /api/auth/sign-up/email
  -- 注册开启时创建用户
  |
  v
POST /api/auth/email-otp/send-verification-otp  (启用验证时)
  -- 发送 6 位 OTP 到邮件
  |
  v
POST /api/auth/email-otp/verify-email
  -- 标记 emailVerified=true
```

`buildPasswordHasher` 中的密码哈希器使用 `crypto.subtle.digest('SHA-1', ...)` 配合随机 8 字节盐。哈希格式为 `saltHex:keyHex`。

## OAuth API 访问

模板内置一个固定公共 OAuth Client：`opc-cli`。它使用 Authorization Code + PKCE，没有 Client Secret。CLI 负责设备授权轮询、授权码交换、Refresh Token 轮换，并按连接名称保存凭据。

每个受保护 JSON 路由都必须在 `src/backend/api/scopes.ts` 注册一个业务 scope。`authMiddleware` 接受浏览器 Session 或 OAuth Bearer Token。`requireApiScope(scope)` 允许浏览器 Session 直接通过，并要求 OAuth Grant 包含对应 scope。管理员和配置 scope 还会通过 `administratorMiddleware` 复核当前 D1 角色。

```text
opc auth connect --name shop-prod --server https://app.example.com --scopes config:ai:read,config:ai:write
opc api request --name shop-prod --method POST --url /api/admin/get_ai_config --body '{}'
opc auth status --name shop-prod
opc auth disconnect --name shop-prod
```

`opc api request` 只接受相对路径，自动注入 Bearer Token，拒绝调用方传入 `Authorization`，并在需要时刷新指定连接。刷新失败只删除该连接。

`/oauth/authorize` 和 `/oauth/consent` 是浏览器授权页面。确认页展示 Client 名称、目标项目地址和申请的业务 scope。固定传输 scope `api_access offline_access` 只是协议细节。

设置页统一展示 API Grant 和账号安全控制。撤销一个 Grant 不会退出浏览器登录，但会通过 D1 Grant 检查立即阻止已有 Access Token，并撤销该 Grant 关联的全部 Refresh Token。

### 邮件 OTP

邮件 OTP 是插件级功能，不是登录方式。插件配置中的 `disableSignUp: true` 意味着 OTP 不能创建新用户。OTP 登录路由被 `emailAuthMiddleware` 硬拦截：

```ts
if (ctx.req.path === '/api/auth/sign-in/email-otp') {
    return ctx.json({ code: 'EMAIL_OTP_SIGN_IN_DISABLED' }, 400)
}
```

OTP 用于注册后邮件验证和密码重置。OTP 为 6 位数字，300 秒后过期，允许 3 次尝试。OTP 以哈希形式存储。

### Google OAuth

在 Authentication 配置中启用。Client ID 和 Secret 配置原生 Google 社交 provider。回调 URI 为 `https://your-domain.com/api/auth/callback/google`。

### GitHub OAuth

在 Authentication 配置中启用。与 Google 相同的原生社交 provider 模式。回调 URI 为 `https://your-domain.com/api/auth/callback/github`。

### LinuxDo OAuth

在 Authentication 配置中启用。使用 `genericOAuth` 插件，因为 LinuxDo 不是 Better Auth 的原生 provider。Profile 映射将 LinuxDo 用户 id 转换为合成邮件：

```ts
email: `linuxdo-${id}@linuxdo.local`
```

这个邮件不是真实邮件，只用于确保 `user` 表中的唯一性。`mapProfileToUser` 函数还从 `avatar_template` 字段构建头像 URL。

## 平台配置

使用 `APP_BASE_URL` 作为回调 URL 的事实来源。生产环境解析为 `https://<APP_DOMAIN>`。本地开发时 `APP_DOMAIN=localhost`，解析为 `http://localhost:5173`。

| 平台 | 控制台操作 | OPCStack 配置 |
| --- | --- | --- |
| Cloudflare Email Service | 接入发送域名，使用生成的 `SEND_EMAIL` binding | Email Tab：Cloudflare provider；管理员邮箱作为发件人 |
| Resend | 验证发送域名，创建带发送权限的 API key | Email Tab：Resend provider 和 API key；管理员邮箱作为发件人 |
| Cloudflare Turnstile | 为 `APP_DOMAIN` 和可选的 `APP_CN_DOMAIN` 创建或复用 widget | Authentication Tab：启用开关 |
| Google OAuth | 创建 Web application OAuth client | Authentication Tab：client ID、client secret 和启用开关 |
| GitHub OAuth | 创建 OAuth App | Authentication Tab：client ID、client secret 和启用开关 |
| LinuxDo OAuth | 在 LinuxDo 控制台创建 OAuth 应用 | Authentication Tab：client ID、client secret 和启用开关 |

### Cloudflare Email Service

Worker 在 `wrangler.jsonc.tpl` 中已有名为 `SEND_EMAIL` 的 `send_email` binding，不要再添加新的 binding。

配置步骤：

1. 打开 Cloudflare 控制台
2. 进入 **Compute > Email Service > Email Sending**
3. 选择 **Onboard Domain**，选择管理员邮箱使用的域名
4. 让 Cloudflare 创建所需的 SPF、DKIM、DMARC 和 bounce 记录
5. 等待发送域名激活
6. 首次准备前将 `SYSTEM_EMAIL` 设为接入域名上的地址
7. 打开后台 Configuration 的 Email Tab，选择 Cloudflare 并保存

如果需要本地真实发送而不依赖 Cloudflare 远端邮件行为，使用 Resend。

文档：[Cloudflare Email Service](https://developers.cloudflare.com/email-service/get-started/send-emails/)、[Workers send email binding](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/)

### Resend

配置步骤：

1. 打开 Resend 控制台
2. 添加并验证发送域名
3. 创建带发送权限的 API key
4. 首次准备前将 `SYSTEM_EMAIL` 设为已验证域名上的地址
5. 打开后台 Configuration 的 Email Tab
6. 选择 Resend，填写 API key 并保存

`from` 地址始终是首次准备时创建的 D1 管理员邮箱。如果 Resend 拒绝邮件，先修复发件域名，并用正确的 `SYSTEM_EMAIL` 初始化新部署。

文档：[Resend domains](https://resend.com/docs/dashboard/domains/introduction)、[Resend API keys](https://resend.com/docs/create-an-api-key)

### Cloudflare Turnstile

首次生产初始化时，`prepare-cloudflare` 会为 `APP_DOMAIN` 和可选的 `APP_CN_DOMAIN` 创建或复用一个名为 `APP_NAME` 的 Turnstile widget，并把 site key 和加密后的 secret 写入默认禁用的 Authentication 配置。本地初始化使用 Cloudflare 测试凭据。

正常生产步骤：

1. 部署应用
2. 打开后台 Configuration 的 Authentication Tab
3. 启用 Turnstile 并保存，生成的凭据已经存在

手动配置步骤：

1. 打开 Cloudflare 控制台
2. 进入 **Turnstile**
3. 创建 widget
4. 将 `APP_DOMAIN` 和可选的 `APP_CN_DOMAIN` 添加为允许的主机名
5. 打开 Authentication Tab，启用或关闭 Turnstile 并保存

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
7. 打开后台 Configuration 的 Authentication Tab
8. 填写 client ID 和 client secret，启用 Google 并保存

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
6. 打开后台 Configuration 的 Authentication Tab
7. 填写 client ID 和生成的 client secret，启用 GitHub 并保存

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
4. 打开后台 Configuration 的 Authentication Tab
5. 填写 client ID 和 client secret，启用 LinuxDo 并保存

运行时直接使用以下 LinuxDo 端点：

```text
https://connect.linux.do/oauth2/authorize
https://connect.linux.do/oauth2/token
https://connect.linux.do/api/user
```

LinuxDo 不向本应用提供真实邮件。映射后的用户邮件是合成的，因此密码重置和邮件验证不适用于 LinuxDo 账户流程。

## 邮件规则

`src/backend/api/middleware/email-auth.ts` 中的 `emailAuthMiddleware` 在所有 `/api/auth/*` 请求上运行，执行五条规则：

1. **OTP 登录拦截。** 路由 `/api/auth/sign-in/email-otp` 始终返回 400 `EMAIL_OTP_SIGN_IN_DISABLED`。

2. **注册门控。** 关闭注册时，邮件注册返回 `REGISTRATION_DISABLED`。Better Auth 用户创建钩子对首次第三方 OAuth 建号执行同一规则。

3. **邮件服务可用性。** 未配置 Provider 时，邮件验证、密码重置和其他发信操作返回 `EMAIL_PROVIDER_UNAVAILABLE`。登录页从同一状态派生并隐藏忘记密码入口。账号邮箱不可修改。

4. **域名 allowlist。** Authentication 配置保存允许注册的域名列表。为空表示允许所有域名。域名不在列表中的注册邮件返回 400 `EMAIL_DOMAIN_NOT_ALLOWED`。

5. **每邮件冷却时间。** 每个 (scene, email) 对的冷却窗口由 Authentication 配置控制。冷却时间通过本地内存 `Map` 和 KV 双重追踪。KV 键为 `email:cooldown:{scene}:{sha256(email)}`。冷却期内返回 429 `EMAIL_ACTION_RATE_LIMITED`。

## 用户创建副作用

Better Auth 创建新用户时，在 `authCore` 中运行两个钩子：

**`create.before`** 在写入用户行之前运行：
- 关闭注册时以 `REGISTRATION_DISABLED` 拒绝所有首次建号
- 调用 `aff.createCode()` 为新用户生成唯一的推广码
- 从请求头中读取 `registration_utm_source` cookie
- 将两个字段都添加到用户记录中

**`create.after`** 在写入用户行之后运行：
- 调用 `createTenantShardAccess(env, db).openUserDb(userId, region)` 将用户分配到租户分片。region 从 `request.cf.continent` 解析，使用与分片路由器相同的映射：`AS -> apac`、`EU -> weur`、`OC -> oc`，默认 `apac`
- 通过 `CreditsService.createBalance` 在租户分片 DB 中创建用户的积分余额
- 从 Meta D1 读取一次 Credits 配置快照；启用注册奖励时，以 `sourceType: 'signup'` 和 `sourceId: userId` 授予配置金额

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

`src/backend/api/middleware/beta-gate.ts`。Authentication 配置启用内测门控时，在 Meta DB 中查询 `betaCode`，查找 `usedBy === userId` 的行。未找到则返回 403 `BETA_CODE_REQUIRED`。功能禁用时直接通过。

### tenantDbMiddleware

`src/backend/api/middleware/tenant-db.ts`。从 Meta DB 的 `user_shards` 解析用户分片，使用 bookmark 一致性打开 D1 会话，并设置 `ctx.set('tenantDb', ...)` 和 `ctx.set('tenantShardId', ...)`。

## 管理员访问

`src/backend/api/middleware/auth.ts` 中的 `administratorMiddleware` 会对浏览器 Session 和 OAuth 访问统一检查当前用户的 D1 角色。用户不是管理员时返回 403 `FORBIDDEN`。

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

Authentication 和 Email 配置只保存在 Meta D1 的 `system_settings` 记录中。打开后台 Configuration，编辑单个 Tab 并显式保存。每次保存都会校验完整业务域，成功后无需重新部署，后续请求立即生效。

Authentication Tab 管理注册策略、内测门控、邮件验证、Turnstile 开关，以及 Google、GitHub 和 LinuxDo 凭据。Turnstile 凭据由初始化流程写入，不能在此页面修改。Email Tab 管理 Provider 和 Resend API key。Provider 是否存在是邮件能力的单一状态源，不再有独立邮件开关。读取密钥时只返回是否已配置；替换或删除 OAuth 或邮件密钥都是显式保存动作。

管理员身份、公开支持地址和发件人地址都读取唯一 D1 管理员账号。首次准备使用 `SYSTEM_EMAIL` 创建账号，生成随机密码并只打印一次凭据。后续准备不会覆盖邮箱或密码。`BETTER_AUTH_SECRET` 和 `CONFIG_ENCRYPTION_KEY` 由 `prepare-cloudflare` 自动生成，用户不配置。

## 常见错误

**尝试通过 OTP 登录。** 路由 `/api/auth/sign-in/email-otp` 被中间件硬拦截。OTP 只用于验证和密码重置，不用于登录。

**假设 LinuxDo 用户有真实邮件。** 邮件合成为 `linuxdo-{id}@linuxdo.local`。密码重置等基于邮件的功能对 LinuxDo 用户无效。

**首次管理员使用未验证的发件地址。** 首次准备前将 `SYSTEM_EMAIL` 设为已验证发送域名上的地址。后续准备不会覆盖 D1 管理员邮箱或密码。

**期望注册时有跨 DB 事务。** 用户创建分别写入 Meta DB 和 Tenant Shard DB。如果进程在两者之间崩溃，用户存在但没有积分余额。这是设计如此。

**将 registration_utm_source 作为 URL 参数传递。** 钩子从 `registration_utm_source` cookie 读取，不从请求 URL 读取。
