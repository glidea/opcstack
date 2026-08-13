---
title: Deployment
description: Cloudflare deployment, prepare-cloudflare, DNS, CN domain, secrets, generated config, and deploy commands
group: Guides
group_order: 1
order: 7
---

# Deployment

OPCStack has one runtime deployment unit: a Cloudflare Worker. The Worker owns web SSR, static assets, JSON APIs, Better Auth routes, payment webhooks, scheduled jobs, queue consumers, and Cloudflare bindings. The Chrome extension is a separate build artifact that calls the same deployed origin.

Deployment is config-driven. `scripts/prepare-cloudflare.mjs` reads fixed topology env, provisions or resolves Cloudflare resources, generates `wrangler.jsonc`, runs migrations, seeds shard registry, and creates the administrator only when absent. `wrangler deploy` then uploads the Worker.

## Runtime Overview

```mermaid
flowchart TB
  subgraph Clients["Clients"]
    Browser["Browser web app"]
    Extension["Chrome extension"]
  end

  subgraph Edge["Cloudflare edge"]
    DNS["DNS zones<br/>APP_DOMAIN / APP_CN_DOMAIN"]
    Routes["Worker routes<br/>TLS and request routing"]
    Turnstile["Turnstile<br/>bot challenge"]
  end

  subgraph Worker["Single Cloudflare Worker"]
    Entry["src/index.ts"]
    Web["SvelteKit SSR<br/>static assets"]
    API["Hono API<br/>auth + business handlers"]
    Webhooks["Payment webhooks"]
    Cron["Scheduled jobs"]
    Consumers["Queue consumers"]
  end

  subgraph Data["Cloudflare data plane"]
    Meta["D1 META_DB<br/>global control state"]
    Shards["D1 Tenant Shards<br/>user runtime state"]
    R2["R2 bucket<br/>objects and media"]
    KV["KV namespace<br/>light key-value state"]
    Queues["Queues<br/>async tasks"]
    DO["Durable Objects<br/>optional coordination"]
  end

  subgraph SaaS["External SaaS"]
    OAuth["Google / GitHub / LinuxDO"]
    Email["Resend / Cloudflare Email"]
    Payment["Dodo / Creem"]
    AI["OpenAI / Gemini / SeedDream / Aliyun / Doubao / SeedDance"]
  end

  Browser --> DNS
  Extension --> DNS
  DNS --> Routes
  Routes --> Entry

  Entry --> Web
  Entry --> API
  Entry --> Webhooks
  Entry --> Cron
  Entry --> Consumers

  API --> Turnstile
  API <--> Meta
  API <--> Shards
  API <--> R2
  API <--> KV
  API --> Queues
  API --> DO

  Cron --> Meta
  Cron --> Shards
  Consumers --> Meta
  Consumers --> Shards
  Consumers --> R2
  Queues --> Consumers

  API <--> OAuth
  API --> Email
  API --> Payment
  Payment --> Webhooks
  API --> AI
  Consumers --> AI
```

The boundary is simple: traffic and platform events enter one Worker. Durable product state lives in D1. Binary state lives in R2. External SaaS providers are integrations, not deployment units.

## Deployment Flow

Production deploy command:

```bash
pnpm deploy:cloudflare
```

That script expands to:

```bash
pnpm prepare:cloudflare:prod
CLOUDFLARE_API_TOKEN=$(cat .wrangler/cloudflare-api-token) wrangler types --config .wrangler/wrangler.types.jsonc --env-file .wrangler/runtime-secrets.env --strict-vars false
vite build
if [ -s .wrangler/runtime-secrets.env ]; then
  CLOUDFLARE_API_TOKEN=$(cat .wrangler/cloudflare-api-token) wrangler deploy --secrets-file .wrangler/runtime-secrets.env
else
  CLOUDFLARE_API_TOKEN=$(cat .wrangler/cloudflare-api-token) wrangler deploy
fi
```

Prepare-only commands:

```bash
pnpm prepare:cloudflare:dev
pnpm prepare:cloudflare:prod
```

Local dev command:

```bash
pnpm dev
```

`pnpm dev` runs:

1. `svelte-kit sync`
2. `prepare:cloudflare:dev`
3. `wrangler types`
4. `wrangler dev --port 8787`
5. `vite dev --mode dev --port 5173 --strictPort`

## Prepare Cloudflare

`scripts/prepare-cloudflare.mjs` is the deployment control plane. It does these jobs:

| Step | Dev mode | Prod mode |
| --- | --- | --- |
| Load env | `.env.dev`, `.env`, `process.env` | `.env.prod`, `.env`, `process.env` |
| Resolve Cloudflare token | No remote token needed | Reads `CLOUDFLARE_API_TOKEN` or cached token |
| D1 | Uses local placeholder IDs | Creates or resolves Meta DB and Tenant Shard DBs |
| D1 read replication | No | Enables read replication |
| Queues | Generates bindings | Creates queues and generates bindings |
| R2 | Generates binding only when enabled | Creates bucket, CORS, tmp lifecycle, image transformations |
| KV | Local placeholder namespace | Creates or resolves KV namespace |
| Turnstile | Writes Cloudflare test credentials into D1 | Creates or updates the widget and writes its credentials into D1 |
| Config | Generates `wrangler.jsonc` | Generates `wrangler.jsonc` |
| Types config | Generates `.wrangler/wrangler.types.jsonc` | Generates `.wrangler/wrangler.types.jsonc` |
| Runtime secrets | Writes local runtime secrets | Writes only new Worker Secrets pending upload |
| Migrations | Generates and applies local D1 migrations | Generates and applies remote D1 migrations |
| Seed state | Initializes domain config, shard registry, OAuth client, and administrator | Initializes domain config, shard registry, OAuth client, and administrator |

Do not manually create resources and call that deployment. If the Worker needs a resource, make it expressible through env config and `prepare-cloudflare`.

## Generated Artifacts

Generated files:

| File | Purpose |
| --- | --- |
| `wrangler.jsonc` | Runtime Worker config used by Wrangler |
| `.wrangler/wrangler.types.jsonc` | Type-generation config with full secret schema |
| `.wrangler/runtime-secrets.env` | Local runtime secrets or new Worker Secrets pending upload |
| `src/frontend/lib/config/client.generated.ts` | Public frontend and extension config |
| D1 migrations | Generated from Drizzle schemas |

Agent rule: do not read or print generated secret state or token caches.

## Fixed Env

| File | Purpose |
| --- | --- |
| `.env.dev` | Local deployment identity and resource topology |
| `.env.prod` | Production deployment identity and resource topology |
| `.env` | Local override |

These files contain product identity, `DESIGN_SYSTEM`, the first-run `SYSTEM_EMAIL`, domains, extension host permissions, D1 shards, R2 resource switches and upload policy, Queue topology, Cron triggers, and Durable Object topology. They never contain runtime Authentication, Email Provider, Payment, AI, Credits, Affiliate, or third-party credential configuration.

Load order:

```text
.env.dev or .env.prod
  -> .env
  -> process.env
```

`.env.secret.dev` is generated local state for the three internal root secrets. It is not user configuration and is never part of env loading. Production roots live only in Cloudflare Worker Secrets.

## Cloudflare Token

Remote deploy needs a Cloudflare API token.

Token source order:

1. `CLOUDFLARE_API_TOKEN` env var
2. `.wrangler/cloudflare-api-token`
3. Interactive prompt

In CI, `CLOUDFLARE_API_TOKEN` must be set. The script will not prompt.

Required permissions are printed by `prepare-cloudflare`:

| Permission |
| --- |
| API Tokens:Edit |
| Zone:Read |
| Zone Settings:Edit |
| DNS:Edit |
| Workers Scripts:Edit |
| Workers KV Storage:Edit |
| Workers Routes:Edit |
| Workers R2 Storage:Edit |
| D1:Edit |
| Queues:Edit |
| Turnstile:Edit |

The token is cached with a permission fingerprint. If required permissions change, the script asks for a new token.

## DNS and Domains

Primary domain:

```bash
APP_DOMAIN=example.com
```

`prepare-cloudflare` renders a Worker custom domain route for `APP_DOMAIN`.

Production uses `APP_DOMAIN` for:

- Worker route
- `APP_BASE_URL`
- canonical URLs
- OAuth callback base
- payment webhook base
- R2 CORS origin
- Turnstile domain

Optional China domain:

```bash
APP_CN_DOMAIN=cn.example.com
APP_CN_CNAME_TARGET=target.example.net
```

When `APP_CN_DOMAIN` is set:

- Worker gets a second custom domain route when `APP_CN_CNAME_TARGET` is empty
- R2 CORS includes the CN origin
- Turnstile widget includes the CN domain

When both `APP_CN_DOMAIN` and `APP_CN_CNAME_TARGET` are set in prod:

- `prepare-cloudflare` creates or updates one unproxied DNS CNAME for `APP_CN_DOMAIN`
- Worker gets a normal zone route for `APP_CN_DOMAIN`, not a custom domain route
- it does not choose the acceleration target
- `APP_CN_CNAME_TARGET` must come from your DNS acceleration or routing provider

Do not point `APP_CN_CNAME_TARGET` back to `APP_DOMAIN`. That is usually just a loop or no-op.

## D1 Deployment

Meta DB:

```text
<APP_NAME>-meta
```

Tenant Shard DBs:

```text
<APP_NAME>-shard-<region>-<0000>
```

Example:

```bash
APP_NAME=opcstack
D1_SHARDS=apac:1;weur:1
```

Creates or resolves:

```text
opcstack-meta
opcstack-shard-apac-0000
opcstack-shard-weur-0000
```

Generated bindings:

```text
META_DB
TENANT_DB_APAC_0000
TENANT_DB_WEUR_0000
```

Supported shard regions:

```text
wnam, enam, weur, eeur, apac, oc
```

`prepare-cloudflare` runs Drizzle generation and applies migrations:

```bash
pnpm exec drizzle-kit generate --config drizzle.meta.config.ts
pnpm exec drizzle-kit generate --config drizzle.shard.config.ts
pnpm exec wrangler d1 migrations apply <APP_NAME>-meta --remote
pnpm exec wrangler d1 migrations apply <APP_NAME>-shard-apac-0000 --remote
```

Then it upserts `d1_shards` in Meta DB. Existing users keep their `user_shards` mapping.

## R2 Deployment

R2 is controlled by:

```bash
R2_ENABLED=true
R2_TMP_LIFECYCLE_RULES=tmp/public/:7;tmp/private/:1
```

When enabled in prod, `prepare-cloudflare`:

1. Creates or resolves an R2 bucket named `APP_NAME`
2. Syncs CORS for `APP_BASE_URL` and optional `APP_CN_DOMAIN`
3. Syncs tmp lifecycle rules
4. Enables Cloudflare Image Transformations
5. Adds binding `R2`

Only these tmp prefixes are valid lifecycle targets:

```text
tmp/public/
tmp/private/
```

Runtime R2 secrets:

| Secret | Purpose |
| --- | --- |
| `R2_ORIGIN_SIGNING_SECRET` | Signed origin/read URL behavior |

`prepare-cloudflare` generates this internal secret. It is not user-provided R2 configuration.

## Queues, Cron, and Durable Objects

Queues:

```bash
QUEUE_NAMES=image-generate;tts-generate;video-generate
QUEUE_MAX_CONCURRENCY=
```

Cron:

```bash
CRONS=*/10 * * * *
```

Durable Objects:

```bash
DO_NAMES=
```

`prepare-cloudflare` generates queue producers, queue consumers, cron triggers, and Durable Object bindings/migrations from these env values.

Durable Object names must match:

```text
^[a-z][a-z0-9-]*$
```

Binding and class naming:

| Config name | Binding | Class |
| --- | --- | --- |
| `rate-limiter` | `DO_RATE_LIMITER` | `RateLimiterDO` |

Create DO classes only when you actually add a Durable Object implementation.

## Secrets

`wrangler.jsonc` includes only secrets required by enabled features.

Generated once by `prepare-cloudflare` and always required:

| Secret |
| --- |
| `BETTER_AUTH_SECRET` |
| `CONFIG_ENCRYPTION_KEY` |
| `R2_ORIGIN_SIGNING_SECRET` |

Users never provide these values. Local preparation generates and persists them once. Production preparation creates them as Cloudflare Worker Secrets on the first deployment and never overwrites them. If initialized D1 state loses the matching roots, preparation fails instead of generating replacements.

All third-party credentials are encrypted in D1 and managed through Admin / Configuration or an OAuth-authorized API call. They are not Worker secrets.

`.wrangler/wrangler.types.jsonc` may include the full secret schema so generated `Env` stays stable. That does not mean every secret is required at runtime.

## External Services

External services must point back to the deployed Worker origin.

| Service | Required setup |
| --- | --- |
| Google OAuth | Client id and secret in the Authentication tab, callback URL using `APP_DOMAIN` |
| GitHub OAuth | App id and secret in the Authentication tab, callback URL using `APP_DOMAIN` |
| LinuxDO OAuth | OAuth id and secret, callback URL using `APP_DOMAIN` |
| Resend | API key and verified sender domain for the D1 administrator email |
| Cloudflare Email | Paid Worker plan and `SEND_EMAIL` binding |
| Dodo | Configuration > Payment credentials, product ids, webhook to Worker |
| Creem | Configuration > Payment credentials, product ids, webhook to Worker |
| AI providers | API keys, base URLs, models, and routing weights in the AI tab |

If a feature is disabled, do not configure fake production credentials. Keep the feature switch false.

## Extension Build

The extension is not deployed by `pnpm deploy:cloudflare`.

Commands:

```bash
pnpm dev:extension
pnpm build:extension
```

Both commands run `prepare-public` first. Extension host permissions come from:

```bash
EXTENSION_HOST_PERMISSIONS=https://example.com/*
```

Use the deployed `APP_DOMAIN` in production extension builds.

## Deployment Checklist

1. Set fixed topology in `.env.prod`, including `APP_DOMAIN`
2. Set optional `APP_CN_DOMAIN` and `APP_CN_CNAME_TARGET`
3. Run `pnpm deploy:cloudflare`
4. Retain the one-time administrator credentials printed by the first preparation
5. Sign in to the deployed app and change the generated administrator password
6. Configure and enable required business domains in Admin / Configuration
7. Register the displayed OAuth callback and payment webhook URLs with external providers
8. Run `pnpm test:e2e:remote` against the deployed app

CI should set `CLOUDFLARE_API_TOKEN` directly. Local deploy can use the cached token.

## Common Mistakes

**Editing `wrangler.jsonc` by hand**

Edit env files or `wrangler.jsonc.tpl`. `wrangler.jsonc` is generated.

**Using comma-separated config**

`QUEUE_NAMES`, `CRONS`, `D1_SHARDS`, and related list envs use semicolons.

**Putting business settings in fixed env**

`.env.dev` and `.env.prod` own deployment topology only. Business settings and third-party credentials belong in D1 through Admin / Configuration.

**Changing `D1_SHARDS` after users exist without a migration plan**

New shards can be added, but existing users follow `user_shards`. Do not assume changing config moves users.

**Expecting remote E2E to deploy infrastructure**

Remote E2E verifies an existing deployment. Deployment is done by `prepare-cloudflare` and `wrangler deploy`.

**Forgetting CN side effects**

`APP_CN_DOMAIN` affects Worker routing, R2 CORS, and Turnstile domains. With `APP_CN_CNAME_TARGET`, DNS stays on your preferred CNAME and the Worker is attached through a normal zone route.

**Leaving enabled features without secrets**

Config validation fails early. That is correct. Disable the feature or provide real secrets.
