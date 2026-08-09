# Agent Development Guide

> Repository context for coding agents. Keep this file short. Source code is the primary truth.

If architecture, core mechanisms, conventions, important dependencies, or workflow rules change during development, update this file in the same change.

---

## Must Follow

- Use progressive disclosure when learning a module: read the relevant `template-docs/` page first, then inspect the related source code before designing or editing.
- Treat `template-docs/` as the map and source code as the final truth. If they disagree, trust code and update docs when the change affects architecture, mechanisms, conventions, dependencies, or workflows.
- Prefer the smallest direct change that fits the existing architecture.
- Do not add abstractions, files, config, queues, Durable Objects, or settings unless they solve a real current need.
- Reuse existing modules, SDKs, UI primitives, and project conventions.
- Do not add defensive fallbacks that hide configuration or data errors.
- Runtime config errors should fail early. Defaults are only for explicit product semantics.
- Do not revert unrelated user changes.
- Use `create` for creation actions and factory-style names.

---

## Architecture

```mermaid
flowchart TB
  subgraph DeployControl["Deployment control plane"]
    Operator["Developer / CI"]
    BuildEnv["Node + pnpm"]
    EnvFiles["public env + secret env"]
    ApiToken["Cloudflare API token"]
    Deploy["prepare-cloudflare<br/>wrangler deploy"]
  end

  subgraph Clients["Clients"]
    Browser["Browser web app"]
    Extension["Chrome extension"]
  end

  subgraph Edge["Global Cloudflare edge"]
    DNS["DNS zones<br/>APP_DOMAIN / APP_CN_DOMAIN"]
    Routes["Worker routes<br/>TLS + nearest edge entry"]
    Turnstile["Turnstile<br/>bot challenge"]
  end

  subgraph Worker["Single Cloudflare Worker deployment"]
    Entry["Worker entry"]
    Web["SvelteKit SSR<br/>static assets"]
    Api["Hono API<br/>auth + business handlers"]
    Webhooks["Payment webhooks"]
    Jobs["Cron jobs"]
    Consumers["Queue consumers"]
  end

  subgraph DataPlane["Cloudflare data plane"]
    Meta["META_DB<br/>global control DB<br/>primary + read replicas<br/>shard registry + user_shards<br/>payments + subscriptions + notifications"]
    ShardRouter["Tenant shard router<br/>resolve user shard"]
    subgraph TenantD1["Tenant D1 shards<br/>regional primaries + read replicas<br/>configured by D1_SHARDS"]
      Wnam["wnam shards<br/>TENANT_DB_WNAM_0000..."]
      Enam["enam shards<br/>TENANT_DB_ENAM_0000..."]
      Weur["weur shards<br/>TENANT_DB_WEUR_0000..."]
      Eeur["eeur shards<br/>TENANT_DB_EEUR_0000..."]
      Apac["apac shards<br/>TENANT_DB_APAC_0000..."]
      Oc["oc shards<br/>TENANT_DB_OC_0000..."]
    end
    R2["R2<br/>public/private objects<br/>generated media"]
    KV["KV<br/>light key-value state"]
    Queues["Queues<br/>async AI task ids"]
    DO["Durable Objects<br/>optional coordination"]
  end

  subgraph External["External SaaS"]
    Email["Resend or Cloudflare Email"]
    OAuth["Google / GitHub / LinuxDO OAuth"]
    Payment["Dodo / Creem"]
    AI["OpenAI / Gemini / SeedDream / Aliyun / Doubao / SeedDance"]
  end

  Operator --> BuildEnv
  BuildEnv --> Deploy
  EnvFiles --> Deploy
  ApiToken --> Deploy
  Deploy -. deploys .-> Entry
  Deploy -. configures .-> DNS
  Deploy -. provisions .-> Meta
  Deploy -. provisions .-> R2
  Deploy -. provisions .-> KV
  Deploy -. provisions .-> Queues
  Deploy -. provisions .-> DO
  Deploy -. provisions .-> Turnstile

  Browser --> DNS
  Extension --> DNS
  DNS --> Routes
  Routes --> Entry

  Entry --> Web
  Entry --> Api
  Entry --> Webhooks
  Entry --> Jobs
  Entry --> Consumers

  Api --> Turnstile
  Api <--> Meta
  Api --> ShardRouter
  Api --> R2
  Api --> KV
  Api --> Queues
  Api --> DO
  Api --> Email
  Api <--> OAuth
  Api --> Payment
  Api --> AI
  Webhooks --> Meta

  Jobs --> Meta
  Jobs --> ShardRouter
  Queues --> Consumers
  Consumers --> ShardRouter
  Consumers --> R2
  Consumers --> AI

  Meta -- "existing user: user_shards" --> ShardRouter
  Meta -- "new user: least-loaded active shard<br/>preferred region first, then any active shard" --> ShardRouter
  ShardRouter --> Wnam
  ShardRouter --> Enam
  ShardRouter --> Weur
  ShardRouter --> Eeur
  ShardRouter --> Apac
  ShardRouter --> Oc

  classDef critical fill:#fff4d6,stroke:#b7791f,stroke-width:2px,color:#1f2937
  classDef runtime fill:#e7f0ff,stroke:#2563eb,stroke-width:2px,color:#111827
  classDef external fill:#f3f4f6,stroke:#6b7280,color:#111827
  classDef deploy fill:#ecfdf5,stroke:#059669,stroke-width:2px,color:#111827
  class Meta,ShardRouter,Wnam,Enam,Weur,Eeur,Apac,Oc critical
  class Entry,Api,Consumers,Jobs,Web,Webhooks runtime
  class Email,OAuth,Payment,AI external
  class Operator,BuildEnv,EnvFiles,ApiToken,Deploy deploy
```

Key rules:

- `META_DB` is global control state. It owns shard registry and the user-to-shard mapping.
- Tenant runtime data lives in regional shard DBs. Supported shard regions are `wnam`, `enam`, `weur`, `eeur`, `apac`, and `oc`.
- New users prefer the current Worker region bucket, then fall back to any active shard. Current bucket mapping is `AS -> apac`, `EU -> weur`, `OC -> oc`, and default `apac`.
- Existing users always follow `user_shards`; moving traffic between edges must not change the user's Tenant DB.

### Directory Responsibilities

```
.
  QUICK_START.md        # Installs and invokes the create-opcstack-app Skill
  CREATE_OPCSTACK_APP.md # Canonical project creation workflow fetched by the Skill
  e2e/                  # E2E tests
  template-docs/        # Template context docs for humans and agents
  public-docs/          # Product docs served at /docs/
  scripts/
    prepare-public.mjs      # Public frontend and extension artifacts
    prepare-cloudflare.mjs  # Cloudflare config, infra, migrations, and seeds
  wrangler.jsonc.tpl    # Worker config template
  .env.dev              # Public local config, safe to commit
  .env.prod             # Public production config, safe to commit
  .env.secret.example   # Secret config template without real values

src/
  index.ts              # Worker entrypoint
  api-contract/         # Shared JSON API contracts and typed client
  frontend/
    lib/                # Shared frontend layer for all client entrypoints
    web/                # SvelteKit web entrypoint
    extension/          # WXT Chrome extension entrypoint
  backend/
    aff/                # Affiliate referral logic
    ai/                 # AI providers and async task helpers
    api/                # Hono API routes, handlers, auth, and middleware
    consumers/          # Queue consumers
    credits/            # Credit wallet, ledger, grants, expiry
    db/                 # Drizzle schemas and generated migrations
    email/              # Email providers
    jobs/               # Cron handlers
    lib/                # Shared backend utilities
    payment/            # Payment providers and service
    r2/                 # R2 helpers
    testing/            # Shared test helpers
```

Create `src/backend/do/` only when a real Durable Object is added.

---

## Runtime And Config

- `pnpm dev` runs local Worker and web dev servers after `prepare:cloudflare:dev`.
- `pnpm deploy:cloudflare` runs `prepare:cloudflare:prod`, type generation, build, and deploy.
- `pnpm dev:extension` runs `prepare:public:dev` and starts WXT.
- `pnpm build:extension` runs `prepare:public:prod` and packages the extension zip.
- `scripts/prepare-public.mjs` generates `src/frontend/lib/config/client.generated.ts`, web logo, and extension icons.
- `scripts/prepare-cloudflare.mjs` generates `wrangler.jsonc`, `.wrangler/wrangler.types.jsonc`, Cloudflare resources, bindings, migrations, runtime secrets, and public artifacts.
- `wrangler.jsonc` is the runtime config and should include only secrets required by enabled features.
- `.wrangler/wrangler.types.jsonc` is type-generation-only config and may include the full secret schema so `Env` stays stable.
- Public config lives in `.env.dev` and `.env.prod`. `.env` is a local override.
- Secret config lives in `.env.secret.dev` and `.env.secret.prod`.
- Agents must not read, print, search, edit, create, or copy secret files or token caches: `.env.secret.dev`, `.env.secret.prod`, `.wrangler/runtime-secrets.env`, `.wrangler/cloudflare-api-token`, `.wrangler/cloudflare-api-token.permissions`, `.wrangler/r2-s3-token.json`.
- Any work involving secret values must be performed by the user.
- Env loading order: `.env.dev` or `.env.prod` -> `.env.secret.dev` or `.env.secret.prod` -> `.env` -> `process.env`.
- Env files are ordered by shared product identity first, then domains, frontend exposure, auth, business features, infrastructure, payments, and AI providers.
- Keep related env keys together. Put a feature switch before its provider selection and provider-specific settings.
- Keep optional settings after required settings inside the same group.
- Keep `.env.secret.example` in the same business order as public env files.
- `APP_CN_DOMAIN` is optional. When set without `APP_CN_CNAME_TARGET`, `prepare-cloudflare.mjs` adds it as a second Worker custom domain. It always adds it as an R2 CORS origin and Turnstile domain.
- `APP_CN_CNAME_TARGET` is optional. When set with `APP_CN_DOMAIN` in prod mode, `prepare-cloudflare.mjs` creates or updates one unproxied DNS CNAME for `APP_CN_DOMAIN`, skips the Worker custom domain for that hostname, and adds a normal Worker zone route. It does not choose acceleration targets.
- Add public runtime config keys to `wrangler.jsonc.tpl` `vars` first.
- Add secret runtime config keys to `scripts/prepare-cloudflare.mjs` `SECRET_KEYS`.
- When adding an env key, document it directly above the assignment with comments covering purpose, runtime usage, valid values, default semantics, external source, and operational best practices when they exist.
- Secret env keys must be documented with placeholders in `.env.secret.example` only; do not read or edit real secret env files.
- After changing config keys, run `pnpm prepare:cloudflare:dev` and `pnpm exec wrangler types --config .wrangler/wrangler.types.jsonc --env-file .wrangler/runtime-secrets.env --strict-vars false`.
- Use generated `Env`; do not create feature-specific env interfaces.
- Use `clientConfig` from `$frontend/config/client` for public frontend config.

---

## Database

- D1 with Drizzle ORM.
- Meta DB uses `META_DB`. In requests, get it with `ctx.get('metaDb')`.
- Tenant Shard DB uses generated bindings such as `TENANT_DB_WNAM_0000`. In requests, get the current user's DB with `ctx.get('tenantDb')`.
- Tenant shard registry lives in Meta DB tables `d1_shards` and `user_shards`.
- Meta-owned runtime data includes shard registry, auth-adjacent global state, redemption codes, affiliate referrals, payment rows, subscriptions, webhook events, and notifications.
- Tenant-owned runtime data includes credit balances, credit entries, credit transactions, feedbacks, notification reads, and AI async task tables.
- Modify Meta schema in `src/backend/db/schema.meta.ts`.
- Modify Tenant Shard schema in `src/backend/db/schema.shard.ts`.
- Restart `pnpm dev` to generate and apply Meta and Shard migrations.

### D1 Rules

- D1 does not support full transactions. Use batch operations for atomic single-DB flows.
- For conditional writes, prefer `INSERT ... SELECT ... WHERE`.
- Do not split conditional flows into `SELECT` then independent `UPDATE` or `INSERT`.
- Update credit balances with SQL arithmetic, not read-modify-write service code.
- There is no cross-DB transaction between Meta DB and Tenant Shard DB.
- Treat every Meta + Tenant flow as a resumable saga.
- Meta DB is the durable state source for cross-DB flows.
- Tenant writes must be idempotent side effects keyed by `source_type + source_id`.
- If a request writes the current user's Tenant Shard DB, use `ctx.get('tenantDb')` so the response tenant bookmark covers the write.
- Writes for other users may use `openUserDb`.

For more database detail, inspect `src/backend/db/` and the related tests.

---

## API Contracts

- Shared JSON API contracts, request types, response types, error responses, and typed client live in `src/api-contract/`.
- API handlers must import the API contract object from `src/api-contract/`, for example `CreateR2UploadUrlApi`.
- Do not define route request or response contracts inside `src/backend/api/handler/`.
- Keep one contract file per business area, for example `credits.ts`, `payment.ts`, or `notifications.ts`.
- Each JSON API contract object must contain `request`, `response`, and `errors`.
- `request` and `response` use Zod schemas. Export named `XxxRequest`, `XxxResponse`, and schema symbols when frontend or tests need them.
- `errors` contains functions that return `{ status, body: { code, message } }`.
- Dynamic error messages, such as request validation errors, must be passed into the matching API error function.
- Request validation failures should return `INVALID_REQUEST` with the concrete validation message, for example `content_type: Required`.
- Do not hand-write JSON API errors in handlers when the error belongs to an API contract. Use `XxxApi.errors.CODE(...)`.
- Response payloads use explicit named `type` exports derived from the response schema.
- Handlers should cast `ctx.json(...)` payloads to the matching response type so contract drift is visible during type checking.
- Frontend API callers should import request and response types from `src/api-contract/`, not from backend handler files.
- Non-JSON streaming routes, webhook provider payloads, Better Auth routes, and raw file reads do not need a JSON API contract unless application code consumes typed JSON.

### List APIs

- List request uses `page` and `page_size`.
- `page` starts from 1 and defaults to 1.
- `page_size` defaults to 20 and maxes at 100.
- List response uses top-level `items` and `total`.
- Do not return `page` or `page_size`.
- Business filters stay flat in request JSON.

---

## Auth, Credits, Storage, Payment, AI

- Better Auth lives in `src/backend/api/auth/index.ts`.
- `authMiddleware` injects `userId` into `ctx.variables`.
- Authenticated API routes accept Better Auth browser sessions from Cookie or `Authorization: Bearer <token>`. Agent JWTs are verified by the OAuth Provider resource client and expose `agentAuthorization`; existing browser-only routes reject them. Agent-enabled routes must explicitly use `requireAgentScope(scope)`.
- The generic credential client is `opc auth connect` plus `opc api request`; it injects tokens and must not contain business API types or route-specific methods.
- `adminUserMiddleware` validates super admin session or `ADMIN_API_TOKEN`.
- `SYSTEM_EMAIL` is the single operator mailbox used for public support contact, super admin identity, and outbound email sender.
- Credits use integer units where `1 credit = 1_000_000 units`; API credit amounts use decimal strings.
- Payment `price_amount` is provider minor currency units and must not be mixed with credit units.
- R2 paths are `public/*`, `private/<userId>/*`, `tmp/public/*`, and `tmp/private/<userId>/*`.
- R2 lifecycle rules may only target `tmp/public/` and `tmp/private/`.
- User upload URLs may only write `private/<userId>/*` or `tmp/private/<userId>/*`; the request uses `is_tmp` to choose lifecycle.
- Admin public upload URLs may only write `public/*`; do not use the admin public upload API for user-owned private files.
- Use a single R2 bucket by default.
- Payment is controlled by `PAYMENT_ENABLED`; enabled providers are Dodo and Creem via `src/backend/payment/`.
- AI providers live under `src/backend/ai/`; async AI queue payloads carry only task id and user id.
- Generated video output must be downloaded from provider and streamed into R2. Do not use `arrayBuffer` or base64 for video output upload.

Before changing these areas, inspect the source directory and related tests.

---

## Queues, Cron, Durable Objects

- Configure queue names with `QUEUE_NAMES`, separated by semicolon.
- Queue binding convention: `Q_<QUEUE_NAME_UPPER>`, for example `task-check` -> `Q_TASK_CHECK`.
- Queue bindings are required runtime dependencies. Access fixed bindings directly.
- A queue payload must not include a redundant `type` field when the queue has a single purpose.
- Queue handlers live in `src/backend/consumers/index.ts`.
- Configure cron triggers with `CRONS`, separated by semicolon.
- Cron handlers live in `src/backend/jobs/index.ts`.
- Configure Durable Object names with `DO_NAMES`, separated by semicolon.
- Durable Object binding convention: `DO_<NAME_UPPER>`, for example `rate-limiter` -> `DO_RATE_LIMITER`.
- Durable Object class convention: PascalCase name plus `DO` suffix, for example `RateLimiterDO`.
- Create Durable Object classes in `src/backend/do/` and export them from `src/index.ts`.
- Use Durable Objects only for per-object serial coordination, WebSocket rooms, alarms, and small per-object state.
- Do not use Durable Objects as a replacement for D1 list queries or global reporting.

For more detail, inspect `src/backend/consumers/`, `src/backend/jobs/`, and `scripts/prepare-cloudflare.mjs`.

---

## Frontend

- Frontend is multi-entrypoint by design.
- Shared frontend code lives in `src/frontend/lib/`.
- Web entrypoint lives in `src/frontend/web/`.
- Chrome extension entrypoint lives in `src/frontend/extension/`.
- `src/frontend/lib/` must not depend on `src/frontend/web/`, SvelteKit server-only APIs, or extension-only APIs.
- UI primitives live under `src/frontend/lib/ui/` and use alias `$frontend/ui/*`.
- App-specific composed UI lives under `src/frontend/lib/app-ui/` and uses domain paths such as `$frontend/app-ui/auth/*`.
- Pages live under `src/frontend/web/routes/`.
- Pages compose existing primitives. Do not rebuild `Button`, `Card`, `Dialog`, `Alert`, `Empty`, form fields, table primitives, or toast manually.
- Put i18n messages in `src/frontend/lib/i18n/messages/`.
- Set page title, description, and canonical in `<svelte:head>`.
- Canonical URLs use `APP_DOMAIN` and must not point business pages to the OPCStack website.
- Active style is controlled by public env config `DESIGN_SYSTEM`. Valid values: `apple-saas` and `brutalism`.
- Concrete colors, radii, typography sizes, and animations live in `src/frontend/lib/styles/app.css`.
- Use semantic tokens such as `bg-primary`, `text-muted-foreground`, and `border-input`.
- The product landing page uses warm paper, graphite, solid orange, and muted green surfaces. Treat the real runtime architecture as a branded visual object, keep pricing to verified cost facts and official sources, and avoid pricing matrices, decorative gradients, or glass effects.
- Icons come from `lucide-svelte`. Do not introduce other icon libraries.
- Titles, headings, descriptions, button labels, and placeholders must not end with punctuation.
- Admin page headers contain only the title and relevant actions. Do not add explanatory subtitles that restate the page purpose or data source.
- Admin user filters and actions must select users by name or email. Never require operators to type a user ID; pass it internally after selection.
- Every form field needs a visible label, correct `autocomplete`, `aria-invalid` on error, and a visible actionable error message.
- Every list, table, or feed that can be empty must use the `Empty` family.
- Browser extension entrypoints live in `src/frontend/extension/entrypoints/`.
- Extension-specific packaging stays in `src/frontend/extension/wxt.config.ts`.
- Extension host permissions come from `EXTENSION_HOST_PERMISSIONS` via `clientConfig.extension.hostPermissions`.

### Prerender Static Pages

Use `export const prerender = true` in `+page.ts` only when the page:

- Has no per-request server data.
- Has no auth or dynamic DB query.
- Has identical content for all visitors.

Dynamic params require an `entries()` function. Include parent params such as `[locale=locale]` in each entry.

---

## SEO And Docs

- `src/frontend/web/routes/+layout.server.ts` exposes `siteName` from `APP_NAME` and canonical URLs using `APP_DOMAIN`.
- Business pages should set `<title>`, `<meta name="description">`, and `<link rel="canonical">`.
- Product docs rendered by the app live in `public-docs/en/` and `public-docs/zh/`.
- Template explanation docs live in `template-docs/` and are not rendered by the app.
- Docs route is `/docs/[...slug]` when `DOCS_ENABLED=true`; client config exposes `docsEnabled`.
- Docs use Markdown frontmatter with `title`, `description`, `group`, `group_order`, and `order`.
- In docs frontmatter, `group_order` sorts groups and `order` sorts docs inside the same group.
- Docs images live in `src/frontend/web/static/images/` and are referenced as `/images/...`.

---

## Testing

- Base test library is `vitest`.
- Unit tests live in `src/**/*.test.ts`.
- E2E tests live in `e2e/**/*.test.ts`.
- Shared BDD helper lives in `src/backend/testing/bdd.ts`.
- Use `TestCase<TGiven, TWhen, TThen>` and `runCases(cases, fn)` when matching existing BDD-style tests.
- Test names describe behavior, not implementation.
- One test should verify one behavior.
- Unit-under-test output should be wrapped to a structured object before assertion, for example `{ result: add(...) }`.
- Bug fixes should start with a failing test that reproduces the bug.
- Remote E2E must only call HTTP APIs against an already deployed environment.
- Remote E2E must not run deploy, migrations, resource creation, shard count changes, direct remote DB writes, or `d1_shards` writes.

### Commands

```
pnpm dev
pnpm deploy:cloudflare
pnpm test
pnpm dev:extension
pnpm build:extension
pnpm prepare:public:dev
pnpm prepare:public:prod
pnpm prepare:cloudflare:dev
pnpm prepare:cloudflare:prod
pnpm test:e2e
pnpm test:e2e:remote
pnpm exec wrangler types
```

---

## Development Workflows

- Add API: define contract in `src/api-contract/`, write handler in `src/backend/api/handler/`, register route in `src/backend/api/index.ts`.
- Add page: create route under `src/frontend/web/routes/`, reuse `$frontend/ui/*` and `$frontend/app-ui/*`, add i18n messages, set SEO tags.
- Modify database: edit `src/backend/db/schema.meta.ts` or `src/backend/db/schema.shard.ts`, restart `pnpm dev`, check generated migrations.
- Add queue: configure `QUEUE_NAMES`, add handler in `src/backend/consumers/index.ts`, send with `env.Q_<NAME>.send(payload)`.
- Add cron: configure `CRONS`, add handler in `src/backend/jobs/index.ts`.
- Add Durable Object: configure `DO_NAMES`, create class in `src/backend/do/`, export it from `src/index.ts`, run `pnpm dev`.

---

## Error Handling

- Use return unions for expected business states the caller should branch on, such as `not_found`, `forbidden`, or `unavailable`.
- Use exceptions for invalid calls, missing config, provider failures, and other non-normal failures.
- Domain modules that throw handled errors should expose a typed error class with a typed `code` and a human-readable `message`, for example `R2Error`, `CreditsError`, or `PaymentServiceError`.
- API handlers should map handled domain errors with `instanceof XxxError` and `switch (error.code)`, then return the matching `XxxApi.errors.CODE(...)`.
- `code` is for machines. `message` is for humans. Do not set `message` to the same uppercase error code.
- Do not branch on `error.message` for expected domain errors.
- Do not add a global `AppError` hierarchy unless multiple domains genuinely need shared behavior.

---

## Logging

- Logs must be structured JSON and should go through `src/backend/lib/log.ts`.
- Do not log expected user-caused 4xx results such as invalid request, unauthorized, beta gate, or rate limit.
- Do not duplicate platform-level observability for request latency, cron trigger, or queue retry state.
- Do not log an error and then rethrow it.
- Log only internal business state transitions and internal failures that Cloudflare cannot infer.
- Never log tokens, cookies, authorization headers, raw webhook bodies, full email addresses, or user content.
