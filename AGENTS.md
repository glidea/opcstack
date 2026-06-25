# Agent Development Guide

> Project context for coding agents working in this repository.

If architecture, core mechanisms, conventions, important dependencies, or workflow rules change during development, update this file in the same change.

---

## Must Follow

- Inspect related source code before designing or editing.
- Prefer the smallest direct change that fits the existing architecture.
- Do not add abstractions, files, config, queues, Durable Objects, or settings unless they solve a real current need.
- Do not add defensive fallbacks that hide configuration or data errors.
- Reuse existing modules, SDKs, UI primitives, and project conventions.
- Code comments must be in English.
- Runtime config errors should fail early. Defaults are only for explicit product semantics.
- Do not revert unrelated user changes.

---

## Architecture

### Request Routing

```
HTTP Request
  ├── /api/*      -> Hono API      (src/api/)
  └── other path  -> SvelteKit SSR (src/web/)

Cron Trigger       -> src/jobs/index.ts
Queue Consumer     -> src/consumers/index.ts
Durable Object     -> src/do/
```

### Directory Responsibilities

```
.
  e2e/                  # E2E tests
  docs/                 # Internal development/version notes
  public-docs/          # Product docs served at /docs/
  static/               # Static assets served by SvelteKit
  static/images/        # Documentation and page images
  pre-build.mjs         # Local and deploy automation
  wrangler.jsonc.tpl    # Worker config template
  .env.dev              # Public local config, safe to commit
  .env.prod             # Public production config, safe to commit
  .env.secret.example   # Secret config template without real values

src/
  index.ts              # Worker entrypoint
  aff/                  # Affiliate referral domain logic
  credits/              # Credit wallet, ledger, grants, expiry
  api/
    index.ts            # API route registration
    auth/               # Better Auth setup and auth integration
    handler/            # API handlers
    middleware/         # Auth, beta gate, DB session middleware
  ai/
    chat/               # Chat providers
    image/              # Image generation providers
    realtime/           # Realtime voice providers
    tts/                # TTS providers
    video/              # Video generation providers
  consumers/            # Queue consumers
  db/
    schema.ts           # Combined schema export
    schema.meta.ts      # Meta DB schema
    schema.shard.ts     # Tenant Shard DB schema
    meta-migrations/    # Generated Meta migrations
    shard-migrations/   # Generated Tenant Shard migrations
  do/                   # Durable Object classes
  email/                # Email providers and sending logic
  jobs/                 # Cron handlers
  lib/                  # Shared backend utilities
  payment/              # Payment provider integration and service
  r2/                   # R2 helpers
  testing/              # Shared test helpers
  web/
    routes/             # SvelteKit pages and server routes
    params/             # SvelteKit route param matchers
    lib/
      assets/           # Frontend assets imported by code
      auth/             # Frontend auth helpers
      components/       # Business components
      config/           # Frontend/server config helpers
      docs/             # Runtime docs parsing helpers
      hooks/            # Svelte hooks
      i18n/             # Locale messages and i18n helpers
      seo/              # SEO helpers
      ui/               # UI primitives
```

---

## Runtime And Config

- `pnpm dev` and `pnpm deploycf` run `pre-build.mjs`.
- `pre-build.mjs` loads env files, generates `wrangler.jsonc`, provisions Cloudflare resources in remote mode, generates Durable Object bindings and migrations, syncs R2 CORS, enables D1 read replication, and applies migrations.
- Public config lives in `.env.dev` and `.env.prod`.
- Secret config lives in `.env.secret.dev` and `.env.secret.prod`.
- `.env.secret.example` documents secret keys with placeholder values only.
- Agents must not read, print, search, edit, create, or copy `.env.secret.dev`, `.env.secret.prod`, or `.wrangler/runtime-secrets.env`.
- Any work involving secret file values must be performed by the user.
- Do not add tests for `pre-build.mjs` unless explicitly requested.
- Env loading order: `.env.dev` or `.env.prod` -> `.env.secret.dev` or `.env.secret.prod` -> `.env` -> `process.env`.
- Add public runtime config keys to `wrangler.jsonc.tpl` `vars` first.
- Add secret runtime config keys to `pre-build.mjs` `SECRET_KEYS`; `pre-build.mjs` renders them to `wrangler.jsonc` `secrets.required`.
- After changing config keys, run `pnpm exec wrangler types` so `worker-configuration.d.ts` stays current.
- API handlers and jobs read config from Cloudflare env directly, for example `ctx.env.KEY` or `env.KEY`.
- SvelteKit server routes use `serverConfig` from `$web/config/server`.
- Do not import `wrangler.jsonc` outside `src/web/lib/config/server.ts`.
- Do not use the old `AppConfig` name.
- Do not create feature-specific env interfaces. Use generated `Env`.
- Do not use `envMap` or `as Record<string, string | undefined>` casts for normal config reads.

---

## Authentication

- Better Auth lives in `src/api/auth/index.ts`.
- `authMiddleware` injects `userId` into `ctx.variables`.
- Authenticated API routes accept Better Auth sessions from Cookie or `Authorization: Bearer <token>`.
- `adminUserMiddleware` validates super admin session or `ADMIN_API_TOKEN`.
- `betaGateMiddleware` and `emailAuthMiddleware` gate beta and email-auth-only flows.
- Email verification and password reset use Better Auth `emailOTP` endpoints.
- OTP sign-in is disabled. Email auth remains password based.
- Registration attribution uses `registration_utm_source`. Frontend persists `utm_source` into that cookie before signup, and auth writes it once when the user is created.
- Do not mix auth provider with registration source.

---

## Database

- D1 with Drizzle ORM.
- Meta DB uses `META_DB`. In requests, get it with `ctx.get('metaDb')`.
- Tenant Shard DB uses generated bindings such as `TENANT_DB_WNAM_0000`. In requests, get the current user's DB with `ctx.get('tenantDb')`.
- Tenant shard registry lives in Meta DB tables `d1_shards` and `user_shards`.
- Existing users always use `user_shards`.
- New users are assigned to the least loaded active shard in the Worker preferred region first, then any active shard.
- Meta-owned runtime data includes `credit_redemption_codes`, `aff_referrals`, payment orders, payment transactions, subscriptions, and webhook events.
- Tenant-owned runtime data includes `credit_balances`, `credit_entries`, `credit_transactions`, `feedbacks`, `notification_reads`, and AI async task tables.
- Modify Meta schema in `src/db/schema.meta.ts`.
- Modify Tenant Shard schema in `src/db/schema.shard.ts`.
- Restart `pnpm dev` to generate and apply Meta and Shard migrations.

### D1 Write Rules

- D1 does not support full transactions. Use batch operations for atomic single-DB flows.
- For conditional writes, prefer `INSERT ... SELECT ... WHERE`.
- Use `WHERE EXISTS (SELECT 1 FROM ...)` on later batch statements when they should run only if the first conditional insert succeeded.
- Do not split conditional flows into `SELECT` then independent `UPDATE` or `INSERT`.
- Credit grants and refund deductions must be source-idempotent.
- Update `credit_balances.balance` with SQL arithmetic.
- Do not read balance in service code and then write a fixed calculated balance.

### Cross-DB Rules

- There is no cross-DB transaction between Meta DB and Tenant Shard DB.
- Treat every Meta + Tenant flow as a resumable saga.
- Meta DB must be the durable state source.
- Tenant writes must be idempotent side effects keyed by `source_type + source_id`.
- Record side-effect completion in Meta DB after Tenant write succeeds, for example `granted_at`, `inviter_granted_at`, or `invitee_granted_at`.
- Retried pending states must resume missing side effects instead of returning terminal errors such as `CREDIT_CODE_USED` or `AFF_ALREADY_BOUND`.

### D1 Read Replication

- Meta bookmark middleware: `src/api/middleware/meta-db-session.ts`.
- Tenant bookmark middleware: `src/api/middleware/tenant-db.ts`.
- Request prefers bookmark header, then cookie.
- Response writes bookmark header and cookie.

---

## Credits

- Credit amounts use 6 decimal places.
- API request and response credit amounts use decimal strings, for example `"1.230000"`.
- Database and service code store credit amounts as integer units where `1 credit = 1_000_000 units`.
- Do not use floating point numbers for credit balance, credit entries, credit transactions, redemption codes, or payment credit grants.
- Payment `price_amount` is provider minor currency units and must not be mixed with credit units.
- Affiliate invite relationships live in `src/aff/`. Credits own wallet ledger, transactions, daily check-in, redemption codes, expiry, and deduction.

---

## R2 Storage

- Public objects: `public/*`.
- Private objects: `private/<userId>/*`.
- Temporary public objects: `tmp/public/*`.
- Temporary private objects: `tmp/private/<userId>/*`.
- R2 lifecycle rules may only target `tmp/public/` and `tmp/private/`.
- Do not configure lifecycle rules for persistent `public/` or `private/`.
- R2 reads are served through the Worker proxy.
- Use Cloudflare Cache API only for `public/*` and `tmp/public/*`.
- `private/*` and `tmp/private/*` must bypass Cache API.
- Use a single R2 bucket by default.
- Do not use an R2 Custom Domain as the default read path unless explicitly requested.
- R2 client entry: `src/r2/index.ts`.

---

## Queues, Cron, And Durable Objects

### Queues

- Configure queue names with `QUEUE_NAMES`, separated by semicolon.
- Binding convention: `Q_<QUEUE_NAME_UPPER>`, for example `task-check` -> `Q_TASK_CHECK`.
- Queue bindings are required runtime dependencies. Access fixed bindings directly.
- Do not wrap queue bindings in optional casts or handwritten "not configured" guards.
- A queue payload must not include a redundant `type` field when the queue has a single purpose.
- Queue handlers live in `src/consumers/index.ts`.
- Async AI queue payloads carry only task id and user id.

### Cron

- Configure cron triggers with `CRONS`, separated by semicolon.
- Cron handlers live in `src/jobs/index.ts`.
- Credits cron should run credit expiry and transaction cleanup once per trigger.

### Durable Objects

- Configure Durable Object names with `DO_NAMES`, separated by semicolon.
- Binding convention: `DO_<NAME_UPPER>`, for example `rate-limiter` -> `DO_RATE_LIMITER`.
- Class convention: PascalCase name plus `DO` suffix, for example `RateLimiterDO`.
- Classes live in `src/do/`.
- Export every DO class from `src/index.ts`.
- New DO classes use SQLite-backed storage by default through generated `new_sqlite_classes`.
- DO names must use lowercase letters, numbers, and hyphen, and start with a lowercase letter.
- Use DO for per-object serial coordination, WebSocket rooms, alarms, and small per-object state.
- Do not use DO as a replacement for D1 list queries or global reporting.
- Do not put all users or all requests into one global DO unless the product explicitly needs one global serial bottleneck.
- In-memory fields are cache or active connection state only. Durable state belongs in DO SQLite storage.

---

## API Contracts

### Public Config

- `POST /api/get_public_config` returns backend feature flag config.
- `PublicConfig` lives in `src/web/lib/config/client.ts`.
- Frontend loads public config through `getPublicConfig(fetchApi)` from `$web/config/client`.
- `src/web/routes/+layout.server.ts` is the single source that calls `getPublicConfig(event.fetch)` and passes `data.publicConfig` to pages.
- Components and pages must not call `/api/get_public_config` directly unless they replace the layout-level state source.

### List APIs

- List request uses `page` and `page_size`.
- `page` starts from 1 and defaults to 1.
- `page_size` defaults to 20 and maxes at 100.
- List response uses top-level `items` and `total`.
- Do not return `page` or `page_size`.
- Business filters stay flat in request JSON.

### Feedback And Notifications

- Feedback rows are stored in the user's Tenant Shard DB.
- `POST /api/admin/list_feedbacks` returns `501 FEEDBACK_FANOUT_NOT_IMPLEMENTED` until shard fan-out exists.
- Notifications use Meta DB for notification rows and Tenant Shard DB for read state.
- `notifications.target_user_id = null` means global announcement.

---

## AI Capabilities

- Chat: `src/ai/chat/openai/`.
- Image: `src/ai/image/`.
- TTS: `src/ai/tts/`.
- Realtime voice: `src/ai/realtime/doubao/`.
- Video: `src/ai/video/seedance/`.
- Provider model and speaker constants live in provider `constants.ts` files and are re-exported from capability indexes.
- Provider config must include primary `BASE_URL` and `API_KEY`, fallback `FALLBACK_BASE_URL` and `FALLBACK_API_KEY`, and one primary `MODEL` only when the provider has a runtime default model.
- Do not add `FALLBACK_MODEL`.
- Fallback retries the same request with the same model against fallback base URL and API key.
- Client runtime identity and dependencies such as `userId`, `tenantDb`, and `env` belong in client constructors, not generate input.
- Options only carry optional provider or model.
- Async task queue payloads only carry task id and user id.
- Generated video output must be downloaded from provider and streamed into R2. Do not use `arrayBuffer` or base64 for video output upload.
- Video references use R2 keys. Do not expose arbitrary URL input for references.

---

## Payment

- Payment entry switch: `PAYMENT_ENABLED`.
- Public config exposes `payment_enabled`.
- Provider routing uses `request.cf.country` with default plus country override fallback.
- Enabled providers are Dodo and Creem via `src/payment/`.
- Core service is `PaymentService` in `src/payment/index.ts`.
- Payment runtime tables live in Meta DB.
- Webhooks live under `/api/webhook/dodo` and `/api/webhook/creem`.

---

## Frontend

- Pages live under `src/web/routes/`.
- UI primitives live under `src/web/lib/ui/` and use alias `$web/ui/*`.
- Business components live under `src/web/lib/components/` and use alias `$web/components/*`.
- Pages compose existing primitives. Do not rebuild `Button`, `Card`, `Dialog`, `Alert`, `Empty`, form fields, table primitives, or toast manually.
- If an auth card, app header, user menu, locale switcher, theme switcher, or Google icon already exists, reuse the business component.
- Put i18n messages in `src/web/lib/i18n/messages/`.
- Set page title, description, and canonical in `<svelte:head>`.
- Canonical URLs use `APP_DOMAIN` and must not point business pages to the OPCStack website.
- Active style is controlled by `DESIGN_SYSTEM` in `.env`. Valid values: `apple-saas` and `brutalism`.
- Concrete colors, radii, typography sizes, and animations live in `src/web/app.css`.
- Use semantic tokens such as `bg-primary`, `text-muted-foreground`, and `border-input`.
- Icons come from `lucide-svelte`. Do not introduce other icon libraries.
- Titles, headings, descriptions, button labels, and placeholders must not end with punctuation.
- Status must be conveyed by icon, label, and color together.
- Every form field needs a visible label, correct `autocomplete`, `aria-invalid` on error, and a visible actionable error message.
- Every list, table, or feed that can be empty must use the `Empty` family.
- Destructive server-side actions without recovery need confirmation.
- Do not stack modals.
- Reserve dimensions for async media and loaded content to avoid layout shift.

### Prerender Static Pages

Use `export const prerender = true` in `+page.ts` only when the page:

- Has no per-request server data.
- Has no auth or dynamic DB query.
- Has identical content for all visitors.

Dynamic params require an `entries()` function. Include parent params such as `[locale=locale]` in each entry.

---

## SEO And Docs

- `src/web/routes/+layout.server.ts` exposes `siteName` from `APP_NAME` and canonical URLs using `APP_DOMAIN`.
- `src/web/lib/seo/` owns site origin normalization and JSON-LD serialization.
- Business pages should set `<title>`, `<meta name="description">`, and `<link rel="canonical">`.
- Docs live in `public-docs/en/` and `public-docs/zh/`.
- Docs route is `/docs/[...slug]`.
- Docs use Markdown frontmatter with `title`, `description`, `group`, and `order`.
- Docs images live in `static/images/` and are referenced as `/images/...`.
- Mermaid diagrams use fenced `mermaid` blocks.

---

## Testing

- Base test library is `vitest`.
- Unit tests live in `src/**/*.test.ts`.
- E2E tests live in `e2e/**/*.test.ts`.
- Shared BDD helper lives in `src/testing/bdd.ts`.
- Use `TestCase<TGiven, TWhen, TThen>` and `runCases(cases, fn)` when matching existing BDD-style tests.
- Test names describe behavior, not implementation.
- One test should verify one behavior.
- Unit-under-test output should be wrapped to a structured object before assertion, for example `{ result: add(...) }`.
- Bug fixes should start with a failing test that reproduces the bug.
- Remote E2E must only call HTTP APIs against an already deployed environment.
- Remote E2E must not run `pnpm deploycf`, `pre-build.mjs`, migrations, resource creation, shard count changes, direct remote DB writes, or `d1_shards` writes.

### Commands

```
pnpm dev
pnpm deploycf
pnpm test
pnpm test:e2e
pnpm test:e2e:remote
pnpm exec wrangler types
```

---

## Development Workflows

### Add API

1. Write handler in `src/api/handler/`.
2. Register route in `src/api/index.ts`.
3. Use request-scoped values such as `ctx.get('userId')`, `ctx.get('metaDb')`, and `ctx.get('tenantDb')`.

### Add Page

1. Create page under `src/web/routes/`.
2. Reuse primitives from `$web/ui/*` and business components from `$web/components/*`.
3. Add i18n messages under `src/web/lib/i18n/messages/`.
4. Set SEO tags in `<svelte:head>`.

### Modify Database

1. Edit `src/db/schema.meta.ts` or `src/db/schema.shard.ts`.
2. Restart `pnpm dev` to generate and apply migrations.
3. Check generated migrations before committing.

### Add Queue

1. Configure `QUEUE_NAMES`.
2. Add handler in `src/consumers/index.ts`.
3. Send with `env.Q_<NAME>.send(payload)`.

### Add Cron

1. Configure `CRONS`.
2. Add handler in `src/jobs/index.ts`.

### Add Durable Object

1. Add the name to `DO_NAMES`.
2. Create the class in `src/do/`.
3. Export the class from `src/index.ts`.
4. Run `pnpm dev` to regenerate `wrangler.jsonc` and `worker-configuration.d.ts`.

---

## Logging

- Logs must be structured JSON and should go through `src/lib/log.ts`.
- Do not log expected user-caused 4xx results such as invalid request, unauthorized, beta gate, or rate limit.
- Do not duplicate platform-level observability for request latency, cron trigger, or queue retry state.
- Do not log an error and then rethrow it.
- Log only internal business state transitions and internal failures that Cloudflare cannot infer.
- Never log tokens, cookies, authorization headers, raw webhook bodies, full email addresses, or user content.

---

## More Information

- `.env.dev` and `.env.prod`: public environment config.
- `.env.secret.example`: secret environment template without real values.
- `.env.secret.dev` and `.env.secret.prod`: user-owned secret config, never read or edited by agents.
- `public-docs/`: product docs available at `/docs/`.
- Source code is the primary truth. Inspect related files directly before changing behavior.
