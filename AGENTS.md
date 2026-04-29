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
- `QUEUE_NAMES` semicolon separated
- `CRONS` semicolon separated

### 3. Authentication System

- Better Auth: `src/api/auth/index.ts`
- Middleware:
  - `authMiddleware`: injects `userId` into `ctx.variables`
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
- `GET /api/r2/private/*`: requires Bearer Token

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

### 8. Feedback and Notifications

**Feedback**:
- `POST /api/submit_feedback`: authenticated user submits `{ type, content }`
- `POST /api/admin/list_feedbacks`: admin lists user feedback
- `feedback.type` is a free string controlled by frontend product usage

**Notifications**:
- `POST /api/admin/create_notification`: admin creates announcement or targeted notification
- `POST /api/list_notifications`: authenticated user lists visible notifications with read state
- `POST /api/read_notification`: authenticated user marks one notification as read
- `notifications.target_user_id = null` means global announcement

### 9. Documentation System

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

### 10. AI Capabilities

- Chat: `src/ai/chat/openai/`
- Image: `src/ai/image/gemini/`
- TTS: `src/ai/tts/gemini/`
- Config: `CHAT_OPENAI_*` / `IMAGE_GEMINI_*` / `TTS_GEMINI_*`

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

- Queue Binding: `Q_<QUEUE_NAME_UPPER>` for example `task-check` → `Q_TASK_CHECK`
- R2 public path: `public/*`
- R2 private path: `private/<userId>/*`
- Test files: `src/**/*.test.ts` for unit tests and `e2e/**/*.test.ts` for E2E tests
- Commands: `pnpm dev` local `pnpm deploycf` deploy `pnpm test` test

---

## Find More Information

- `public-docs/`: product docs available at `/docs/`
- `.env.example`: full environment variable list
- Source code: inspect related files directly

---

## Maintenance Notes

If architecture changes, new core mechanisms, convention updates, important new dependencies, or workflow changes happen during development, sync the updates to AGENTS.md.
