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
    middleware/         # Middleware auth beta-gate meta-db-session
  web/routes/           # SvelteKit pages
  db/
    schema.ts           # Combined Drizzle schema export
    schema.meta.ts      # Meta DB schema
    schema.shard.ts     # Tenant Shard DB schema
    meta-migrations/    # Auto generated Meta DB migrations
    shard-migrations/   # Auto generated Tenant Shard DB migrations
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
- Syncs R2 bucket CORS for browser presigned PUT uploads in remote R2 mode. Allowed origins are `APP_BASE_URL` and optional `APP_CN_DOMAIN`; allowed method is only `PUT`; allowed header is only `content-type`
- Enables D1 read replication in remote mode
- Enables Cloudflare Image Transformations for the APP_DOMAIN zone in remote R2 mode
- In local remote deploy, if `.wrangler/cloudflare-api-token` is missing or its required permission fingerprint changed, prints a Cloudflare API Token template link, prompts for the pasted token, and caches it locally
- Generates and applies migrations

`pre-build.mjs` is operational automation. Do not add tests for this script unless explicitly requested.

### 2. Environment Variables

**Loading order**: `.env.dev` / `.env.prod` → `.env` → `process.env`

**Core variables**:
- `APP_NAME`: Worker D1 R2 KV resource name
- `APP_DOMAIN`: App domain local uses `localhost` production uses your domain or subdomain
- `APP_CN_DOMAIN`: Optional China mainland access domain. When set, pre-build adds it as an extra Worker custom domain and Turnstile widget domain. It does not replace `APP_DOMAIN`
- `SUPPORT_EMAIL`: Contact email used by legal pages
- `BETTER_AUTH_SECRET`: Auth secret minimum 32 characters
- `SUPER_ADMIN_EMAIL`: Single super admin user email
- `SUPER_ADMIN_PASSWORD`: Password used by pre-build to create or update the super admin user
- `ADMIN_API_TOKEN`: Machine token that represents the super admin user identity
- `R2_ORIGIN_SIGNING_SECRET`: HMAC secret used by internal R2 image origin requests
- `R2_TMP_LIFECYCLE_RULES`: R2 tmp object lifecycle rules for `tmp/public/` and `tmp/private/` only, for example `tmp/public/:7;tmp/private/:1`
- `D1_SHARDS`: Tenant Shard D1 region counts, for example `wnam:1;apac:2`. Supported regions are Cloudflare D1 location hints `wnam` Western North America, `enam` Eastern North America, `weur` Western Europe, `eeur` Eastern Europe, `apac` Asia Pacific, and `oc` Oceania
- `TURNSTILE_ENABLED`: Enables Cloudflare Turnstile for email auth. Local mode uses official Cloudflare test keys. Remote mode creates or reuses a Turnstile widget named `APP_NAME`

**Feature flags**:
- `EMAIL_ENABLED` / `EMAIL_SIGNUP_ENABLED`
- `GOOGLE_AUTH_ENABLED`
- `BETA_CODE_ENABLED`
- `TURNSTILE_ENABLED`
- `R2_ENABLED`
- `CREDITS_SIGNUP_ENABLED` / `CREDITS_SIGNUP_AMOUNT`
- `CREDITS_DAILY_CHECKIN_ENABLED` / `CREDITS_DAILY_CHECKIN_AMOUNT`
- `AFF_ENABLED` / `AFF_INVITER_CREDIT_AMOUNT` / `AFF_INVITEE_CREDIT_AMOUNT`
- `CREDITS_HISTORY_RETENTION_DAYS`
- `PAYMENT_ENABLED`
- `PAYMENT_PROVIDER` / `PAYMENT_PROVIDER_COUNTRY_OVERRIDES`
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
- Affiliate invite relationships live in `src/aff/`; credits only own wallet ledger, transactions, daily check-in, redemption codes, expiry, and deduction

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
- Registration attribution uses UTM naming
- `user.registration_utm_source` records the first signup source from `utm_source`
- Frontend should persist `utm_source` into `registration_utm_source` cookie before signup
- Auth user creation reads `registration_utm_source` and writes it once when the user is created
- Do not mix auth provider with registration source
- Middleware:
  - `authMiddleware`: injects `userId` into `ctx.variables`
  - Authenticated API routes accept Better Auth sessions from either Cookie or `Authorization: Bearer <token>`
  - Turnstile uses Better Auth captcha plugin and protects email sign-up sign-in and password reset request endpoints
  - `adminUserMiddleware`: validates the super admin session or `ADMIN_API_TOKEN` and injects the super admin `userId`
  - `betaGateMiddleware`: beta code gate
  - `emailAuthMiddleware`: email auth gate

### 4. Database

- D1 with Drizzle ORM
- Meta DB uses the `META_DB` binding
- Get Meta DB via `ctx.get('metaDb')` request scoped
- Tenant Shard DB uses generated region bindings like `TENANT_DB_WNAM_0000` and `TENANT_DB_APAC_0000`
- Get current user's Tenant Shard DB via `ctx.get('tenantDb')` request scoped
- Tenant shard registry lives in Meta DB tables `d1_shards` and `user_shards`
- `d1_shards.region` is the Cloudflare D1 location hint region. New users are assigned to the least loaded active shard in the Worker preferred region first, then fall back to any active shard. Existing users always use `user_shards`
- `credit_redemption_codes` and `aff_referrals` live in Meta DB
- `credit_balances` `credit_entries` `credit_transactions` `feedbacks` and `notification_reads` live in Tenant Shard DB
- Payment orders transactions subscriptions and webhook events live in Meta DB
- Modify Meta schema by editing `src/db/schema.meta.ts`
- Modify Tenant Shard schema by editing `src/db/schema.shard.ts`
- Restart `pnpm dev` to auto generate and apply Meta and Shard migrations
- D1 does not support full transactions; atomicity must be achieved using batch operations
- For single-DB conditional writes such as daily check-in and idempotent grants, use D1 batch operations with SQL-level conditions
- Prefer `INSERT ... SELECT ... WHERE` for "insert only if condition matches"
- Use `WHERE EXISTS (SELECT 1 FROM ...)` on later statements in the same batch to make them run only when the first conditional insert succeeded
- Do not split these flows into `SELECT` then independent `UPDATE` or `INSERT`; concurrent requests can pass the same check
- Credit grant and refund deduction must be source-idempotent and update `credit_balances.balance` with SQL arithmetic
- Do not read `credit_balances.balance` in service code and then write a fixed calculated balance for credit grant or refund deduction
- Cross-DB flows such as redemption code claim plus tenant credit grant use Meta claim state plus tenant idempotent `source_type + source_id`
- There is no cross-DB transaction between Meta DB and Tenant Shard DB. Treat every Meta + Tenant flow as a resumable saga
- Cross-DB flows must use Meta DB as the durable state source and Tenant Shard writes as idempotent side effects keyed by `source_type + source_id`
- Cross-DB side effects must record completion in Meta DB after the Tenant write succeeds, for example `credit_redemption_codes.granted_at` or `aff_referrals.inviter_granted_at` / `invitee_granted_at`
- When a cross-DB flow is retried, same-user or same-referral pending states must resume missing side effects instead of returning terminal errors such as `CREDIT_CODE_USED` or `AFF_ALREADY_BOUND`
- Never implement cross-DB flows as Meta insert then Tenant writes without a resumable Meta status field. If a later write fails, the next request must be able to finish the missing work without duplicating credits

**D1 Read Replication**:
- Automatically enabled in remote mode
- Meta DB bookmark mechanism:
  - Request: prefers `x-d1-meta-bookmark` header then `d1_meta_bookmark` cookie
  - Response: writes back both header and cookie
  - Default: `first-primary`
- Middleware: `src/api/middleware/meta-db-session.ts`
- Tenant DB bookmark mechanism:
  - Request: prefers `x-d1-tenant-bookmark` header then `d1_tenant_bookmark_{shard_id}` cookie
  - Response: writes back header cookie and `x-d1-tenant-shard`
  - Middleware: `src/api/middleware/tenant-db.ts`

### 5. R2 Storage

**Conventions**:
- Public: `public/*`
- Private: `private/<userId>/*`
- Temporary public: `tmp/public/*`
- Temporary private: `tmp/private/<userId>/*`
- R2 Object Lifecycle retention may only be configured for `tmp/public/` and `tmp/private/`; do not configure lifecycle rules for persistent `public/` or `private/`

**API**:
- `GET /api/r2/public/*`: public access
- `GET /api/r2/private/*`: requires authenticated Better Auth session via Cookie or Bearer Token
- `GET /api/r2/tmp/public/*`: public access with short cache
- `GET /api/r2/tmp/private/*`: requires authenticated Better Auth session via Cookie or Bearer Token
- `POST /api/create_r2_tmp_upload_url`: authenticated presigned upload URL for temporary objects
- `GET /api/r2/*?variant=small|medium`: returns fixed Cloudflare Image Transformations output
- `GET /api/internal/r2_image_origin/*`: internal signed image origin for Cloudflare transformations only

**Cache**:
- R2 reads are served through the Worker proxy
- Use Cloudflare Cache API only for `public/*` and `tmp/public/*`
- `private/*` and `tmp/private/*` must bypass Cache API
- Use a single R2 bucket by default; do not add regional R2 buckets unless explicitly requested
- Do not use an R2 Custom Domain as the default read path unless explicitly requested

**Client**:
```ts
import { newR2Client } from './src/r2'
const client = newR2Client(env, userId)
await client.putImage({ dir, imageBase64, mimeType })
await client.putImage({ dir, imageBase64, mimeType, isPublic: true })
await client.put({ isTmp: true, isPublic: false, dir, filename, body, contentType })
await client.createUploadUrl({ isTmp: true, isPublic: false, dir, filename, contentType, size })
```

### 6. Queues and Scheduled Jobs

**Queues**:
1. Configure: `QUEUE_NAMES=task_check;notify`
2. Optional consumer concurrency limit: `QUEUE_MAX_CONCURRENCY=1`, valid range is 1-250. Empty means Cloudflare Queues automatic concurrency
3. Handler: `queueHandlers` in `src/consumers/index.ts`
4. Send: `env.Q_TASK_CHECK.send(payload)`
5. Binding convention: `Q_<QUEUE_NAME_UPPER>`
6. Queue bindings are required runtime dependencies. Access fixed bindings directly, for example `env.Q_IMAGE_GENERATE.send(payload)`. Do not wrap them in optional casts or handwritten "not configured" guards
7. A queue payload must not include a redundant `type` field when the queue has a single purpose. The queue name is already the message type
8. AI image async queue name is `image-generate`, binding is `Q_IMAGE_GENERATE`
9. AI TTS async queue name is `tts-generate`, binding is `Q_TTS_GENERATE`

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
- Public config controls feature display such as Google auth, email auth, email signup, email verification, user email action cooldown, credits, and payment

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
- Feedback rows are stored in the user's Tenant Shard DB
- `POST /api/admin/list_feedbacks`: returns `501 FEEDBACK_FANOUT_NOT_IMPLEMENTED` until shard fan-out exists
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
- Image: `src/ai/image/gemini/` `src/ai/image/openai/` `src/ai/image/seedream/` `src/ai/image/aliyun/`
- TTS: `src/ai/tts/gemini/`
- Config: `CHAT_OPENAI_*` / `IMAGE_GEMINI_*` / `IMAGE_OPENAI_*` / `IMAGE_SEEDDREAM_*` / `IMAGE_ALIYUN_*` / `TTS_GEMINI_*`
- Simple image client supports sync `generate` and async `generateAsync`
- Image client runtime identity and dependencies such as `userId` and `tenantDb` are required client constructor arguments, not generate input and not options. Options only carry optional provider/model
- Aliyun image provider name is `aliyun`; supported models are `qwen-image-2.0-pro` and `z-image-turbo`
- Aliyun image provider calls DashScope HTTP API directly, downloads provider output URLs, and returns stable `imageBase64` results
- Aliyun image provider does not support `4K` or `lowCensorship`; unsupported inputs throw instead of being silently ignored
- Aliyun `z-image-turbo` does not support image references
- Async image tasks live in Tenant Shard DB table `ai_image_tasks`
- Async image queue payload only carries task id and user id
- Async image retry uses Cloudflare Queue `message.retry({ delaySeconds })`
- Simple TTS client supports sync `generateSpeech` and async `generateSpeechAsync`
- TTS client runtime identity and dependencies such as `userId` and `tenantDb` are required client constructor arguments, not generate input and not options. Options only carry optional provider/model
- Async TTS tasks live in Tenant Shard DB table `ai_tts_tasks`
- Async TTS queue name is `tts-generate`, binding is `Q_TTS_GENERATE`
- Async TTS queue payload only carries task id and user id
- Async TTS retry uses Cloudflare Queue `message.retry({ delaySeconds })`
- Video: `src/ai/video/seedance/`
- Video provider is SeedDance on Volcengine Ark, provider name is `seedance`
- Video generation is async only
- Simple video client supports async `generate` and `getTask` only
- `providerTaskId` is an internal `ai_video_tasks` cursor and must not be exposed in `AIVideoTask`
- Video task table is `ai_video_tasks` in Tenant Shard DB
- Video async queue name is `video-generate`, binding is `Q_VIDEO_GENERATE`
- Video queue payload only carries task id and user id
- Generated video output must be downloaded from provider and stored in R2
- Video output upload must stream provider response body into R2, do not use arrayBuffer or base64
- Video references do not expose arbitrary URL input
- Video image references use R2 key
- Video audio references use R2 key
- Video video references use R2 key
- First version does not implement video editing, extension, web search, return_last_frame, or asset ingestion as separate product APIs
- Image references may use inline base64 or R2 key with optional image variant
- R2 image upload dir is `r2UploadDir`; it is a relative directory, not a full R2 key
- R2 generated image public upload flag is `r2UploadIsPublic`; default is private, set `true` only when explicitly needed

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
3. Use `ctx.get('userId')` and `ctx.get('metaDb')`

### Add a new page

1. Create page under `src/web/routes/`
2. Put shared components in `src/web/lib/ui/`
3. Put i18n messages in `src/web/lib/i18n/messages/`
4. Set page title description and canonical in `<svelte:head>`
5. Follow the Frontend Design Contract below

### Prerender static pages

Use `export const prerender = true` in a `+page.ts` when the page:
- Has no per-request server data (no auth, no dynamic DB queries)
- Content is the same for all visitors (docs, legal, demo, marketing)

Rules:
- If the route has dynamic params (e.g. `[theme]`), export an `entries()` function returning all valid param combinations
- Dynamic params that come from a parent segment (e.g. `[locale=locale]`) must be included in each entry
- Import shared constants (like `supportedLocales`) instead of hardcoding values in `entries()`
- Do not prerender pages that depend on user session, real-time data, or runtime env vars

### Modify database

1. Edit `src/db/schema.meta.ts` for Meta DB tables
2. Edit `src/db/schema.shard.ts` for Tenant Shard DB tables
3. Restart `pnpm dev` for auto generate and apply Meta and Shard migrations

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
- Commands: `pnpm dev` local `pnpm deploycf` deploy `pnpm test` unit and type tests `pnpm test:e2e` local E2E `pnpm test:e2e:remote` deployed runtime E2E
- Remote E2E must only call HTTP APIs against an already deployed environment. It must not run `pnpm deploycf`, `pre-build.mjs`, migrations, D1/KV/R2/Queue creation, shard count changes, direct remote DB writes, or `d1_shards` writes
- Do not create a separate file only to make a private component helper or type easier to test. Keep single-use helper functions and local types inside the owning component or module. Extract a file only when the logic is shared, owns an independent responsibility, or materially reduces complexity

### Frontend Design Contract

> Active style is controlled by `DESIGN_SYSTEM` in `.env`
> Valid values: `apple-saas` (default) | `brutalism`

#### Component-first Principle

Pages compose existing primitives; they do not invent new ones.

Before writing `bg-X border rounded-lg p-Y` ask whether you are rebuilding `Card`, `Alert`, or `Empty`. Before writing `<button class="...">` use `Button`. Before writing `<dialog>` use `Dialog` or `AlertDialog`. Before writing `<div class="fixed bottom-4 right-4 bg-green-600">` use `toast.success(...)`.

UI primitives live in `src/web/lib/ui/*` (alias `$web/ui/*`). Business-level composed components live in `src/web/lib/components/*` (alias `$web/components/*`).

#### Component Inventory

When writing a page or feature, pick a component from this table — do not write the visual primitive yourself.

**UI primitives** (`$web/ui/*`)

| Intent                                                                     | Component                                                                                       | Directory                                      |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Feedback**                                                               |                                                                                                 |                                                |
| Non-blocking operation result (success/error/info/warning)                 | `toast`                                                                                         | `svelte-sonner` (Toaster registered in layout) |
| Inline banner / field-level warning                                        | `Alert`, `AlertTitle`, `AlertDescription`, `AlertAction`                                        | `alert`                                        |
| **Dialogs & overlays**                                                     |                                                                                                 |                                                |
| Critical destructive confirmation                                          | `AlertDialog` family                                                                            | `alert-dialog`                                 |
| Generic modal / multi-step form                                            | `Dialog` family                                                                                 | `dialog`                                       |
| Side-panel form (create/edit entity)                                       | `Sheet` family                                                                                  | `sheet`                                        |
| Mobile bottom sheet                                                        | `Drawer` family                                                                                 | `drawer`                                       |
| Single-element details / options                                           | `Popover` family                                                                                | `popover`                                      |
| Action menu (right-click style)                                            | `ContextMenu` family                                                                            | `context-menu`                                 |
| Action menu (button-anchored)                                              | `DropdownMenu` family                                                                           | `dropdown-menu`                                |
| Hover-triggered hint                                                       | `Tooltip` family                                                                                | `tooltip`                                      |
| Cmd-K command palette                                                      | `Command` family                                                                                | `command`                                      |
| **Forms & input**                                                          |                                                                                                 |                                                |
| Single field (label + input + error)                                       | `Field`, `FieldLabel`, `FieldError`, `FieldDescription`                                         | `field`                                        |
| Full form with sveltekit-superforms                                        | `Form` family                                                                                   | `form`                                         |
| Single-line text input                                                     | `Input`                                                                                         | `input`                                        |
| Multi-line text input                                                      | `Textarea`                                                                                      | `textarea`                                     |
| Input with prefix/suffix addon                                             | `InputGroup` family                                                                             | `input-group`                                  |
| OTP / PIN input cells                                                      | `InputOtp` family                                                                               | `input-otp`                                    |
| Custom-styled select                                                       | `Select` family                                                                                 | `select`                                       |
| Single choice from few options                                             | `RadioGroup`                                                                                    | `radio-group`                                  |
| Multi choice / single boolean                                              | `Checkbox`                                                                                      | `checkbox`                                     |
| On/off toggle                                                              | `Switch`                                                                                        | `switch`                                       |
| Pressed/unpressed toolbar button                                           | `Toggle`, `ToggleGroup`                                                                         | `toggle`, `toggle-group`                       |
| Numeric range                                                              | `Slider`                                                                                        | `slider`                                       |
| Date pick                                                                  | `Calendar`                                                                                      | `calendar`                                     |
| Date range pick                                                            | `RangeCalendar`                                                                                 | `range-calendar`                               |
| Standalone label                                                           | `Label`                                                                                         | `label`                                        |
| **Actions**                                                                |                                                                                                 |                                                |
| Button (default / outline / secondary / ghost / destructive / link / pill) | `Button`                                                                                        | `button`                                       |
| Joined button cluster                                                      | `ButtonGroup` family                                                                            | `button-group`                                 |
| Keyboard shortcut display                                                  | `Kbd`, `KbdGroup`                                                                               | `kbd`                                          |
| **Status & loading**                                                       |                                                                                                 |                                                |
| Content structure known, waiting for data                                  | `Skeleton`                                                                                      | `skeleton`                                     |
| Action waiting (form submit / mutation)                                    | `Spinner` (inline at the button)                                                                | `spinner`                                      |
| Measurable file/batch progress                                             | `Progress`                                                                                      | `progress`                                     |
| Empty state (icon + title + description + action)                          | `Empty`, `EmptyHeader`, `EmptyMedia`, `EmptyTitle`, `EmptyDescription`, `EmptyContent`          | `empty`                                        |
| **Data display**                                                           |                                                                                                 |                                                |
| Generic content container                                                  | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, `CardAction` | `card`                                         |
| List row (icon + title + description + action)                             | `Item`, `ItemMedia`, `ItemTitle`, `ItemDescription`, `ItemContent`, `ItemActions`               | `item`                                         |
| Static table                                                               | `Table` family                                                                                  | `table`                                        |
| Sortable / paginated / filterable table                                    | `DataTable` (uses `@tanstack/table-core`)                                                       | `data-table`                                   |
| Page navigation between table pages                                        | `Pagination` family                                                                             | `pagination`                                   |
| Status badge / tag / count                                                 | `Badge`                                                                                         | `badge`                                        |
| User avatar / fallback                                                     | `Avatar`, `AvatarImage`, `AvatarFallback`, `AvatarGroup`                                        | `avatar`                                       |
| Charts (line/bar/area, monochrome)                                         | `Chart` family (uses `layerchart`)                                                              | `chart`                                        |
| Long content scroll                                                        | `ScrollArea`                                                                                    | `scroll-area`                                  |
| FAQ-style accordion                                                        | `Accordion` family                                                                              | `accordion`                                    |
| Image/video carousel                                                       | `Carousel` family                                                                               | `carousel`                                     |
| Fixed aspect-ratio container                                               | `AspectRatio`                                                                                   | `aspect-ratio`                                 |
| **Navigation & layout**                                                    |                                                                                                 |                                                |
| Top horizontal nav                                                         | `NavigationMenu` family                                                                         | `navigation-menu`                              |
| App sidebar (collapsible)                                                  | `Sidebar` family                                                                                | `sidebar`                                      |
| In-page tabs                                                               | `Tabs` family                                                                                   | `tabs`                                         |
| Breadcrumb trail                                                           | `Breadcrumb` family                                                                             | `breadcrumb`                                   |
| Visual divider                                                             | `Separator`                                                                                     | `separator`                                    |
| Resizable split panes                                                      | `Resizable` family                                                                              | `resizable`                                    |

**Business components** (`$web/components/*`)

| Intent                                      | Component            |
| ------------------------------------------- | -------------------- |
| Login flow (email + Google + forgot link)   | `LoginCard`          |
| Signup flow (email + Google)                | `RegisterCard`       |
| Forgot password (email submit)              | `ForgotPasswordCard` |
| Reset password (OTP + new password)         | `ResetPasswordCard`  |
| Email verification (OTP + resend)           | `OtpCard`            |
| 6-digit OTP input cells                     | `OtpInput`           |
| Application top header                      | `AppHeader`          |
| Authenticated user menu (avatar + dropdown) | `UserMenu`           |
| Language switcher (zh / en)                 | `LocaleSwitcher`     |
| Theme switcher (light / dark / system)      | `ThemeSwitcher`      |
| Google brand SVG                            | `GoogleIcon`         |

If you need an auth flow card, a header, or a user menu, **reuse the business component**. Don't reimplement.

#### Token & Style Source of Truth

All concrete values (colors, radii, typography sizes, animations) live in `src/web/app.css`. Component-level sizes live in the component files themselves.

**Do not duplicate concrete values in page files.** Use semantic tokens and utility classes:
- Colors: `bg-primary`, `text-muted-foreground`, `border-input`, etc.
- Typography: `text-hero-display`, `text-display-lg`, `text-display-md`, `text-lead`, `text-tagline`, `text-caption`, `text-fine-print`
- Shadows: `shadow-product` (product imagery only), `shadow-glass-float` (floating overlays only)

#### Page Layout Rules

| Page type                        | Layout                                               |
| -------------------------------- | ---------------------------------------------------- |
| Document pages (docs/legal/blog) | Constrained readable document shell                  |
| Landing pages (home/product)     | Full-width, sections control own max-width           |
| Workspace pages (dashboard)      | Full-width with sidebar via SvelteKit layout nesting |

Header height is 44px (`h-11`); all sticky/sidebar calculations reference this.

#### Icons

All icons come from `lucide-svelte`. Do not introduce other icon libraries.

#### UI Copy

Titles, headings, descriptions, button labels, and placeholder text must not end with punctuation (no trailing period, comma, or full stop in any language).

#### Behavior & Accessibility Contract

Every page must satisfy these rules regardless of active style.

**1. Reduce Motion**

When `prefers-reduced-motion: reduce` is active:
- Drop motion-based press feedback (scale/translate), keep opacity/color change for affordance
- Page transitions: replace position/scale with crossfade
- Skeleton shimmer: switch to static placeholder color

**2. State Communication: Color Is Never Alone**

Status must be conveyed by **icon + label + color** together.

| State   | Icon (lucide)    | Required label               |
| ------- | ---------------- | ---------------------------- |
| Success | `check-circle`   | "Saved", "Done", "Connected" |
| Warning | `alert-triangle` | Specific consequence         |
| Error   | `x-circle`       | What failed + how to fix     |
| Info    | `info`           | Context                      |

For form fields: error state = border + `aria-invalid="true"` + visible error message.

**3. Destructive Actions: Confirmation by Default**

Undo is only allowed when the domain model already supports reversal (local UI state, soft delete, archive, trash). Do not add server-side undo just to satisfy UI style.

| Action type                                     | Pattern                                         |
| ----------------------------------------------- | ----------------------------------------------- |
| Local reversible action                         | Execute immediately + Toast with "Undo" (5–10s) |
| Server-side delete without recovery model       | Confirmation dialog                             |
| Archive, hide, unfollow with restore API        | Execute immediately + Toast with "Undo" (5–10s) |
| Bulk delete (>10 items)                         | Confirmation dialog                             |
| Permanent delete (account, billing, paid asset) | Confirmation dialog with typed confirmation     |
| Send email, charge card, publish to public      | Confirmation dialog                             |
| Logout, switch workspace                        | Inline button, no confirmation                  |

Confirmation dialogs must use specific verbs ("Delete account", not "OK") and `destructive` button variant.

**4. Modality Decision**

| Need                            | Component                |
| ------------------------------- | ------------------------ |
| Critical warning, must respond  | `AlertDialog`            |
| Multi-field create/edit form    | `Sheet` (side panel)     |
| Detail/options for one item     | `Popover`                |
| Contextual actions (3+ options) | `DropdownMenu`           |
| Async result confirmation       | `toast`                  |
| Field-level validation error    | Inline error under field |

Rules:
- Modal must always have close affordance (X + Esc + backdrop click for non-destructive)
- Never stack modals
- A dialog with only "OK" is almost always wrong — replace with toast or inline UI

**5. Loading**

Pick by scenario, not duration:
- Content structure known → `Skeleton` matching final layout
- Action waiting (form submit / mutation) → inline `Spinner` at the button
- Measurable file/batch progress → `Progress`

**6. Empty States**

Every list/table/feed that can be empty must use `Empty` family with: icon (lucide, muted) + one-line explanation + one primary action.

**7. Form Behavior Contract**

- Correct `autocomplete` attributes on every input
- Validate on blur, clear on change
- Placeholder is hint, not label — every field has visible label above
- Tab order matches visual order; Esc closes form/modal
- Error state: border color + `aria-invalid` + specific actionable message
- Error messages must not cause layout shift

**8. Settings Discipline**

Before adding a setting, ask: Can a smart default solve this? Can the system infer it? When justified: save on change, group by task, show current value at a glance.

**9. Layout Stability: No Content Shift**

| Scenario             | Approach                                                             |
| -------------------- | -------------------------------------------------------------------- |
| Image/media upload   | Reserve fixed-size placeholder (`aspect-ratio` or explicit `height`) |
| New list item        | Append at end or insert outside viewport; never inject mid-view      |
| Async loaded content | `Skeleton` placeholder sized to match final content                  |
| Collapse/expand      | Animate with `grid-template-rows` or `max-height`; no instant pop    |

Images must set `width` + `height` or `aspect-ratio`. Never use `auto` height for async content that expands the parent.

---

## Find More Information

- `public-docs/`: product docs available at `/docs/`
- `.env.example`: full environment variable list
- Source code: inspect related files directly

---

## Maintenance Notes

If architecture changes, new core mechanisms, convention updates, important new dependencies, or workflow changes happen during development, sync the updates to AGENTS.md.
