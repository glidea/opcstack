# Agent Development Guide

> This is a project context document for Coding Agents

**Important**: If key project information changes during development such as architecture adjustments, new core mechanisms, or updated conventions, sync those changes back to AGENTS.md.

---

## Core Architecture

### Request Routing

```
HTTP Request
  ├── /api/*      -> Hono API      (src/api/)
  └── other path  -> SvelteKit SSR (src/web/)

Cron Trigger       -> src/jobs/index.ts
Queue Consumer     -> src/consumers/index.ts
```

### Directory Responsibilities

```
src/
  index.ts              # Worker entrypoint dispatching fetch/cron/queue
  api/
    index.ts            # API route registration
    handler/            # API handlers
    middleware/         # Middleware auth beta-gate d1-session
  web/routes/           # SvelteKit pages
  db/
    schema.ts           # Drizzle schema
    migrations/         # Auto generated migration files
  jobs/index.ts         # Cron handlers
  consumers/index.ts    # Queue handlers
  ai/                   # AI clients
  r2/index.ts           # R2 utility functions

public-docs/            # Product docs served at /docs/
pre-build.mjs           # Automation script
wrangler.jsonc.tpl      # Config template
.env.dev / .env.prod    # Environment variables
```

---

## Key Mechanisms

### 1. pre-build.mjs Automation

When running `pnpm dev` or `pnpm deploycf` it automatically:
- Loads environment variables `.env.dev` or `.env.prod`
- Generates `wrangler.jsonc`
- Creates D1 R2 KV and Queues in remote mode
- Enables D1 read replication in remote mode
- Generates and applies migrations

### 2. Environment Variables

**Loading order**: `.env.dev` / `.env.prod` → `.env` → `process.env`

**Core variables**:
- `APP_NAME`: Worker D1 R2 KV resource name
- `APP_DOMAIN`: App domain local uses `localhost` production uses your domain or subdomain
- `SUPPORT_EMAIL`: Contact email used by legal pages
- `BETTER_AUTH_SECRET`: Auth secret minimum 32 characters
- `ADMIN_SECRET`: Admin password

**Feature flags**:
- `EMAIL_ENABLED` / `EMAIL_SIGNUP_ENABLED`
- `GOOGLE_AUTH_ENABLED`
- `BETA_CODE_ENABLED`
- `R2_ENABLED`
- `CREDITS_SIGNUP_ENABLED` / `CREDITS_SIGNUP_AMOUNT`
- `CREDITS_DAILY_CHECKIN_ENABLED` / `CREDITS_DAILY_CHECKIN_AMOUNT`
- `CREDITS_REFERRAL_ENABLED` / `CREDITS_REFERRAL_INVITER_AMOUNT` / `CREDITS_REFERRAL_INVITEE_AMOUNT`
- `CREDITS_HISTORY_RETENTION_DAYS`
- `PAYMENT_ENABLED`
- `PAYMENT_PROVIDERS` / `PAYMENT_DEFAULT_PROVIDER` / `PAYMENT_PROVIDER_COUNTRY_OVERRIDES`
- `PAYMENT_PRODUCTS`
- `PAYMENT_DODO_API_KEY` / `PAYMENT_DODO_WEBHOOK_SECRET` / `PAYMENT_DODO_TEST_MODE`
- `PAYMENT_CREEM_API_KEY` / `PAYMENT_CREEM_WEBHOOK_SECRET` / `PAYMENT_CREEM_TEST_MODE`
- `QUEUE_NAMES` semicolon separated
- `CRONS` semicolon separated

**Credits amount convention**:
- Credit amounts use 6 decimal places
- API request and response credit amounts use decimal strings for example `"1.230000"`
- Database and service code store credit amounts as integer units where `1 credit = 1_000_000 units`
- Do not use floating point numbers for credit balance, credit entries, credit transactions, redemption codes, or payment credit grants
- Payment `price_amount` remains provider minor currency units and must not be mixed with credit units

**Config add and read rules**:
- When adding a new runtime config key, add it to `wrangler.jsonc.tpl` `vars` first
- Run `pnpm exec wrangler types` after changing config keys so `worker-configuration.d.ts` stays current
- Read runtime config from Cloudflare env directly for example `ctx.env.KEY` in API handlers and `env.KEY` in worker jobs
- For SvelteKit server routes, use `serverConfig` from `$web/config/server`
- Do not import `wrangler.jsonc` outside `src/web/lib/config/server.ts`
- Do not use the old `AppConfig` name; server-side web config is `serverConfig`
- Do not use `envMap` or `as Record<string, string | undefined>` casts for normal config reads
- Do not create feature-specific env interfaces; use generated `Env` from `worker-configuration.d.ts`

### 3. Authentication System

- Better Auth: `src/api/auth/index.ts`
- Email verification uses Better Auth `emailOTP` with 6 digit codes
- OTP verification endpoint: `POST /api/auth/email-otp/verify-email`
- OTP resend endpoint: `POST /api/auth/email-otp/send-verification-otp`
- Password reset uses OTP endpoints under `/api/auth/email-otp/`
- OTP sign-in is disabled; email auth remains password based
- Middleware:
  - `authMiddleware`: injects `userId` into `ctx.variables`
  - Authenticated API routes accept Better Auth sessions from either Cookie or `Authorization: Bearer <token>`
  - `adminSecretMiddleware`: validates admin password
  - `betaGateMiddleware`: beta code gate
  - `emailAuthMiddleware`: email auth gate

### 4. Database

- D1 with Drizzle ORM
- Get DB via `ctx.get('db')` request scoped
- Modify schema by editing `src/db/schema.ts` then restart `pnpm dev` to auto generate and apply
- D1 does not support full transactions; atomicity must be achieved using batch operations
- For conditional writes such as redeem codes, daily check-in, idempotent grants, use `env.DB.batch()` with SQL-level conditions
- Prefer `INSERT ... SELECT ... WHERE` for "insert only if condition matches"
- Use `WHERE EXISTS (SELECT 1 FROM ...)` on later statements in the same batch to make them run only when the first conditional insert succeeded
- Do not split these flows into `SELECT` then independent `UPDATE` or `INSERT`; concurrent requests can pass the same check
- Credit grant and refund deduction must be source-idempotent and update `user.credit_balance` with SQL arithmetic such as `credit_balance = credit_balance + ?` or `credit_balance = credit_balance - ?`
- Do not read `user.credit_balance` in service code and then write a fixed calculated balance for credit grant or refund deduction

**D1 Read Replication**:
- Automatically enabled in remote mode
- Bookmark mechanism:
  - Request: prefers `x-d1-bookmark` header then `d1_bookmark` cookie
  - Response: writes back both header and cookie
  - Default: `first-primary`
- Middleware: `src/api/middleware/d1-session.ts`

### 5. R2 Storage

**Conventions**:
- Public: `public/*`
- Private: `private/<userId>/*`

**API**:
- `GET /api/r2/public/*`: public access
- `GET /api/r2/private/*`: requires authenticated Better Auth session via Cookie or Bearer Token

**Client**:
```ts
import { newR2Client } from './src/r2'
const client = newR2Client(env, userId)
await client.putImage({ dir, imageBase64, mimeType })
```

### 6. Queues and Scheduled Jobs

**Queues**:
1. Configure: `QUEUE_NAMES=task_check;notify`
2. Handler: `queueHandlers` in `src/consumers/index.ts`
3. Send: `env.Q_TASK_CHECK.send(payload)`
4. Binding convention: `Q_<QUEUE_NAME_UPPER>`

**Scheduled jobs**:
1. Configure: `CRONS=*/10 * * * *`
2. Handler: `scheduledHandlers` in `src/jobs/index.ts`
3. Credits job: run `expireCredits(now, 20)` and `cleanupCreditTransactions(retentionDays)` once per trigger

### 7. Frontend and Backend Feature Consistency

**`POST /api/get_public_config`**:
- Returns backend feature flag config
- Frontend dynamically shows or hides features based on config
- Fields include `beta_code_enabled` `google_auth_enabled` `email_enabled` and more
- `PublicConfig` type lives in `src/web/lib/config/client.ts`
- Frontend loads public config through `getPublicConfig(fetchApi)` from `$web/config/client`
- `+layout.server.ts` is the single source that calls `getPublicConfig(event.fetch)` and passes `data.publicConfig` to pages
- Components and pages must not call `/api/get_public_config` directly unless they are replacing the layout-level state source
- Public config controls feature visibility such as Google auth, email auth, email signup, email verification, user email action cooldown, credits, and payment

### 8. List API Contract

- List request uses `page` and `page_size`
- `page` starts from 1 and defaults to 1
- `page_size` defaults to 20 and maxes at 100
- List response uses top-level `items` and `total`
- Do not return `page` or `page_size` because they are request parameters
- Business filters stay flat in request JSON

### 9. Feedback and Notifications

**Feedback**:
- `POST /api/submit_feedback`: authenticated user submits `{ type, content }`
- `POST /api/admin/list_feedbacks`: admin lists user feedback
- `feedback.type` is a free string controlled by frontend product usage

**Notifications**:
- `POST /api/admin/create_notification`: admin creates announcement or targeted notification
- `POST /api/list_notifications`: authenticated user lists visible notifications with read state
- `POST /api/read_notification`: authenticated user marks one notification as read
- `notifications.target_user_id = null` means global announcement

### 10. Documentation System

- Location: `public-docs/en/` and `public-docs/zh/`
- Route: `/docs/[...slug]` with runtime Markdown parsing
- **Purpose**: display product documentation that users can customize

**Add documents**:
1. Create `.md` files under `public-docs/zh/` or `public-docs/en/`
2. Add frontmatter:
   ```yaml
   ---
   title: Document title
   description: Document description
   group: Group name
   order: Sort number
   ---
   ```
3. Write Markdown content

**Reference images**:
- Put images in `static/images/`
- Use relative paths like `![Description](/images/xxx.svg)`
- SVG is recommended

**Mermaid diagrams**:
- Use fenced code blocks with `mermaid`
- Mermaid is rendered client-side in docs pages

**Directory organization**:
- You can use subdirectories like `guides/` and `reference/`
- File paths map directly to URL paths for example `guides/auth.md` → `/docs/guides/auth`

### 11. AI Capabilities

- Chat: `src/ai/chat/openai/`
- Image: `src/ai/image/gemini/`
- TTS: `src/ai/tts/gemini/`
- Config: `CHAT_OPENAI_*` / `IMAGE_GEMINI_*` / `TTS_GEMINI_*`

### 12. Web SEO

- `src/web/routes/+layout.server.ts` exposes `siteName` from `APP_NAME` and canonical URLs using `APP_DOMAIN`
- `src/web/lib/seo/` owns site origin normalization JSON-LD serialization and is shared by pages sitemap and robots
- Business pages should set `<title>` `<meta name="description">` and `<link rel="canonical">` in `<svelte:head>`
- Docs pages use markdown frontmatter `title` and `description`
- Pages should use absolute `hreflang` alternate URLs and reuse `/logo.svg` for Open Graph images
- JSON-LD uses `WebSite` with `APP_NAME` and `APP_DOMAIN`

### 13. Payment System

- Payment entry switch: `PAYMENT_ENABLED`
- Public config exposes `payment_enabled` from `POST /api/get_public_config`
- Provider routing uses `request.cf.country` with default plus country override fallback
- Enabled providers are Dodo and Creem via `src/payment/`
- Core service is `PaymentService` in `src/payment/index.ts`
- Main payment APIs:
  - `POST /api/list_payment_products`
  - `POST /api/create_payment_checkout`
  - `POST /api/get_subscription`
  - `POST /api/cancel_subscription`
  - `POST /api/upgrade_subscription`
  - `POST /api/list_payment_transactions`
  - `POST /api/admin/list_payment_transactions`
- Webhook APIs:
  - `POST /api/webhook/dodo`
  - `POST /api/webhook/creem`
- Payment runtime tables:
  - `checkout_orders`
  - `payment_transactions`
  - `user_subscriptions`
  - `payment_webhook_events`

### 14. Legal Pages

- Routes: `/terms`, `/privacy`, `/refund-policy`
- Footer includes links to all three pages
- Page copy uses `APP_NAME` and `SUPPORT_EMAIL`

### 15. Testing Style and Base Library

- Base test library is `vitest`
- Shared BDD helper is `src/testing/bdd.ts`
- BDD case model uses `TestCase<TGiven, TWhen, TThen>` with `scenario` `given` `when` `then`
- Detailed inputs and expected outputs use typed fields `givenDetail` `whenDetail` `thenExpected`
- Use `runCases(cases, fn)` to register cases and assert with one unified flow
- Generated test title format is `${scenario}: given ${given}, when ${when}, then ${then}`
- Per-case timeout is optional via `timeoutMs`
- In test files, keep `describe('unit name', () => { ... })` and define `cases` as an array of typed `TestCase`
- Unit-under-test output should be wrapped to structured object before assertion, for example `{ result: add(...) }`

---

## Development Guide

### Add a new API

1. Write handler in `src/api/handler/`
2. Register route in `src/api/index.ts`: `api.post('/api/xxx', handler)`
3. Use `ctx.get('userId')` and `ctx.get('db')`

### Add a new page

1. Create page under `src/web/routes/`
2. Put shared components in `src/web/lib/ui/`
3. Put i18n messages in `src/web/lib/i18n/messages/`
4. Set page title description and canonical in `<svelte:head>`
5. Follow the Frontend Design Contract below

### Modify database

1. Edit `src/db/schema.ts`
2. Restart `pnpm dev` for auto generate and apply

### Add a new queue

1. Configure `QUEUE_NAMES`
2. Add handler in `src/consumers/index.ts`
3. Send with `env.Q_<NAME>.send(payload)`

### Add a new scheduled job

1. Configure `CRONS`
2. Add handler in `src/jobs/index.ts`

---

## Conventions

- Logs must be structured JSON and should go through `src/lib/log.ts`
- Do not log expected user-caused 4xx results such as invalid request unauthorized beta gate or rate limit
- Do not duplicate platform-level observability for request latency cron trigger or queue retry state
- Do not log an error and then rethrow it; let the outer boundary log thrown errors
- Log only internal business state transitions and internal failures that Cloudflare cannot infer
- Never log tokens cookies authorization headers raw webhook bodies full email addresses or user content
- Queue Binding: `Q_<QUEUE_NAME_UPPER>` for example `task-check` → `Q_TASK_CHECK`
- R2 public path: `public/*`
- R2 private path: `private/<userId>/*`
- Canonical URLs use the app domain from `APP_DOMAIN` and must not point business pages to the OPCStack website
- Test files: `src/**/*.test.ts` for unit tests and `e2e/**/*.test.ts` for E2E tests
- Commands: `pnpm dev` local `pnpm deploycf` deploy `pnpm test` test

### Frontend Design Contract

- All pages must follow `DESIGN.md` as the visual authority
- Use semantic tokens from `src/web/app.css`; never hardcode hex in page files
- Button default is pill-shaped (`rounded-full`); no shadow on any UI element
- Shadow is reserved for product imagery only (use `shadow-product`)
- Active state on buttons: `scale(0.95)` via tailwind-variants
- No decorative gradients, no glassmorphism, no glow effects
- Elevation comes from surface color change and hairline borders, not shadows
- Use typography utility classes: `text-hero-display` `text-display-lg` `text-display-md` `text-lead` `text-tagline` `text-caption` `text-fine-print`
- Page layout rules:
  - Document pages (docs/legal/blog): `max-w-3xl mx-auto px-6 py-16`
  - Landing pages (home/product): full-width, sections control own max-width
  - Workspace pages (dashboard): full-width with sidebar via SvelteKit layout nesting
- Header height is 44px (`h-11`); all sticky/sidebar calculations reference this
- Icons come from `lucide-svelte`
- Buttons, inputs, tabs, dialogs, dropdowns, tables, badges use `$web/ui/*`
- Route files compose layout and data; they do not define new visual styles
- After frontend changes, verify at 375px and 1440px viewport

---

## Find More Information

- `public-docs/`: product docs available at `/docs/`
- `.env.example`: full environment variable list
- Source code: inspect related files directly

---

## Maintenance Notes

If architecture changes, new core mechanisms, convention updates, important new dependencies, or workflow changes happen during development, sync the updates to AGENTS.md.
