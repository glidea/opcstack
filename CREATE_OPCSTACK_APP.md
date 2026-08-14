# Create OPCStack App

> Canonical workflow used by the `create-opcstack-app` Skill

---

## Goal

Create a new OPCStack project and run it locally with the smallest required setup.

This is not a full product configuration guide. Its job is to get the user to a working `http://localhost:5173`, then route them to the right next action.

---

## Non-goals

Do not front-load these tasks during local setup:

- Production domain setup
- Resend domain verification
- OAuth app creation
- Payment provider setup
- AI provider key setup
- Logo or brand polish
- Product documentation rewrite
- Cloudflare remote deployment

Only discuss these after local setup succeeds, or when the user explicitly asks.

---

## Secret Rules

Secrets must not enter the conversation context.

Agents must follow these rules:

- Do not read generated secret state under `.wrangler/`
- Do not edit generated secret state
- Do not ask the user to paste secrets into chat
- Do not print secret values
- Enter third-party credentials only through the running System settings or provider workspace, or through its OAuth-authorized API

Users do not maintain business secret env files. `prepare-cloudflare` owns the internal root secrets. If generated root secret state is missing after D1 initialization, report that recovery is required; never generate a replacement root.

---

## Directory Positioning

Use the right source for the right job.

| Path | Role |
| --- | --- |
| `README.md` | Project value, positioning, quick entry |
| `QUICK_START.md` | Installs and invokes the `create-opcstack-app` Skill |
| `CREATE_OPCSTACK_APP.md` | Canonical project creation workflow |
| `AGENTS.md` | Stable Agent development context, architecture, rules, workflows |
| `template-docs/` | Template context docs for Agents and developers |
| `public-docs/` | Product-facing docs rendered by the app at `/docs/` |
| `docs/` | Local ignored development notes, not a template user guide |

`template-docs/` is the stable template explanation layer. It is not rendered by the app and only needs English content.

`public-docs/` ships with OPCStack product docs by default. It demonstrates the docs system and gives the template a default product documentation surface, but users may replace it with their own product docs. Do not treat `public-docs/` as a stable dependency for Agent onboarding.

When the user wants to understand or modify a template module, inspect `AGENTS.md`, `template-docs/`, source code, and tests. Do not require `public-docs/` for development context.

---

## Phase 1: Create The Project

Use the `APP_NAME` passed to the Skill. If it is missing or still contains `<APP_NAME>`, ask the user for it before running commands.

The app name must use lowercase letters, numbers, and hyphens. Example: `my-saas`.

Run these checks from the parent directory where the project should be created:

```bash
git --version
node --version
pnpm --version
```

Requirements:

- Node.js `>= 20`
- pnpm `>= 9`

Create the project:

```bash
git clone https://github.com/glidea/opcstack <app-name>
cd <app-name>
git remote rename origin upstream
pnpm install
```

Keep `upstream` even when the user does not create their own GitHub repository. It is required for syncing template updates.

Do not require Cloudflare login for local setup. `pnpm dev` runs `scripts/prepare-cloudflare.mjs` in local mode and does not need remote Cloudflare provisioning.

---

## Phase 2: Collect Minimal Public Config

Use the project name already provided to the Skill as `APP_NAME`. Ask for the administrator email that will own the first local D1 account. Do not ask for an administrator password, production domain, provider credential, or business configuration before local startup.

---

## Phase 3: Update Public Local Config

Update `.env.dev` only. This file is public config and can be committed.

Minimal recommended local values:

```text
APP_NAME=<project-name>
SYSTEM_EMAIL=<administrator-email>
APP_DOMAIN=localhost
```

Keep unrelated settings unchanged unless the user explicitly asks.

Notes:

- Authentication, Email, Turnstile, social login, and beta gate are configured after startup in System settings
- R2 upload policy, Queues, Cron, and AI queue names may already have template values in `.env.dev`; do not ask about them during local setup unless the user wants to change the defaults
- Production deployment topology belongs in `.env.prod`, not in local setup

---

## Phase 4: Start And Initialize Local Development

Run:

```bash
pnpm dev
```

As part of this command, `prepare-cloudflare` generates `BETTER_AUTH_SECRET`, `CONFIG_ENCRYPTION_KEY`, and `R2_ORIGIN_SIGNING_SECRET` on first initialization. Local development keeps this generated state inside the ignored `.wrangler/` directory. Production uploads independently generated values as Cloudflare Worker Secrets.

The same initialization creates the unique local D1 administrator using `SYSTEM_EMAIL` and a random password. The command prints the credentials only after the first initialization succeeds. Later preparation never changes the D1 email or password. Tell the user to sign in and replace the generated password under Settings. The settings page intentionally does not allow changing the administrator email.

This command:

- Runs SvelteKit sync
- Runs `scripts/prepare-cloudflare.mjs` in local mode
- Generates `wrangler.jsonc`
- Generates local D1 bindings
- Writes generated system secrets and remaining user-provided runtime secret bindings
- Creates the D1 administrator and prints its one-time initial credentials when absent
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

Do not finish local setup while a required dev server command is still running unless the user asks to stop.

---

## Phase 5: Offer A GitHub Repository

After local startup succeeds, ask whether the user wants to create a private GitHub repository.

If the user agrees, run:

```bash
gh repo create <app-name> --private --source=. --remote=origin --push
```

If `gh` is not installed or authenticated, guide the user through that setup before retrying. GitHub repository creation is optional and must not block local setup.

Whether or not `origin` exists, keep `upstream` pointed at `https://github.com/glidea/opcstack`.

---

## Phase 6: Route The Next Step

After local setup succeeds, do not continue into every possible configuration task. Ask what the user wants next.

Use these options:

```text
1. Build a business feature
2. Configure local business capabilities
3. Configure production environment
4. Understand a template module
```

### If The User Chooses Build A Business Feature

Use `AGENTS.md` and inspect source code directly.

Route by feature type:

| Feature type | Stable references |
| --- | --- |
| API | `AGENTS.md`, `src/backend/api/index.ts`, `src/backend/api/handler/`, existing handler tests |
| Web page | `AGENTS.md`, `src/frontend/web/routes/`, `src/frontend/lib/app-ui/`, `src/frontend/lib/ui/` |
| Browser extension | `AGENTS.md`, `src/frontend/extension/entrypoints/`, `src/frontend/extension/wxt.config.ts`, `src/frontend/lib/` |
| Database | `AGENTS.md`, `src/backend/db/schema.meta.ts`, `src/backend/db/schema.shard.ts`, migrations |
| R2 storage | `AGENTS.md`, `src/backend/r2/`, existing R2 handler and tests |
| Payment | `AGENTS.md`, `src/backend/payment/`, existing payment handlers and tests |
| Credits | `AGENTS.md`, `src/backend/credits/`, existing credits handlers and tests |
| Queue or Cron | `AGENTS.md`, `src/backend/consumers/`, `src/backend/jobs/` |
| AI | `AGENTS.md`, `src/backend/ai/`, `src/backend/consumers/` |

Do not require the user to read `public-docs/` before development. The Agent should inspect stable template docs, source files, and tests, then explain the relevant path.

### If The User Chooses Configure Local Business Capabilities

Keep the local servers running and guide the user through the relevant workspace:

- System settings for Authentication, Email, Credits, Affiliate, Payment credentials, and AI routing
- Payment products for remote payment product links and local entitlements
- AI providers for endpoints, models, credentials, and availability

When an Agent or CLI needs API access, run `opc auth connect` against `http://localhost:5173`, show the authorization URL, and wait for the user to approve explicit scopes. OAuth API access is available locally and in production; it is not a production-only step.

### If The User Chooses Continue Extension Development

Run:

```bash
pnpm dev:extension
```

Use `src/frontend/extension/entrypoints/` for extension entrypoint code and `src/frontend/lib/` for shared frontend code.

Do not duplicate UI, config parsing, or API client setup inside the extension when the shared frontend layer already covers it.

### If The User Chooses Configure Production Environment

First collect only fixed deployment topology in `.env.prod`:

| Key | Purpose |
| --- | --- |
| `APP_NAME` | Stable Worker and resource prefix |
| `APP_VERSION` | Public release version |
| `DESIGN_SYSTEM` | Build-time UI design system |
| `SYSTEM_EMAIL` | Administrator email used only when Meta D1 is empty |
| `APP_DOMAIN` | Primary production hostname |
| `APP_CN_DOMAIN` | Optional China hostname |
| `APP_CN_CNAME_TARGET` | Optional unproxied CNAME target for the China hostname |
| `EXTENSION_HOST_PERMISSIONS` | Chrome extension origins |
| `D1_SHARDS` | Regional tenant D1 layout |
| `R2_ENABLED` | R2 binding and bucket topology |
| `R2_USER_UPLOAD_ALLOWED_CONTENT_TYPES` | Upload MIME allowlist |
| `R2_USER_UPLOAD_MAX_BYTES` | Maximum upload size in bytes |
| `R2_TMP_LIFECYCLE_RULES` | Temporary object retention |
| `QUEUE_NAMES` | Queue bindings and consumers |
| `QUEUE_MAX_CONCURRENCY` | Optional queue consumer limit |
| `CRONS` | Worker cron triggers |
| `DO_NAMES` | Durable Object bindings |

These are the complete long-lived ENV inputs. `SYSTEM_EMAIL` is an initialization input, not a runtime override of the D1 administrator. Do not add Authentication, Email Provider, Credits, Affiliate, Payment, AI, or third-party credentials to ENV.

Then run `pnpm deploy:cloudflare`. Production D1 is independent from local D1. On the first production deployment, it creates a separate administrator from `.env.prod` `SYSTEM_EMAIL`, generates a separate random password, and prints those credentials once. Retain them, open the deployed application, sign in, and change the generated password under Settings.

After the shell is running, ask which business modules they want to configure:

- Authentication and external OAuth
- Email
- Credits and affiliate rewards
- Payment and products
- AI Providers

Rules:

- Fixed deployment topology goes to `.env.prod`
- Singleton business settings and third-party credentials go to Meta D1 through System settings
- Payment products and AI providers use their standalone workspaces
- Human operators use the browser Session
- Agents and CLI clients run `opc auth connect`, show the authorization URL, and wait for the user to approve explicit scopes
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

When local setup is complete, summarize only what matters:

```text
Local setup is complete.

App: http://localhost:5173
Health: http://localhost:5173/api/health

Next step:
- Build a business feature
- Configure local business capabilities
- Configure production environment
- Understand a template module
```

Keep the message short. Do not dump configuration values, and never print secrets.
