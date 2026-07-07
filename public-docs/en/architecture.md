---
title: Architecture
description: System shape, design decisions, and data model
group: Getting Started
group_order: 0
order: 2
---

# Architecture

## Design Principles

**One Worker as the runtime container.** API, SSR, Cron, and Queue all run in one Worker. Development and deployment follow the same path. No service splitting, no extra glue layer.

**Convention over configuration.** No hand-written `wrangler.jsonc`. Set env vars, `scripts/prepare-cloudflare.mjs` generates config, creates resources, and applies migrations.

**Cloudflare stack first.** Workers, D1, R2, KV, Queues, and Cron are one integrated path. The free tier runs the full loop.

**Automation first.** No manual resource creation in any environment. `prepare-cloudflare.mjs` handles local and remote provisioning.

## System Overview

```mermaid
flowchart TB
  subgraph Clients
    Browser["Browser web app"]
    Extension["Chrome extension"]
  end

  subgraph Edge["Cloudflare edge"]
    DNS["DNS + TLS"]
    Routes["Worker routes"]
  end

  subgraph Worker["Single Worker deployment"]
    Entry["Entry src/index.ts"]
    Web["SvelteKit SSR\nstatic pages"]
    Api["Hono API\nauth + business"]
    Webhooks["Payment webhooks"]
    Jobs["Cron jobs"]
    Consumers["Queue consumers"]
  end

  subgraph Data["Data plane"]
    Meta["Meta DB\nshard registry\nuser_shards\nauth\npayments\nnotifications"]
    Shards["Tenant Shard DBs\ncredit balances\nfeedbacks\nAI tasks\n..."]
    R2["R2\npublic/private objects"]
    KV["KV"]
    Queues["Queues"]
  end

  subgraph External["External SaaS"]
    OAuth["Google / GitHub / LinuxDO"]
    Payment["Dodo / Creem"]
    AI["OpenAI / Gemini / ..."]
    Email["Resend / Cloudflare Email"]
  end

  Browser --> DNS
  Extension --> DNS
  DNS --> Routes
  Routes --> Entry
  Entry --> Web
  Entry --> Api
  Entry --> Webhooks
  Entry --> Jobs
  Entry --> Consumers

  Api --> Meta
  Api --> Shards
  Api --> R2
  Api --> KV
  Api --> Queues
  Api --> OAuth
  Api --> Payment
  Api --> AI
  Api --> Email
  Webhooks --> Meta
  Jobs --> Meta
  Jobs --> Shards
  Consumers --> Shards
  Consumers --> R2
  Consumers --> AI
```

A few things to notice:

- There is only **one Worker deployment**. Web pages, API, webhooks, cron, and queue consumers all live in the same codebase and ship together. You do not run separate services.
- The **edge** is Cloudflare's global network. DNS and TLS terminate there, and the request is routed to the nearest Worker instance automatically.
- **Clients** are the web app (browser) and the Chrome extension. They share most of the frontend code in `src/frontend/lib/`.
- **External SaaS** are third-party providers. You only pay for what you enable via env vars.

## Request Flow

```
HTTP Request
  ├── /api/* -> Hono API (src/backend/api/)
  └── other  -> SvelteKit SSR (src/frontend/web/)

Cron Trigger    -> src/backend/jobs/index.ts
Queue Consumer  -> src/backend/consumers/index.ts
```

Everything enters from `src/index.ts`. For HTTP requests, it checks the path: `/api/*` goes to Hono, everything else goes to SvelteKit. Cron and queue are separate entry points but live in the same Worker.

## API Layer

The API is split into four route groups in `src/backend/api/index.ts`:

| Group         | Auth level            | Purpose                                                     |
| ------------- | --------------------- | ----------------------------------------------------------- |
| `publicApi`   | None                  | Health check, auth login, payment webhooks, R2 public reads |
| `authOnlyApi` | Logged in             | Routes that only need identity (e.g. bind beta code)        |
| `userApi`     | Logged in + beta gate | All authenticated user endpoints                            |
| `adminApi`    | Super admin           | Admin operations                                            |

The important idea: public routes skip auth entirely, user routes run the full middleware chain (auth, beta gate, tenant DB), admin routes replace normal auth with admin auth. You pick the group when you register a route.

## Data Architecture

Two database tiers with different ownership:

**Meta DB** (`META_DB`): global control state. One database for the whole product. Holds shard registry, user-to-shard mapping, auth, payments, subscriptions, webhooks, notifications. Accessed via `ctx.get('metaDb')`.

**Tenant Shard DB**: user-scoped runtime data. Sharded across multiple D1 databases by region. Holds credit balances, credit transactions, feedbacks, notification reads, AI async task tables. Accessed via `ctx.get('tenantDb')`.

Why split: Meta DB is the single source of truth for anything cross-user (payments, shard assignment). Tenant shards scale horizontally by region, so more users just means more shards. A user's data lives in exactly one shard for its lifetime.

Supported shard regions: `wnam`, `enam`, `weur`, `eeur`, `apac`, `oc`. Configured via `D1_SHARDS` env var as `region:count` pairs.

New user assignment prefers the Worker's continent bucket, then any active shard:

```
AS -> apac | EU -> weur | OC -> oc | default -> apac
```

Existing users always follow their `user_shards` record, even if they move to a different region. This prevents data fragmentation.

## Read Consistency

D1 has one primary node per database. Without read replication, all reads and writes hit primary, which limits latency and throughput under load.

In production, `prepare-cloudflare.mjs` enables read replication automatically. After that, reads go to global replica nodes (closer to the user), while writes still go to primary.

The consistency problem this creates: after a user writes, a later read might hit a replica that has not caught up. OPCStack solves this with **bookmarks**. Each D1 session returns a bookmark that represents a consistent point-in-time snapshot. The bookmark flows through response headers and cookies back to the client, and the client sends it back on the next request. This gives monotonic reads ("read your own writes") without distributed transactions.

Meta DB and Tenant Shard DB each maintain independent bookmark flows, because they are separate databases with separate primaries.

## prepare-cloudflare Automation

`scripts/prepare-cloudflare.mjs` is the single entry point for provisioning:

```
pnpm dev / pnpm deploy:cloudflare
  -> load env
  -> generate wrangler.jsonc
  -> create D1, R2, KV, Queues, Turnstile (remote only)
  -> generate and apply migrations
  -> wrangler dev / wrangler deploy
```

Local mode uses placeholder UUIDs and applies migrations locally. Remote mode creates real Cloudflare resources, enables read replication, and applies migrations remotely.

This is an architectural decision, not just a convenience: the infrastructure is code-generated from env vars, not hand-configured in a dashboard. Adding a queue, a shard, or a Durable Object is an env var change, not a manual session.
