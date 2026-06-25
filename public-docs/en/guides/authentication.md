---
title: Authentication
description: Email and Google sign in configuration
group: Guides
order: 1
---

# Authentication

OPC Stack uses [Better Auth](https://www.better-auth.com/) for authentication and supports email and Google sign in.

## Email sign in

### Setup steps

1. Buy a domain or use an existing domain
2. Move domain DNS to Cloudflare and subdomain is supported like `mail.example.com`
3. Sign up for [Resend](https://resend.com/)
4. Add your domain in Resend and verify DNS records
5. Create an API key
6. Configure public environment variables in `.env.dev` or `.env.prod`:

```bash
EMAIL_ENABLED=true
EMAIL_FROM=noreply@example.com
```

7. Configure secrets in `.env.secret.dev` or `.env.secret.prod`:

```bash
EMAIL_RESEND_API_KEY=re_xxx
```

### Flow

```
User enters email
  ↓
Send verification code by Resend
  ↓
User enters verification code
  ↓
Verification passed and session is created
  ↓
Return token
```

### Middleware

`emailAuthMiddleware` checks:
- whether `EMAIL_ENABLED` is true
- whether `EMAIL_FROM` and `EMAIL_RESEND_API_KEY` are configured
- whether user email is verified

## Google sign in

### Setup steps

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 Client ID
3. Set redirect URI: `https://your-domain.com/api/auth/callback/google`
4. Configure environment variables:

```bash
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
```

### Flow

```
User clicks Google sign in
  ↓
Redirect to Google consent page
  ↓
User grants permission
  ↓
Google redirects to /api/auth/callback/google
  ↓
Create or update user
  ↓
Create session and return token
```

## Authentication middlewares

### authMiddleware

Injects `userId` into `ctx.variables` and does not block request.

### betaGateMiddleware

If `BETA_CODE_ENABLED=true`, checks whether user is bound to beta code.

## Session management

Better Auth stores sessions in D1. `d1SessionMiddleware` injects `db` instance and handles bookmark for read consistency.

## Frontend integration

```typescript
// src/web/lib/auth.ts
import { createAuthClient } from 'better-auth/client'

export const authClient = createAuthClient({
  baseURL: '/api/auth'
})

// Sign in
await authClient.signIn.email({
  email: 'user@example.com',
  callbackURL: '/'
})

// Sign out
await authClient.signOut()

// Get current user
const session = await authClient.getSession()
```

## FAQ

**Q: I cannot receive email verification code**

Check Resend DNS records and inspect send logs in Resend dashboard.

**Q: Google sign in fails with redirect_uri_mismatch**

Ensure redirect URI configured in Google Cloud Console exactly matches the real callback URL.

**Q: How to customize email template**

Update `emailAndPassword` plugin config in `src/api/auth/index.ts`.
