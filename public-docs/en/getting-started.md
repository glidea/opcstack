---
title: Getting Started
description: Quickly run this starter template
group: Getting Started
order: 1
---

# Getting Started

## 1. Get the project and set upstream tracking

```bash
git clone https://github.com/glidea/opcstack <your-app-name>
cd <your-app-name>
git remote rename origin upstream
git remote add origin <your-repo-url>
git push -u origin main
pnpm install
```

## 2. Initialize the project

AI guided setup is recommended

```bash
claude
@AGENTS.md @BOOTSTRAP.md
```

Manual setup

```bash
vim .env.dev # public config
cp .env.secret.example .env.secret.dev
vim .env.secret.dev # secret config
pnpm dev
```

After startup open http://localhost:5173

## 3. Sync template updates later

```bash
git fetch upstream --tags
git merge upstream/main
```

## Core concepts

### Request routing

```
HTTP Request
  ├── /api/*      -> Hono API (backend endpoints)
  └── other path  -> SvelteKit SSR (frontend pages)

Cron Trigger       -> scheduled jobs
Queue Consumer     -> queue consumers
```

All `/api/*` requests are handled by Hono. Other requests are handled by SvelteKit.

### Directory structure

```
src/
  api/              # Backend API
    handler/        # Your API handlers
    middleware/     # Middlewares (auth, beta code, etc.)
  web/              # Frontend pages
    routes/         # Your pages
    lib/ui/         # UI components
  db/               # Database
    schema.ts       # Table schema
  jobs/             # Scheduled jobs
  consumers/        # Queue consumers
```

### Conventions

- API routes: register in `src/api/index.ts`
- Database: edit `src/db/schema.ts`, restart `pnpm dev` to auto run migration
- Queue binding: `Q_<QUEUE_NAME_UPPER>` (for example `task-check` -> `Q_TASK_CHECK`)
- R2 path: public `public/*`, private `private/<userId>/*`

## Build your first feature

### Backend API

1. Create a handler in `src/api/handler/`
2. Register route in `src/api/index.ts`
3. Get user id by `ctx.get('userId')`
4. Get database by `ctx.get('db')`

### Frontend page

1. Create a page in `src/web/routes/`
2. Put components in `src/web/lib/ui/`
3. Put i18n messages in `src/web/lib/i18n/messages/`

### Database

1. Edit `src/db/schema.ts` to define tables
2. Restart `pnpm dev` to auto generate and apply migration

## Develop faster with AI

Use `@AGENTS.md` to help AI understand this project:

```bash
# In project root
claude

# Reference AGENTS.md
@AGENTS.md Help me implement a user profile page
```

AGENTS.md contains complete project context so AI can generate correct code based on project structure.

## Recommended workflow

1. Define requirements: clarify what you need
2. Design data model: tables and fields
3. Use AI: `@AGENTS.md` to implement faster
4. Test: run `pnpm test` and `pnpm test:e2e`
5. Deploy: run `pnpm deploycf`

## FAQ

### How to get current user

```ts
const userId = ctx.get('userId')
if (!userId) {
  return ctx.json({ error: 'Unauthorized' }, 401)
}
```

### How to query database

```ts
const db = ctx.get('db')
const users = await db.select().from(userTable)
```

### How to upload files to R2

```ts
import { createR2Client } from './src/r2'

const client = createR2Client(env, userId)
await client.putImage({ dir, imageBase64, mimeType })
```

### How to send queue messages

```ts
await env.Q_TASK_CHECK.send({ data: 'hello' })
```
