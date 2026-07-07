---
title: Getting Started
description: Clone, configure, run, deploy, and build the extension
group: Getting Started
group_order: 0
order: 1
---

# Getting Started

## 1. Create your project

```bash
git clone https://github.com/glidea/opcstack <your-app-name>
cd <your-app-name>
git remote rename origin upstream
git remote add origin <your-repo-url>
git push -u origin main
pnpm install
```

## 2. Initialize the project

AI guided setup is recommended:

```bash
@AGENTS.md @BOOTSTRAP.md
```

`BOOTSTRAP.md` guides the agent through local setup. `AGENTS.md` is the development context the agent uses for all future work.

Manual setup:

```bash
vim .env.dev
cp .env.secret.example .env.secret.dev
vim .env.secret.dev
pnpm dev
```

After startup open http://localhost:5173

Public config lives in `.env.dev` and `.env.prod`. Secrets live in `.env.secret.dev` and `.env.secret.prod`. Do not commit secret files. See [Deployment](guides/deployment.md) for the full env system.

## 3. Deploy to Cloudflare

```bash
pnpm deploy:cloudflare
```

First remote deploy prompts you to create a Cloudflare API Token. Follow the link, create it, paste it once. The token is cached in `.wrangler/cloudflare-api-token` after that.

See [Deployment](guides/deployment.md) for the full provisioning and deploy flow.

## 4. Develop the browser extension

```bash
pnpm dev:extension
pnpm build:extension
```

See [Frontend](guides/frontend.md) for extension entrypoints and shared frontend layer.

## Optional: China access domain

If you need a separate China entrypoint, set `APP_CN_DOMAIN` in `.env.dev` or `.env.prod`. `prepare:cloudflare:*` wires it into R2 CORS and Turnstile domains. Without `APP_CN_CNAME_TARGET`, it uses a Worker custom domain. With `APP_CN_CNAME_TARGET`, it keeps your preferred CNAME and attaches the Worker through a normal zone route.

## Sync template updates

```bash
git fetch upstream --tags
git merge upstream/main
```
