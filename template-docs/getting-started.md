---
title: Getting Started
description: Clone, configure, run, deploy, and build the extension
group: Getting Started
order: 1
---

# Getting Started

## 1. Create with an Agent

First use:

```text
Create an OPCStack app named <APP_NAME> by following:
https://raw.githubusercontent.com/glidea/opcstack/main/QUICK_START.md
```

The Agent installs the user-level `create-opcstack-app` Skill for its platform, then creates and initializes the project. If `<APP_NAME>` is unchanged, it asks for the app name first.

Later, create another app with the installed Skill:

```text
Use create-opcstack-app to create an app named <APP_NAME>.
```

The Skill reads the latest workflow on every run, so it does not need manual updates.

## 2. Manual Setup

```bash
git clone https://github.com/glidea/opcstack <your-app-name>
cd <your-app-name>
git remote rename origin upstream
pnpm install
vim .env.dev
pnpm dev
```

After startup open http://localhost:5173

Set `SYSTEM_EMAIL` before the first preparation. The command creates that D1 administrator and prints a random one-time password. Sign in, replace the password under Settings, then configure business features under Admin / System Settings. `.env.dev` and `.env.prod` also own build-time theme and R2 upload policy. Internal root secrets are generated automatically; business credentials are encrypted in D1.

## 3. Deploy to Cloudflare

```bash
pnpm deploy:cloudflare
```

First remote deploy prompts you to create a Cloudflare API Token. Follow the link, create it, paste it once. The token is cached in `.wrangler/cloudflare-api-token` after that.

See [Deployment](guides/deployment.md) for the full provisioning and deploy flow.

## 4. Access the admin console

Sign in with the administrator email and one-time password printed by the first preparation, replace the password under Settings, then open `/{locale}/admin`. See [Admin Console](guides/admin-console.md) for every page and operator workflow.

## 5. Develop the browser extension

```bash
pnpm dev:extension
pnpm build:extension
```

See [Frontend](guides/frontend.md) for extension entrypoints and shared frontend layer.

## Optional: China access domain

If you need a separate China entrypoint, set `APP_CN_DOMAIN` in `.env.dev` or `.env.prod`. `prepare:cloudflare:*` auto wires it into R2 CORS and Turnstile domains. It adds a Worker custom domain when no external CNAME target is configured.

To auto configure DNS, also set `APP_CN_CNAME_TARGET`. The script creates or updates one unproxied CNAME and adds a normal Worker zone route for that hostname. It does not pick acceleration targets; you provide the target from your DNS acceleration provider.

## Sync template updates

```bash
git fetch upstream --tags
git merge upstream/main
```
