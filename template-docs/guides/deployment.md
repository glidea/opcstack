---
title: Deployment
description: Deployment architecture overview and external dependencies
group: Guides
order: 7
---

# Deployment

OPC Stack has one runtime deployment unit: a Cloudflare Worker. The Worker owns web SSR, JSON APIs, auth, payment webhooks, scheduled jobs, queue consumers, static assets, and Cloudflare bindings. The Chrome extension is a separate artifact that talks to the same deployed origin.

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
    Entry["Worker entrypoint"]
    Web["Web SSR<br/>static assets"]
    API["JSON API<br/>auth session"]
    Webhooks["Payment webhooks"]
    Cron["Scheduled jobs"]
    Consumers["Queue consumers"]
  end

  subgraph Data["Cloudflare data plane"]
    Meta["D1 Meta DB<br/>global state"]
    Shards["D1 Tenant Shards<br/>user data"]
    R2["R2 bucket<br/>objects and media"]
    KV["KV namespace<br/>light state"]
    Queues["Queues<br/>async work"]
    DO["Durable Objects<br/>optional coordination"]
  end

  subgraph SaaS["External SaaS dependencies"]
    OAuth["Google / GitHub / LinuxDO<br/>OAuth login"]
    Email["Resend or Cloudflare Email<br/>transactional email"]
    Payment["Dodo / Creem<br/>checkout and webhooks"]
    AI["OpenAI / Gemini / SeedDream / Aliyun / Doubao / SeedDance<br/>AI capabilities"]
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

The important boundary is simple: user traffic enters through Cloudflare routes, then one Worker decides whether the request is web, API, webhook, cron, or queue work. Durable product state is in D1. Binary state is in R2. External SaaS providers are integrations, not deployment units.

## Data Ownership

```mermaid
flowchart LR
  subgraph D1["D1 databases"]
    Meta["Meta DB<br/>auth-adjacent global state<br/>shard registry<br/>payments<br/>subscriptions<br/>notifications"]
    ShardA["Tenant shard A<br/>credit ledger<br/>feedback<br/>AI task state"]
    ShardB["Tenant shard B<br/>same schema<br/>different users"]
  end

  subgraph ObjectStore["Object storage"]
    R2Public["R2 public / tmp public<br/>cacheable reads"]
    R2Private["R2 private / tmp private<br/>Worker-proxied reads"]
  end

  subgraph Async["Async execution"]
    Queue["Queue message<br/>task id + user id"]
    Consumer["Worker queue consumer"]
  end

  Meta --> ShardA
  Meta --> ShardB
  Queue --> Consumer
  Consumer --> ShardA
  Consumer --> ShardB
  Consumer --> R2Public
  Consumer --> R2Private
```

Meta DB is the source of truth for cross-database flows. Tenant shard writes are idempotent side effects. There is no cross-D1 transaction, so the architecture uses resumable state instead of pretending atomicity exists.

## Provisioning Overview

```mermaid
flowchart TB
  Operator["Developer or CI"] --> Env["Public env<br/>.env.prod"]
  Operator --> Secrets["Secret env<br/>.env.secret.prod or CI secrets"]
  Operator --> Token["Cloudflare API token"]

  Env --> Deploy["pnpm deploy:cloudflare"]
  Secrets --> Deploy
  Token --> Deploy

  Deploy --> Prepare["prepare-cloudflare prod"]
  Prepare --> CFAPI["Cloudflare API"]

  CFAPI --> Routes["Worker routes"]
  CFAPI --> D1["Meta DB<br/>Tenant shard DBs<br/>migrations"]
  CFAPI --> Storage["R2 bucket<br/>CORS<br/>tmp lifecycle"]
  CFAPI --> Bindings["KV<br/>Queues<br/>Cron<br/>Durable Objects<br/>Email binding"]
  CFAPI --> Security["Turnstile<br/>Image Transformations"]

  Prepare --> Generated["Generated repo artifacts<br/>wrangler.jsonc<br/>client config<br/>runtime secrets file"]
  Generated --> Types["wrangler types"]
  Types --> Build["vite build"]
  Build --> Upload["wrangler deploy"]
  Upload --> Runtime["Cloudflare Worker runtime"]
```

Provisioning is intentionally centralized in `prepare-cloudflare`. Do not treat manually created Cloudflare resources as the architecture. If a resource is part of the product runtime, it should be expressible from config and generated into the Worker deployment.

## External Dependency Map

```mermaid
flowchart LR
  subgraph Required["Required to deploy"]
    CF["Cloudflare account"]
    Zone["Cloudflare DNS zone"]
    Token["Cloudflare API token"]
    Node["Node + pnpm build environment"]
  end

  subgraph Optional["Required only when enabled"]
    Turnstile["Turnstile"]
    Resend["Resend"]
    CFEmail["Cloudflare Email"]
    OAuth["Google / GitHub / LinuxDO OAuth apps"]
    Pay["Dodo / Creem accounts"]
    AI["AI provider accounts"]
  end

  Required --> Runtime["Worker deployment"]
  Optional --> Runtime
```

Callback URLs and DNS records belong to the external systems: OAuth callbacks use the deployed API origin, payment webhooks point back to the Worker, and email providers need their sender domain records verified. `APP_CN_DOMAIN` adds a second Worker custom domain. `APP_CN_CNAME_TARGET` optionally creates or updates one unproxied CNAME for that domain, but the preferred target must come from your own network decision.
