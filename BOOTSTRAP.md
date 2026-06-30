# Bootstrap Onboarding Flow

> Agent workflow for bringing a freshly cloned OPCStack project to a local running state

---

## Goal

Help the user run the project locally with the smallest required setup.

Bootstrap is not a full product configuration guide. Its job is to get the user to a working `http://localhost:5173`, then route them to the right next action.

---

## Non-goals

Do not front-load these tasks during local bootstrap:

- Production domain setup
- Resend domain verification
- OAuth app creation
- Payment provider setup
- AI provider key setup
- Logo or brand polish
- Product documentation rewrite
- Cloudflare remote deployment

Only discuss these after local bootstrap succeeds, or when the user explicitly asks.

---

## Secret Rules

Secrets must not enter the conversation context.

Agents must follow these rules:

- Do not read `.env.secret.dev`
- Do not read `.env.secret.prod`
- Do not read `.wrangler/runtime-secrets.env`
- Do not write secret files
- Do not ask the user to paste secrets into chat
- Do not print secret values
- Tell the user to edit secret files locally when secret values are required

If a command fails because a secret is missing, explain which key is missing and ask the user to fill it locally. Do not inspect the secret file.

---

## Directory Positioning

Use the right source for the right job.

| Path | Role |
| --- | --- |
| `README.md` | Project value, positioning, quick entry |
| `BOOTSTRAP.md` | Agent workflow for local first-run onboarding |
| `AGENTS.md` | Stable Agent development context, architecture, rules, workflows |
| `template-docs/` | Template context docs for Agents and developers |
| `public-docs/` | Product-facing docs rendered by the app at `/docs/` |
| `docs/` | Local ignored development notes, not a template user guide |

`template-docs/` is the stable template explanation layer. It is not rendered by the app and only needs English content.

`public-docs/` ships with OPCStack product docs by default. It demonstrates the docs system and gives the template a default product documentation surface, but users may replace it with their own product docs. Do not treat `public-docs/` as a stable dependency for Agent onboarding.

When the user wants to understand or modify a template module, inspect `AGENTS.md`, `template-docs/`, source code, and tests. Do not require `public-docs/` for development context.

---

## Phase 1: Check Local Prerequisites

Run these checks:

```bash
node --version
pnpm --version
```

Requirements:

- Node.js `>= 20`
- pnpm `>= 9`

If dependencies are not installed, run:

```bash
pnpm install
```

Do not require Cloudflare login for local bootstrap. `pnpm dev` runs `scripts/prepare-cloudflare.mjs` in local mode and does not need remote Cloudflare provisioning.

---

## Phase 2: Collect Minimal Public Config

Ask only for the minimum information needed for local development:

1. Project name
   - Used as `APP_NAME`
   - Use lowercase letters, numbers, and hyphens
   - Example: `my-saas`

2. Super admin email
   - Used as `SUPER_ADMIN_EMAIL`
   - Example: `admin@example.com`

3. Local auth mode
   - Recommended: email auth enabled with verification disabled
   - Alternative: keep current defaults and let the user configure real email later

Do not ask for production domain, Resend API key, OAuth client secret, payment keys, or AI provider keys in this phase.

---

## Phase 3: Update Public Local Config

Update `.env.dev` only. This file is public config and can be committed.

Minimal recommended local values:

```text
APP_NAME=<project-name>
APP_DOMAIN=localhost
SUPER_ADMIN_EMAIL=<admin-email>
EMAIL_ENABLED=true
EMAIL_SIGNUP_ENABLED=true
EMAIL_REQUIRE_VERIFICATION=false
BETA_CODE_ENABLED=false
```

Keep unrelated settings unchanged unless the user explicitly asks.

Notes:

- `TURNSTILE_ENABLED=true` is safe locally because `scripts/prepare-cloudflare.mjs` uses Cloudflare test keys in local mode
- R2, Queues, Cron, and AI queue names may already be enabled in `.env.dev`; do not force users to configure them during bootstrap
- Production-only values belong in `.env.prod` and `.env.secret.prod`, not in local bootstrap

---

## Phase 4: Prepare Local Secrets

Ask the user to create and edit `.env.secret.dev` locally:

```bash
cp .env.secret.example .env.secret.dev
```

Required local keys:

```text
BETTER_AUTH_SECRET
SUPER_ADMIN_PASSWORD
ADMIN_API_TOKEN
R2_ORIGIN_SIGNING_SECRET
```

Tell the user:

```text
Edit .env.secret.dev locally. Do not paste secret values into chat.
After saving the file, reply that it is ready.
```

Do not read or write `.env.secret.dev`.

If the user wants generated values, provide a local command that writes to their file without printing the values only if such a script exists. If no script exists, ask the user to generate values locally with their own password manager or shell command.

---

## Phase 5: Start Local Development

Run:

```bash
pnpm dev
```

This command:

- Runs SvelteKit sync
- Runs `scripts/prepare-cloudflare.mjs` in local mode
- Generates `wrangler.jsonc`
- Generates local D1 bindings
- Writes runtime secret bindings from the user's secret file
- Starts Wrangler on port `8787`
- Starts Vite on port `5173`

Verify:

```bash
curl -i http://localhost:5173/api/health
```

Then tell the user to open:

```text
http://localhost:5173
```

Do not finish bootstrap while a required dev server command is still running unless the user asks to stop.

---

## Phase 6: Route The Next Step

After local bootstrap succeeds, do not continue into every possible configuration task. Ask what the user wants next.

Use these options:

```text
1. Build a business feature
2. Configure production environment
3. Understand a template module
```

### If The User Chooses Build A Business Feature

Use `AGENTS.md` and inspect source code directly.

Route by feature type:

| Feature type | Stable references |
| --- | --- |
| API | `AGENTS.md`, `src/api/index.ts`, `src/api/handler/`, existing handler tests |
| Page | `AGENTS.md`, `src/web/routes/`, `src/web/lib/components/`, `src/web/lib/ui/` |
| Database | `AGENTS.md`, `src/db/schema.meta.ts`, `src/db/schema.shard.ts`, migrations |
| R2 storage | `AGENTS.md`, `src/r2/`, `src/api/handler/r2.ts` |
| Payment | `AGENTS.md`, `src/payment/`, `src/api/handler/payment.ts` |
| Credits | `AGENTS.md`, `src/credits/`, `src/api/handler/credits.ts` |
| Queue or Cron | `AGENTS.md`, `src/consumers/`, `src/jobs/` |
| AI | `AGENTS.md`, `src/ai/`, `src/consumers/` |

Do not require the user to read `public-docs/` before development. The Agent should inspect stable template docs, source files, and tests, then explain the relevant path.

### If The User Chooses Configure Production Environment

Ask which modules they want enabled in production:

- Email auth
- OAuth
- Payment
- AI providers
- R2 uploads
- Queues and Cron
- Beta code
- Affiliate rewards

Guide config module by module.

Rules:

- Public values go to `.env.prod`
- Secret values go to `.env.secret.prod`
- The user edits secret files locally
- The Agent does not read secret files
- Deployment is done with `pnpm deploy:cloudflare`

Explain that `scripts/prepare-cloudflare.mjs --mode prod` automatically provisions Cloudflare resources such as D1, shard D1 databases, KV, R2, Queues, Turnstile widget, R2 CORS, lifecycle rules, and read replication.

### If The User Chooses Understand A Template Module

Inspect in this order:

1. Relevant `AGENTS.md` section
2. Relevant `template-docs/` page
3. Relevant source module
4. Existing tests

Explain:

- What the module does
- Which files own the behavior
- Which config keys matter
- Which API routes exist
- What should not be changed casually

---

## Completion Message

When local bootstrap is complete, summarize only what matters:

```text
Local bootstrap is complete.

App: http://localhost:5173
Health: http://localhost:5173/api/health

Next step:
- Build a business feature
- Configure production environment
- Understand a template module
```

Keep the message short. Do not dump configuration values, and never print secrets.
