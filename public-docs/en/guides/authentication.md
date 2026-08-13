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

The public API chain (`publicApi`) only mounts `emailAuthMiddleware` for `/api/auth/*` paths. Protected JSON routes accept either a Better Auth browser session or an OAuth Bearer token and validate their registered business scope. Administrator routes also run `administratorMiddleware` against the current D1 role.

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

Controlled by the Authentication and Email configuration documents in Meta D1. `registrationEnabled` gates every first-time account creation, including social OAuth. Email/password registration does not require an Email provider unless verification is required. When verification is required, the frontend calls `sendVerificationOtp` after signup to send a 6-digit code.

```
User enters email + password
  |
  v
POST /api/auth/sign-up/email
  -- creates user when registration is enabled
  |
  v
POST /api/auth/email-otp/send-verification-otp  (if verification is enabled)
  -- sends 6-digit OTP to email
  |
  v
POST /api/auth/email-otp/verify-email
  -- marks emailVerified=true
```

The password hasher in `buildPasswordHasher` uses `crypto.subtle.digest('SHA-1', ...)` with a random 8-byte salt. The hash format is `saltHex:keyHex`.

## OAuth API Access

The template includes one fixed public OAuth client, `opc-cli`. It uses Authorization Code with PKCE, so it has no client secret. The CLI owns device authorization polling, code exchange, refresh rotation, and credentials stored by connection name.

Every protected JSON route is registered in `src/backend/api/scopes.ts` with one business scope. `authMiddleware` accepts a browser session or OAuth Bearer token. `requireApiScope(scope)` lets browser sessions pass and requires OAuth grants to contain the route scope. Administrator and configuration scopes also run `administratorMiddleware` against the current D1 role.

```text
opc auth connect --name shop-prod --server https://app.example.com --scopes config:ai:read,config:ai:write
opc api request --name shop-prod --method POST --url /api/admin/get_ai_config --body '{}'
opc auth status --name shop-prod
opc auth disconnect --name shop-prod
```

`opc api request` only accepts relative paths, injects the Bearer token, rejects caller-supplied `Authorization`, and refreshes the named connection when required. A failed refresh removes only that connection.

`/oauth/authorize` and `/oauth/consent` are the browser authorization pages. Consent shows the client name, target project origin, and requested business scopes. The fixed transport scopes `api_access offline_access` are protocol details.

`/{locale}/settings/api-access` lists grants and revokes one grant without signing the browser out. Revocation blocks existing access tokens through the D1 grant check and revokes every refresh token tied to the grant.

### Email OTP

Email OTP is a plugin-level feature, not a login method. `disableSignUp: true` in the plugin config means OTP cannot create a new user. The OTP sign-in route is hard-blocked by `emailAuthMiddleware`:

```ts
if (ctx.req.path === '/api/auth/sign-in/email-otp') {
    return ctx.json({ code: 'EMAIL_OTP_SIGN_IN_DISABLED' }, 400)
}
```

OTP is used for three flows: email verification after signup, password reset, and email change. The OTP is 6 digits, expires in 300 seconds, and allows 3 attempts. OTPs are stored hashed.

### Google OAuth

Enabled in the Authentication configuration. The client ID and secret configure the native Google social provider. Redirect URI is `https://your-domain.com/api/auth/callback/google`.

### GitHub OAuth

Enabled in the Authentication configuration. Same native social provider pattern as Google. Redirect URI is `https://your-domain.com/api/auth/callback/github`.

### LinuxDo OAuth

Enabled in the Authentication configuration. Uses the `genericOAuth` plugin because LinuxDo is not a native Better Auth provider. Profile mapping converts the LinuxDo user id into a synthetic email:

```ts
email: `linuxdo-${id}@linuxdo.local`
```

This email is not real. It only ensures uniqueness in the `user` table. The `mapProfileToUser` function also builds the avatar URL from the `avatar_template` field.

## Platform Setup

Use `APP_BASE_URL` as the source of truth for callback URLs. In production it resolves to `https://<APP_DOMAIN>`. In local dev with `APP_DOMAIN=localhost`, it resolves to `http://localhost:5173`.

| Platform | Dashboard action | OPCStack configuration |
| --- | --- | --- |
| Cloudflare Email Service | Onboard the sending domain, then use the generated `SEND_EMAIL` binding | Email tab: Cloudflare provider; administrator email as sender |
| Resend | Verify the sending domain, create an API key with sending permission | Email tab: Resend provider and API key; administrator email as sender |
| Cloudflare Turnstile | Create or reuse a widget for `APP_DOMAIN` and optional `APP_CN_DOMAIN` | Authentication tab: site key, secret key, and enabled switch |
| Google OAuth | Create a Web application OAuth client | Authentication tab: client ID, client secret, and enabled switch |
| GitHub OAuth | Create an OAuth App | Authentication tab: client ID, client secret, and enabled switch |
| LinuxDo OAuth | Create an OAuth application in the LinuxDo console | Authentication tab: client ID, client secret, and enabled switch |

### Cloudflare Email Service

The Worker already has a `send_email` binding named `SEND_EMAIL` in `wrangler.jsonc.tpl`; do not add another binding.

Platform steps:

1. Open Cloudflare dashboard.
2. Go to **Compute > Email Service > Email Sending**.
3. Select **Onboard Domain** and choose the domain used by the administrator email.
4. Let Cloudflare create the required SPF, DKIM, DMARC, and bounce records.
5. Wait until the sending domain is active.
6. Change the administrator email under Account / Security to an address on the onboarded domain.
7. Open the admin Configuration workspace, select the Email tab, choose Cloudflare, and save.

Use Resend if you need local real delivery without depending on Cloudflare remote email behavior.

Docs: [Cloudflare Email Service](https://developers.cloudflare.com/email-service/get-started/send-emails/), [Workers send email binding](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/)

### Resend

Platform steps:

1. Open Resend dashboard.
2. Add and verify the sending domain.
3. Create an API key with sending access.
4. Change the administrator email under Account / Security to an address on the verified domain.
5. Open the admin Configuration workspace and select the Email tab.
6. Choose Resend, enter the API key, and save.

The `from` address is always the current administrator email. An Email provider cannot be configured while it remains `admin@opcstack.local`. If Resend rejects mail, fix the sender domain first.

Docs: [Resend domains](https://resend.com/docs/dashboard/domains/introduction), [Resend API keys](https://resend.com/docs/create-an-api-key)

### Cloudflare Turnstile

On first production initialization, `prepare-cloudflare` creates or reuses one Turnstile widget named `APP_NAME` for `APP_DOMAIN` and optional `APP_CN_DOMAIN`. It seeds the site key and encrypted secret into the disabled Authentication configuration. Local initialization uses Cloudflare test credentials.

Normal production steps:

1. Deploy the application.
2. Open the Authentication tab in the admin Configuration workspace.
3. Enable Turnstile and save. The generated credentials are already present.

Manual setup steps:

1. Open Cloudflare dashboard.
2. Go to **Turnstile**.
3. Create a widget.
4. Add `APP_DOMAIN` and optional `APP_CN_DOMAIN` as allowed hostnames.
5. Open the Authentication tab, replace the site key and secret key, enable Turnstile, and save.

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
7. Open the Authentication tab in the admin Configuration workspace.
8. Enter the client ID and client secret, enable Google, and save.

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
6. Open the Authentication tab in the admin Configuration workspace.
7. Enter the client ID and generated client secret, enable GitHub, and save.

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
4. Open the Authentication tab in the admin Configuration workspace.
5. Enter the client ID and client secret, enable LinuxDo, and save.

The runtime uses these LinuxDo endpoints directly:

```text
https://connect.linux.do/oauth2/authorize
https://connect.linux.do/oauth2/token
https://connect.linux.do/api/user
```

LinuxDo does not provide a real email to this app. The mapped user email is synthetic, so password reset and email verification are not valid LinuxDo account flows.

## Email Rules

`emailAuthMiddleware` in `src/backend/api/middleware/email-auth.ts` runs on all `/api/auth/*` requests and enforces five rules:

1. **OTP sign-in block.** The route `/api/auth/sign-in/email-otp` always returns 400 `EMAIL_OTP_SIGN_IN_DISABLED`.

2. **Registration gate.** Email signup is rejected with `REGISTRATION_DISABLED` when registration is off. Better Auth's user creation hook applies the same rule to first-time social OAuth users.

3. **Email provider availability.** Verification, password reset, email change, and other email actions return `EMAIL_PROVIDER_UNAVAILABLE` when no Provider is configured. The login page derives the same state and hides the forgot-password link.

4. **Domain allowlist.** The Authentication configuration stores the allowed signup domains as a list. Empty means all domains are allowed. A signup email whose domain is not in the list gets 400 `EMAIL_DOMAIN_NOT_ALLOWED`.

5. **Per-email cooldown.** Each (scene, email) pair has a cooldown window controlled by the Authentication configuration. The cooldown is tracked in both a local in-memory `Map` and in KV. The KV key is `email:cooldown:{scene}:{sha256(email)}`. Within the cooldown, returns 429 `EMAIL_ACTION_RATE_LIMITED`.

## User Creation Side Effects

When Better Auth creates a new user, two hooks run in `authCore`:

**`create.before`** runs before the user row is written:
- Rejects all first-time account creation with `REGISTRATION_DISABLED` when registration is off
- Calls `aff.createCode()` to generate a unique affiliate code for the new user
- Reads the `registration_utm_source` cookie from the request headers
- Adds both fields to the user record

**`create.after`** runs after the user row is written:
- Calls `createTenantShardAccess(env, db).openUserDb(userId, region)` to assign the user to a tenant shard. The region is resolved from `request.cf.continent` using the same mapping as the shard router: `AS -> apac`, `EU -> weur`, `OC -> oc`, default `apac`
- Creates the user's credit balance in the tenant shard DB via `CreditsService.createBalance`
- Reads one Credits configuration snapshot from Meta D1 and grants the configured signup reward with `sourceType: 'signup'` and `sourceId: userId` when enabled

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

`src/backend/api/middleware/beta-gate.ts`. If the Authentication configuration enables the beta gate, queries `betaCode` in Meta DB for a row where `usedBy === userId`. If none found, returns 403 `BETA_CODE_REQUIRED`. If the feature is disabled, it passes through.

### tenantDbMiddleware

`src/backend/api/middleware/tenant-db.ts`. Resolves the user's shard from `user_shards` in Meta DB, opens a D1 session with bookmark consistency, and sets `ctx.set('tenantDb', ...)` and `ctx.set('tenantShardId', ...)`.

## Admin Access

`administratorMiddleware` in `src/backend/api/middleware/auth.ts` checks the authenticated user's current D1 role for browser sessions and OAuth access. If the user is not the administrator, it returns 403 `FORBIDDEN`.

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

## Configuration

Authentication and Email configuration live only in the Meta D1 `system_settings` row. Open the admin Configuration workspace, edit one tab, and explicitly save it. Each successful save validates the complete domain and becomes effective for subsequent requests without redeployment.

The Authentication tab owns the beta gate, registration policy, email verification, Turnstile, and Google, GitHub, and LinuxDo credentials. The Email tab owns the Provider and Resend API key. Provider presence is the single source of email availability; there is no separate email switch. Secret reads expose only whether a value is configured; replacing or removing a secret is an explicit save action.

The administrator identity, public support address, and email sender come from the unique D1 administrator account. The first preparation creates `admin@opcstack.local` with a random password and prints the credentials once. `BETTER_AUTH_SECRET` and `CONFIG_ENCRYPTION_KEY` are generated by `prepare-cloudflare`; users do not configure them.

## Common Mistakes

**Trying to sign in with OTP.** The route `/api/auth/sign-in/email-otp` is hard-blocked by middleware. OTP is only for verification and password reset, not login.

**Assuming LinuxDo users have a real email.** The email is synthesized as `linuxdo-{id}@linuxdo.local`. Email-based features like password reset do not work for LinuxDo users.

**Trying to configure an Email provider before changing the initial administrator address.** Change `admin@opcstack.local` to a real address under Account / Security first. Preparation never overwrites the current administrator email or password.

**Expecting a cross-DB transaction on signup.** User creation writes to Meta DB and Tenant Shard DB separately. If the process crashes between them, the user exists but has no credit balance. This is by design.

**Passing registration_utm_source as a URL parameter.** The hook reads it from the `registration_utm_source` cookie, not from the request URL.
