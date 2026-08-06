---
title: Authentication
description: Better Auth, email OAuth, Turnstile, session, admin access, and frontend integration
group: Guides
group_order: 1
order: 1
---

# Authentication

OPCStack uses [Better Auth](https://www.better-auth.com/) for authentication. Auth state lives in the global Meta DB, not in tenant shards, because the system must resolve a user identity without knowing their shard. Multiple sign-in methods are supported: email with password, email OTP verification, Google, GitHub, and LinuxDo OAuth.

## Auth Model

`src/backend/api/auth/index.ts` exports `authCore(env, db)`, which builds the Better Auth instance. The instance combines several Better Auth plugins:

- `bearer` enables Bearer token access for API clients
- `emailOTP` handles verification codes and password reset flows
- `captcha` adds Cloudflare Turnstile protection on sign-up and password reset endpoints
- `genericOAuth` powers the LinuxDo social login

Email and password is not a plugin. It is a native Better Auth provider configured in the `emailAndPassword` field. Google and GitHub are native social providers configured in `socialProviders`.

Session expiry is 30 days with a refresh at 27 days. The password hasher uses the Workers runtime `crypto.subtle` with SHA-1 and a random salt, not the pure-JS fallback.

## Request Routing

All auth-related HTTP goes through the `/api/*` prefix. Three layers of middleware run in order before your handler:

```
Client request
  |
  v
/metaDbSessionMiddleware (/api/*)
  -- injects ctx.get('metaDb') with a D1 session bookmark
  |
  v
/emailAuthMiddleware (/api/auth/*)
  -- blocks OTP sign-in, checks signup, allowlist, cooldown
  |
  v
Better Auth handler (/api/auth/*)
  -- delegates to authCore().handler
  |
  v
/authMiddleware + betaGateMiddleware + tenantDbMiddleware (/api/*, authenticated routes)
  -- validates session, sets userId, checks beta code, attaches tenantDb
```

The public API chain (`publicApi`) only mounts `emailAuthMiddleware` for `/api/auth/*` paths. The authenticated user API chain (`userApi`) mounts `authMiddleware`, `betaGateMiddleware`, and `tenantDbMiddleware` in that order. The admin API chain (`adminApi`) uses `adminUserMiddleware` instead of the user chain.

## Auth Data Ownership

Auth schema is defined in `src/backend/db/schema.auth.ts` and lives in the Meta DB. Four tables:

| Table | Purpose |
| --- | --- |
| `user` | User identity: id, name, email, emailVerified, image, affCode, registrationUtmSource |
| `session` | Session token, expiry, userId reference |
| `account` | Provider accounts: email/password, Google, GitHub, LinuxDo. Multiple per user |
| `verification` | Email OTPs and verification tokens |

Auth tables do not live in tenant shards because the request layer needs to resolve identity before knowing the shard. `account` supports multiple rows per user, one per provider.

## Sign-in Methods

### Email and Password

Controlled by `EMAIL_SIGNUP_ENABLED` and `EMAIL_REQUIRE_VERIFICATION`. When signup is enabled, users register with email and password. When verification is required, the frontend calls `sendVerificationOtp` after signup to send a 6-digit code.

```
User enters email + password
  |
  v
POST /api/auth/sign-up/email
  -- creates user (disabled if EMAIL_SIGNUP_ENABLED=false)
  |
  v
POST /api/auth/email-otp/send-verification-otp  (if EMAIL_REQUIRE_VERIFICATION=true)
  -- sends 6-digit OTP to email
  |
  v
POST /api/auth/email-otp/verify-email
  -- marks emailVerified=true
```

The password hasher in `buildPasswordHasher` uses `crypto.subtle.digest('SHA-1', ...)` with a random 8-byte salt. The hash format is `saltHex:keyHex`.

## Agent Delegated Authorization

The template includes a fixed public OAuth client for headless Agents. The CLI owns PKCE, relay polling, token exchange, refresh rotation, and the local credential file. Tokens are never passed to the language model or printed by the CLI.

### Expose an API to Agents

Business scopes are application-owned strings. The template does not ship a scope registry or typed business API client. Add `requireAgentScope(scope)` only to routes that may be called by an Agent:

Register the route in `src/backend/api/index.ts`:

```ts
import { Hono } from 'hono'
import { authMiddleware, requireAgentScope } from './middleware/auth'
import { betaGateMiddleware } from './middleware/beta-gate'
import { tenantDbMiddleware } from './middleware/tenant-db'

const agentApi: Hono<ApiEnv> = new Hono<ApiEnv>()

agentApi.post(
	'/reports/query',
	authMiddleware,
	requireAgentScope('reports:read'),
	betaGateMiddleware,
	tenantDbMiddleware,
	reportsQueryHandler
)

api.route('/api', agentApi)
```

The handler keeps using the same user identity:

```ts
const userId: string = ctx.get('userId')
const agentAuthorization = ctx.get('agentAuthorization')
```

Do not add `browserSessionOnlyMiddleware` to an Agent-enabled route. Keep `browserSessionOnlyMiddleware` on every route that is not explicitly opened to Agents.

### Connect From an Agent Host

```text
opc auth connect --server https://app.example.com --scopes reports:read,reports:write
opc api request --method POST --url /api/reports/query --body '{"range":"7d"}'
```

The generic request command injects the Bearer token, rejects caller-supplied `Authorization`, refreshes once on expiry, and sends the token only to the configured server origin. Query parameters, JSON body, and ordinary headers are supplied by the caller:

```text
opc api request \\
  --method POST \\
  --url /api/reports/query \\
  --query '{"page":1}' \\
  --body '{"range":"7d"}' \\
  --header 'x-request-id:demo'
```

### User-Facing Pages

`/agent/authorize` is the browser entry opened by the CLI. It resolves the `user_code`, asks the user to sign in if needed, and continues the OAuth authorization flow.

`/agent/consent` shows the application scopes stored on the Agent authorization request, such as `reports:read`. The fixed OAuth transport scopes `agent offline_access` are internal and are not shown as business permissions.

`/{locale}/settings/agents` lists connected Agent grants and lets the user revoke one grant without logging out their browser session. Revocation stops refresh immediately, and API middleware rejects already issued Agent access tokens because it checks the grant on every request.

### Email OTP

Email OTP is a plugin-level feature, not a login method. `disableSignUp: true` in the plugin config means OTP cannot create a new user. The OTP sign-in route is hard-blocked by `emailAuthMiddleware`:

```ts
if (ctx.req.path === '/api/auth/sign-in/email-otp') {
    return ctx.json({ code: 'EMAIL_OTP_SIGN_IN_DISABLED' }, 400)
}
```

OTP is used for three flows: email verification after signup, password reset, and email change. The OTP is 6 digits, expires in 300 seconds, and allows 3 attempts. OTPs are stored hashed.

### Google OAuth

Enabled by `GOOGLE_AUTH_ENABLED`. The client ID and secret configure the native Google social provider. Redirect URI is `https://your-domain.com/api/auth/callback/google`.

### GitHub OAuth

Enabled by `GITHUB_AUTH_ENABLED`. Same native social provider pattern as Google. Redirect URI is `https://your-domain.com/api/auth/callback/github`.

### LinuxDo OAuth

Enabled by `LINUXDO_AUTH_ENABLED`. Uses the `genericOAuth` plugin because LinuxDo is not a native Better Auth provider. Profile mapping converts the LinuxDo user id into a synthetic email:

```ts
email: `linuxdo-${id}@linuxdo.local`
```

This email is not real. It only ensures uniqueness in the `user` table. The `mapProfileToUser` function also builds the avatar URL from the `avatar_template` field.

## Platform Setup

Use `APP_BASE_URL` as the source of truth for callback URLs. In production it resolves to `https://<APP_DOMAIN>`. In local dev with `APP_DOMAIN=localhost`, it resolves to `http://localhost:5173`.

| Platform | Dashboard action | Env keys |
| --- | --- | --- |
| Cloudflare Email Service | Onboard the sending domain, then use the generated `SEND_EMAIL` binding | `EMAIL_PROVIDER=cloudflare`, `SYSTEM_EMAIL` |
| Resend | Verify the sending domain, create an API key with sending permission | `EMAIL_PROVIDER=resend`, `EMAIL_RESEND_API_KEY`, `SYSTEM_EMAIL` |
| Cloudflare Turnstile | Create or reuse a widget for `APP_DOMAIN` and optional `APP_CN_DOMAIN` | `TURNSTILE_ENABLED`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` |
| Google OAuth | Create a Web application OAuth client | `GOOGLE_AUTH_ENABLED`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| GitHub OAuth | Create an OAuth App | `GITHUB_AUTH_ENABLED`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |
| LinuxDo OAuth | Create an OAuth application in the LinuxDo console | `LINUXDO_AUTH_ENABLED`, `LINUXDO_CLIENT_ID`, `LINUXDO_CLIENT_SECRET` |

### Cloudflare Email Service

Use this when `EMAIL_PROVIDER=cloudflare`. The Worker already has a `send_email` binding named `SEND_EMAIL` in `wrangler.jsonc.tpl`; do not add another binding.

Platform steps:

1. Open Cloudflare dashboard.
2. Go to **Compute > Email Service > Email Sending**.
3. Select **Onboard Domain** and choose the domain used by `SYSTEM_EMAIL`.
4. Let Cloudflare create the required SPF, DKIM, DMARC, and bounce records.
5. Wait until the sending domain is active.
6. Set `EMAIL_PROVIDER=cloudflare`.
7. Set `SYSTEM_EMAIL` to an address on the onboarded domain.
8. Run `pnpm prepare:cloudflare:prod` before deployment.

Use Resend if you need local real delivery without depending on Cloudflare remote email behavior.

Docs: [Cloudflare Email Service](https://developers.cloudflare.com/email-service/get-started/send-emails/), [Workers send email binding](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/)

### Resend

Use this when `EMAIL_PROVIDER=resend`.

Platform steps:

1. Open Resend dashboard.
2. Add and verify the sending domain.
3. Create an API key with sending access.
4. Set `EMAIL_PROVIDER=resend`.
5. Set `SYSTEM_EMAIL` to an address on the verified domain.
6. Put the API key in `EMAIL_RESEND_API_KEY`.
7. Run `pnpm prepare:cloudflare:dev` or `pnpm prepare:cloudflare:prod`.

The `from` address is always `SYSTEM_EMAIL`. If Resend rejects mail, fix the sender domain first. Do not work around it in code.

Docs: [Resend domains](https://resend.com/docs/dashboard/domains/introduction), [Resend API keys](https://resend.com/docs/create-an-api-key)

### Cloudflare Turnstile

`prepare-cloudflare` can manage this in production. When `TURNSTILE_ENABLED=true` and the prepare command runs in prod mode, it creates or reuses one Turnstile widget named `APP_NAME` for `APP_DOMAIN` and optional `APP_CN_DOMAIN`.

Normal production steps:

1. Set `TURNSTILE_ENABLED=true`.
2. Leave `TURNSTILE_SITE_KEY` empty unless you want to force a known widget.
3. Run `pnpm prepare:cloudflare:prod`.
4. Copy generated values only if you need to inspect them; the runtime gets them through generated config and secrets.

Manual setup steps:

1. Open Cloudflare dashboard.
2. Go to **Turnstile**.
3. Create a widget.
4. Add `APP_DOMAIN` and optional `APP_CN_DOMAIN` as allowed hostnames.
5. Copy the site key to `TURNSTILE_SITE_KEY`.
6. Copy the secret key to `TURNSTILE_SECRET_KEY`.
7. Run prepare again.

Turnstile is attached to email sign-up, email sign-in, and password reset request endpoints.

Docs: [Turnstile widget management](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/), [Turnstile testing keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)

### Google OAuth

Callback URL:

```text
<APP_BASE_URL>/api/auth/callback/google
```

Production example:

```text
https://app.example.com/api/auth/callback/google
```

Local example:

```text
http://localhost:5173/api/auth/callback/google
```

Platform steps:

1. Open Google Cloud Console.
2. Select or create a project.
3. Configure the OAuth consent screen.
4. Create an OAuth client of type **Web application**.
5. Add the callback URL above to **Authorized redirect URIs**.
6. Add the app domain to **Authorized domains** when Google requires it.
7. Copy the client ID to `GOOGLE_CLIENT_ID`.
8. Copy the client secret to `GOOGLE_CLIENT_SECRET`.
9. Set `GOOGLE_AUTH_ENABLED=true`.
10. Run prepare again.

Google requires the redirect URI to match exactly. A scheme, host, port, or path mismatch returns `redirect_uri_mismatch`.

Docs: [Google OAuth web server flow](https://developers.google.com/identity/protocols/oauth2/web-server), [Google redirect URI setup](https://developers.google.com/identity/openid-connect/openid-connect)

### GitHub OAuth

Callback URL:

```text
<APP_BASE_URL>/api/auth/callback/github
```

Production example:

```text
https://app.example.com/api/auth/callback/github
```

Local example:

```text
http://localhost:5173/api/auth/callback/github
```

Platform steps:

1. Open GitHub.
2. Go to **Settings > Developer settings > OAuth Apps**.
3. Create a new OAuth App.
4. Set **Homepage URL** to `APP_BASE_URL`.
5. Set **Authorization callback URL** to the callback URL above.
6. Copy the client ID to `GITHUB_CLIENT_ID`.
7. Generate a client secret and put it in `GITHUB_CLIENT_SECRET`.
8. Set `GITHUB_AUTH_ENABLED=true`.
9. Run prepare again.

GitHub OAuth Apps have one callback URL. Use a separate OAuth App for local and production if both need to work at the same time.

Docs: [GitHub OAuth App setup](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)

### LinuxDo OAuth

Callback URL:

```text
<APP_BASE_URL>/api/auth/oauth2/callback/linuxdo
```

Production example:

```text
https://app.example.com/api/auth/oauth2/callback/linuxdo
```

Local example:

```text
http://localhost:5173/api/auth/oauth2/callback/linuxdo
```

Platform steps:

1. Open the LinuxDo OAuth application console.
2. Create an OAuth application.
3. Set the callback URL above.
4. Copy the client ID to `LINUXDO_CLIENT_ID`.
5. Copy the client secret to `LINUXDO_CLIENT_SECRET`.
6. Set `LINUXDO_AUTH_ENABLED=true`.
7. Run prepare again.

The runtime uses these LinuxDo endpoints directly:

```text
https://connect.linux.do/oauth2/authorize
https://connect.linux.do/oauth2/token
https://connect.linux.do/api/user
```

LinuxDo does not provide a real email to this app. The mapped user email is synthetic, so password reset and email verification are not valid LinuxDo account flows.

## Email Rules

`emailAuthMiddleware` in `src/backend/api/middleware/email-auth.ts` runs on all `/api/auth/*` requests and enforces four rules:

1. **OTP sign-in block.** The route `/api/auth/sign-in/email-otp` always returns 400 `EMAIL_OTP_SIGN_IN_DISABLED`.

2. **Signup gate.** If `scene === 'signup'` and `EMAIL_SIGNUP_ENABLED` is not `'true'`, returns 400 `EMAIL_SIGNUP_DISABLED`.

3. **Domain allowlist.** `EMAIL_SIGNUP_DOMAIN_ALLOWLIST` is a semicolon-separated list of allowed signup domains. Empty means all domains allowed. A signup email whose domain is not in the list gets 400 `EMAIL_DOMAIN_NOT_ALLOWED`.

4. **Per-email cooldown.** Each (scene, email) pair has a cooldown window controlled by `EMAIL_USER_ACTION_COOLDOWN_SECONDS`. The cooldown is tracked in both a local in-memory `Map` and in KV. The KV key is `email:cooldown:{scene}:{sha256(email)}`. Within the cooldown, returns 429 `EMAIL_ACTION_RATE_LIMITED`.

## User Creation Side Effects

When Better Auth creates a new user, two hooks run in `authCore`:

**`create.before`** runs before the user row is written:
- Calls `aff.createCode()` to generate a unique affiliate code for the new user
- Reads the `registration_utm_source` cookie from the request headers
- Adds both fields to the user record

**`create.after`** runs after the user row is written:
- Calls `createTenantShardAccess(env, db).openUserDb(userId, region)` to assign the user to a tenant shard. The region is resolved from `request.cf.continent` using the same mapping as the shard router: `AS -> apac`, `EU -> weur`, `OC -> oc`, default `apac`
- Creates the user's credit balance in the tenant shard DB via `CreditsService.createBalance`
- If `CREDITS_SIGNUP_ENABLED` is `'true'` and `CREDITS_SIGNUP_AMOUNT` is positive, grants signup credits with `sourceType: 'signup'` and `sourceId: userId`

This means auth creation is a cross-DB flow: User row in Meta DB, shard assignment in Meta DB (`user_shards`), credit balance in Tenant Shard DB. There is no cross-DB transaction. If the process crashes between Meta write and Shard write, the user exists but has no balance row. The signup grant is idempotent by `source_type + source_id`.

## Session Management

Sessions are stored in the `session` table in Meta DB. Better Auth handles session creation and verification. The `bearer` plugin enables Bearer token access: clients can pass `Authorization: Bearer <token>` instead of a cookie.

D1 read consistency is handled by `metaDbSessionMiddleware`, which runs on all `/api/*` routes. It resolves a session bookmark from the request header `x-d1-meta-bookmark` or the cookie `d1_meta_bookmark`, defaulting to `first-primary`. After the request completes, it writes the next bookmark back to the response header and cookie.

```
Request with bookmark header/cookie
  |
  v
metaDbSessionMiddleware
  -- resolves bookmark: header > cookie > 'first-primary'
  -- attaches session-backed MetaDb to ctx
  |
  v
Handler reads/writes Meta DB
  |
  v
middleware writes next bookmark to response header + cookie
```

Session expiry is 30 days. Better Auth refreshes the session after 27 days of activity.

## Route Protection

### authMiddleware

`src/backend/api/middleware/auth.ts`. Calls `authCore().api.getSession()` with the request headers. If no session, returns 401 `UNAUTHORIZED`. If session exists, sets `ctx.set('userId', session.user.id)` and calls `next()`.

### betaGateMiddleware

`src/backend/api/middleware/beta-gate.ts`. If `BETA_CODE_ENABLED` is `'true'`, queries `betaCode` in Meta DB for a row where `usedBy === userId`. If none found, returns 403 `BETA_CODE_REQUIRED`. If the feature is disabled, it passes through.

### tenantDbMiddleware

`src/backend/api/middleware/tenant-db.ts`. Resolves the user's shard from `user_shards` in Meta DB, opens a D1 session with bookmark consistency, and sets `ctx.set('tenantDb', ...)` and `ctx.set('tenantShardId', ...)`.

## Admin Access

`adminUserMiddleware` in `src/backend/api/middleware/auth.ts` accepts two paths:

1. **API token.** If `Authorization: Bearer <ADMIN_API_TOKEN>` matches the configured secret, it looks up the user whose email equals `SYSTEM_EMAIL` in Meta DB. If found, sets `userId` to that user's id. If not found, returns 401 `UNAUTHORIZED`.

2. **Super admin session.** Resolves the Better Auth session. If the session user's email equals `SYSTEM_EMAIL`, sets `userId`. Otherwise 401.

The `SYSTEM_EMAIL` user must already exist in the database. The token path does not create it. If no user with that email exists, even a correct token returns 401.

## Frontend Integration

The frontend does not instantiate `createAuthClient` directly. It imports `client` from `src/api-contract/client`, which wraps `createAuthClient` with bookmark handling, token storage, and typed API methods.

```ts
import { client } from '$apiContract/client'

// Sign in with email
await client.auth.signIn.email({ email, password })

// Sign up with email
await client.auth.signUp.email({ email, password, name: email })

// Send OTP
await client.auth.emailOtp.sendVerificationOtp({ email, type: 'email-verification' })

// Verify email
await client.auth.emailOtp.verifyEmail({ email, otp })

// Social sign in
await client.auth.signIn.social({ provider: 'google' })
await client.auth.signIn.social({ provider: 'github' })
await client.auth.signIn.oauth2({ providerId: 'linuxdo' })

// Session
const session = client.auth.useSession()

// Sign out
await client.auth.signOut()
```

Pre-built auth UI components live in `src/frontend/lib/app-ui/auth/`:
- `LoginCard` handles email login and social buttons
- `RegisterCard` handles email signup and triggers OTP if required
- `OtpCard` handles OTP input and resend with cooldown
- `ForgotPasswordCard` and `ResetPasswordCard` handle password reset
- `Turnstile` wraps the Cloudflare Turnstile widget
- `UserMenu` shows the session user and sign-out

These components read feature flags from `clientConfig` to decide which sign-in methods to render.

## Config

### Public env (.env.dev / .env.prod)

```bash
# System
SYSTEM_EMAIL=admin@example.com

# Beta gate
BETA_CODE_ENABLED=false

# Email
EMAIL_PROVIDER=cloudflare
EMAIL_SIGNUP_ENABLED=true
EMAIL_REQUIRE_VERIFICATION=false
EMAIL_SIGNUP_DOMAIN_ALLOWLIST=
EMAIL_USER_ACTION_COOLDOWN_SECONDS=50

# Turnstile
TURNSTILE_ENABLED=false
TURNSTILE_SITE_KEY=

# OAuth providers (public client IDs)
GOOGLE_AUTH_ENABLED=false
GOOGLE_CLIENT_ID=
GITHUB_AUTH_ENABLED=false
GITHUB_CLIENT_ID=
LINUXDO_AUTH_ENABLED=false
LINUXDO_CLIENT_ID=

# Signup credit grant
CREDITS_SIGNUP_ENABLED=false
CREDITS_SIGNUP_AMOUNT=100
```

### Secret env (.env.secret.dev / .env.secret.prod)

```bash
BETTER_AUTH_SECRET=
ADMIN_API_TOKEN=
EMAIL_RESEND_API_KEY=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_SECRET=
LINUXDO_CLIENT_SECRET=
TURNSTILE_SECRET_KEY=
```

`EMAIL_PROVIDER` accepts `cloudflare` or `resend`. When set to `resend`, `EMAIL_RESEND_API_KEY` is required in the secret env file.

## Common Mistakes

**Trying to sign in with OTP.** The route `/api/auth/sign-in/email-otp` is hard-blocked by middleware. OTP is only for verification and password reset, not login.

**Assuming LinuxDo users have a real email.** The email is synthesized as `linuxdo-{id}@linuxdo.local`. Email-based features like password reset do not work for LinuxDo users.

**Forgetting that admin access requires the SYSTEM_EMAIL user to exist.** A correct `ADMIN_API_TOKEN` still returns 401 if no user row matches `SYSTEM_EMAIL` in the database.

**Expecting a cross-DB transaction on signup.** User creation writes to Meta DB and Tenant Shard DB separately. If the process crashes between them, the user exists but has no credit balance. This is by design.

**Passing registration_utm_source as a URL parameter.** The hook reads it from the `registration_utm_source` cookie, not from the request URL.
