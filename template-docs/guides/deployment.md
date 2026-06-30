---
title: Deployment
description: Deploy to Cloudflare Workers
group: Guides
order: 7
---

# Deployment

Deploying OPC Stack to Cloudflare Workers is straightforward.

## Before deployment

### 1. Configure production environment variables

Edit `.env.prod` for public config:

```bash
APP_NAME=your-app
APP_DOMAIN=your-domain.com
EMAIL_ENABLED=true
EMAIL_FROM=noreply@your-domain.com
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
BETA_CODE_ENABLED=false
QUEUE_NAMES=task-check;email-send
CRONS=0 0 * * *,0 */6 * * *
```

Create `.env.secret.prod` for secret config:

```bash
EMAIL_RESEND_API_KEY=re_xxx
GOOGLE_CLIENT_SECRET=xxx
CHAT_OPENAI_API_KEY=sk-xxx
IMAGE_GEMINI_API_KEY=xxx
```

### 2. Login Cloudflare

```bash
wrangler login
```

## Deploy

### One command deploy

```bash
pnpm deploy:cloudflare
```

This command will:
1. Run `scripts/prepare-cloudflare.mjs --mode prod`
2. Create all Cloudflare resources including D1, R2, KV, and Queues
3. Enable D1 read replication
4. Apply migrations
5. Deploy to Cloudflare Workers

### Check deployment status

```bash
# Deployment logs
wrangler tail

# Deployment list
wrangler deployments list
```

## Custom domain

### 1. Add domain to Cloudflare

Add domain in Cloudflare dashboard and configure DNS records.

### 2. Bind domain to Worker

```bash
wrangler domains add your-domain.com
```

Or bind it manually in Cloudflare dashboard.

### 3. Configure SSL

Cloudflare provides free SSL certificates automatically.

## Environment variables

### Configure in Cloudflare dashboard

1. Open Workers and Pages
2. Select your Worker
3. Open Settings -> Variables
4. Add variables

### Configure by Wrangler

```bash
# Set secret
wrangler secret put CHAT_OPENAI_API_KEY

# List secrets
wrangler secret list
```

## Rollback

### Roll back to previous deployment

```bash
# Show deployment history
wrangler deployments list

# Roll back to target deployment
wrangler rollback [deployment-id]
```

## Monitoring

### Logs

```bash
# Real time logs
wrangler tail

# Filter errors
wrangler tail --status error
```

### Metrics

In Cloudflare dashboard you can inspect:
- request count
- error rate
- CPU time
- memory usage

## Performance optimization

### 1. Enable cache

```typescript
// Cache static assets
return new Response(body, {
  headers: {
    'Cache-Control': 'public, max-age=31536000'
  }
})
```

### 2. Use KV cache

```typescript
// Cache API response
const cached = await env.KV.get(cacheKey)
if (cached) {
  return ctx.json(JSON.parse(cached))
}

const data = await fetchData()
await env.KV.put(cacheKey, JSON.stringify(data), {
  expirationTtl: 3600
})
```

### 3. Optimize database queries

```typescript
// Use index
await db.query.users.findFirst({
  where: eq(users.email, email)
})

// Batch query
const users = await db.query.users.findMany({
  where: inArray(users.id, userIds)
})
```

## CI and CD

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm deploy:cloudflare
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

### Configure secrets

Add these in repository settings:
- `CLOUDFLARE_API_TOKEN`
- other environment variables

## Multi environment deployment

### Configure multiple environments

```bash
# Deploy staging
wrangler deploy --env staging

# Deploy production
wrangler deploy --env production
```

### wrangler.jsonc example

```jsonc
{
  "name": "your-app",
  "main": "src/index.ts",
  "compatibility_date": "2024-01-01",
  "env": {
    "staging": {
      "vars": {
        "ENVIRONMENT": "staging"
      }
    },
    "production": {
      "vars": {
        "ENVIRONMENT": "production"
      }
    }
  }
}
```

## FAQ

**Q: What should I do if deployment fails**

Check Wrangler version, inspect error logs, and verify environment variables.

**Q: How to update dependencies**

Update `package.json` then deploy again.

**Q: Why do I get 404 after deployment**

Check domain binding and DNS propagation.
