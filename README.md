# OPCStack

[English](README.md) | [简体中文](README.zh-CN.md)

Build OPC products faster, at lower cost, and ready for production.

OPCStack is a Cloudflare-native AI SaaS template for One Person Companies. It includes authentication, payments, credits, D1 sharding, R2, KV, Queues, Cron, AI tasks, deployment automation, and a test suite.

---

## Build Faster

Most templates provide pages, login, and a few sample APIs. You still have to build everything else from scratch.

What slows development down is usually not that AI cannot write code. It is the lack of a stable engineering foundation. OPCStack follows Harness Engineering: requirements, context, constraints, feedback, testing, and deployment are made repeatable. With a fixed foundation and acceptance process, AI can focus on product changes instead of rebuilding login, payments, storage, queues, and deployment for every project.

| Area                  | Included capabilities                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Web / API             | Cloudflare Workers, SvelteKit, Hono API, static page prerendering                                                                   |
| Database              | Cloudflare D1, Drizzle, user data sharding, read replicas, automatic migrations                                                     |
| File storage          | Cloudflare R2, public, private, and temporary files, browser direct uploads, image variants                                         |
| Async work            | Cloudflare Queues, Cron jobs, Durable Objects                                                                                       |
| Accounts              | Better Auth, email login, Google, GitHub, LinuxDO, Turnstile, beta codes                                                            |
| Credits               | Credit wallet, ledger, signup grants, daily check-ins, referral rewards, redemption codes, expiry cleanup                           |
| Payments              | Dodo, Creem, one-time credit packs, subscriptions, webhooks, refund reversals                                                       |
| Operations            | Admin console, users, credits, codes, feedback, announcements, payments, AI task inspection                                         |
| AI                    | OpenAI, Gemini, SeedDream, Aliyun, Doubao, SeedDance, async tasks, R2 output storage                                                |
| Frontend              | Tailwind CSS, shadcn-svelte, shared UI, English and Chinese i18n, web app                                                           |
| Browser extension     | Chrome extension, WXT, popup, options, background, content scripts                                                                  |
| Documentation and SEO | Markdown docs, sitemap, robots, Open Graph, Twitter Card, JSON-LD                                                                   |
| Deployment            | Cloudflare resource provisioning, environment templates, Worker config generation, separate China domain setup, extension packaging |
| Testing               | TypeScript, Svelte Check, Vitest, BDD helper, local and remote E2E tests                                                            |

These are not isolated demos. They are organized around a real product flow:

```text
Signup -> Beta code -> Credits -> Referral rewards -> Payments and subscriptions -> Notifications -> Feedback -> Admin console
```

Remove the modules you do not need without redesigning these foundational flows from scratch.

---

## Why Cloudflare

One Person Companies should not spend time maintaining servers, autoscaling, Kubernetes, object storage, queues, or CDNs. A serverless platform with usage-based pricing is a better default.

Vercel and Supabase are common choices for independent developers and work well at the beginning. Once a product gains traction, traffic, invocations, storage, queues, and CDN usage can turn into a serious bill.

Cloudflare puts Workers, D1, R2, KV, Queues, Cron, and CDN on one edge platform. It can run signup, usage, payments, async tasks, and file storage at low cost.

A public migration discussion describes a frontend application whose Vercel bill grew from under $100 to over $800 per month. After moving to Cloudflare Workers, the same traffic was estimated to cost under $20, while Lighthouse scores improved: [Is anyone else frustrated with Vercel pricing once you scale?](https://www.reddit.com/r/nextjs/comments/1qnld0e/is_anyone_else_frustrated_with_vercel_pricing/)

The free tier is enough to validate an MVP. When usage grows, the Workers Paid plan starts at $5 per month with usage-based billing. The table below summarizes the core products used by OPCStack:

| Product       | Free tier                                                                              | Workers Paid plan, starting at $5/month                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Workers       | 100,000 requests/day, 10 ms CPU per invocation                                         | Includes 10 million requests/month, then $0.30/million; includes 30 million CPU ms/month, then $0.02/million CPU ms                              |
| D1            | 5 million rows read/day, 100,000 rows written/day, 5 GB storage                        | Includes 25 billion rows read/month, then $0.001/million; includes 50 million rows written/month, then $1/million; storage is $0.75/GB           |
| R2            | 10 GB storage, 1 million Class A operations/month, 10 million Class B operations/month | Storage is $0.015/GB; Class A is $4.50/million; Class B is $0.36/million; egress is free                                                         |
| KV            | 100,000 reads/day, 1,000 writes, deletes, and lists each/day, 1 GB storage             | Includes 10 million reads and 1 million writes, deletes, and lists each/month; then $0.50/million reads and $5/million writes, deletes, or lists |
| Queues        | 10,000 operations/day                                                                  | Includes 1 million operations/month, then $0.40/million                                                                                          |
| Cron Triggers | Included with Workers                                                                  | Billed with Workers, with no separate charge                                                                                                     |
| CDN           | Free, with no separate egress charge                                                   | Free, with no separate egress charge                                                                                                             |

R2's free egress is a major advantage over S3. KV, Queues, and D1 also have no egress fees. These are public prices at the time of writing. Refer to the [official Cloudflare pricing documentation](https://developers.cloudflare.com/workers/platform/pricing/) for current pricing.

---

## More Production-Ready Than a Typical Cloudflare Template

Many Cloudflare starters connect Workers, D1, and R2. That is sufficient for a demo, but not for a SaaS product.

OPCStack additionally provides:

- Separate Meta DB and Tenant Shard DB layers for near-unbounded horizontal growth
- Automatic assignment of new users to active shards
- Active and draining shard states
- D1 read replication and bookmarks
- Saga-style and idempotent side effects for flows spanning Meta DB and Tenant DB
- R2 paths separated into public, private, temporary public, and temporary private data
- AI image, voice, and video tasks backed by Queues, Tenant DB, and R2
- Automated Cloudflare resource preparation for local and production environments

---

## Quick Start

First use:

```text
Create an OPCStack app named <APP_NAME> by following:
https://raw.githubusercontent.com/glidea/opcstack/main/QUICK_START.md
```

The Agent installs the user-level `create-opcstack-app` Skill for its platform, then guides project creation. If `<APP_NAME>` is unchanged, it asks for the app name first.

Later, create another app with the installed Skill:

```text
Use create-opcstack-app to create an app named <APP_NAME>.
```

The Skill reads the latest workflow on every run, so it does not need manual updates.

### Manual Setup

Create the project:

```bash
git clone https://github.com/glidea/opcstack <your-app-name>
cd <your-app-name>
git remote rename origin upstream
pnpm install
vim .env.dev
cp .env.secret.example .env.secret.dev
vim .env.secret.dev
pnpm dev
```

Deploy to Cloudflare:

```bash
pnpm deploy:cloudflare
```

The first remote deployment prompts you to create a Cloudflare API Token. Open the CLI link, create the token, and paste it once. It is then cached in `.wrangler/cloudflare-api-token`.

Develop the extension:

```bash
pnpm dev:extension
pnpm build:extension
```

---

## Project Map

| Path                             | Responsibility                                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                      | AI development context: architecture, directories, runtime, database, R2, queues, frontend, and test conventions |
| `QUICK_START.md`                 | Installs and invokes the platform-native `create-opcstack-app` Skill                                             |
| `CREATE_OPCSTACK_APP.md`         | Canonical project creation and local initialization workflow                                                     |
| `SYNC_TEMPLATE.md`               | Process for syncing updates from the upstream template                                                           |
| `scripts/prepare-public.mjs`     | Generates public frontend artifacts, including client config, web logo, and extension icons                      |
| `scripts/prepare-cloudflare.mjs` | Local and pre-deployment Cloudflare automation: config generation, resource provisioning, and migrations         |
| `wrangler.jsonc.tpl`             | Cloudflare Worker configuration template                                                                         |
| `.env.dev` / `.env.prod`         | Committable public environment configuration                                                                     |
| `.env.secret.example`            | Secret configuration template                                                                                    |
| `src/api-contract/`              | API requests, responses, schemas, and shared types                                                               |
| `src/frontend/lib/`              | Shared frontend layer for UI, i18n, configuration, and client logic                                              |
| `src/frontend/web/`              | Web entrypoint: SvelteKit pages, routes, static assets, and web shell                                            |
| `src/frontend/extension/`        | Chrome extension entrypoint: popup, options, background, and content scripts                                     |
| `src/backend/api/`               | Hono API, authentication, middleware, and business endpoints                                                     |
| `src/backend/db/`                | Drizzle schemas and D1 migrations                                                                                |
| `src/backend/r2/`                | R2 uploads, reads, signing, and image variants                                                                   |
| `src/backend/ai/`                | Chat, image, TTS, realtime, and video providers                                                                  |
| `src/backend/payment/`           | Dodo and Creem payment and subscription logic                                                                    |
| `src/backend/credits/`           | Credit wallet, ledger, grants, debits, and expiry                                                                |
| `src/backend/consumers/`         | Cloudflare Queue consumers                                                                                       |
| `src/backend/jobs/`              | Cron jobs                                                                                                        |
| `src/backend/do/`                | Durable Objects                                                                                                  |
| `public-docs/`                   | Product documentation visible to users                                                                           |
| `template-docs/`                 | Template development documentation                                                                               |
| `e2e/`                           | E2E tests                                                                                                        |

---

## Roadmap

### Operations

- [x] Unified operations and administration console
- [ ] Metrics monitoring and alerts based on Cloudflare Analytics

### Payments and Billing

- [ ] Alipay support
- [ ] Lower-barrier payment providers such as ZPay and Qirun Pay
- [ ] Balance-funded subscriptions
- [ ] Better payment routing and product configuration

### Reliability and Usage Control

- [ ] Unified rate limiting
- [ ] Per-user quotas
- [ ] Usage controls for APIs, AI tasks, storage, and credit consumption

### Multi-Platform Support

- [ ] Mobile support
- [ ] Desktop support

---

## License

Licensed under the [Apache License 2.0](LICENSE).
