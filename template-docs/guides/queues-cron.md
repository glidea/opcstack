---
title: Queues and Cron
description: Cloudflare Queues, Cron Triggers, async consumers, and scheduled jobs
group: Guides
order: 4
---

# Queues and Cron

OPCStack uses Cloudflare Queues for async work and Cloudflare Cron Triggers for periodic jobs. Both enter the same Worker deployment through `src/index.ts`, then dispatch to backend handlers.

```
Cloudflare Worker
  |
  +-- queue(batch, env, ctx)
  |     |
  |     +-- src/backend/consumers/index.ts
  |
  +-- scheduled(controller, env, ctx)
        |
        +-- src/backend/jobs/index.ts
```

Keep queues and cron boring. A queue message should identify durable state. It should not carry the whole job payload.

## Runtime Model

`src/index.ts` exports three Worker entrypoints:

| Entrypoint | Handler | Purpose |
| --- | --- | --- |
| `fetch` | API or SvelteKit SSR | User requests and webhooks |
| `queue` | `handleQueue` | Cloudflare Queue batches |
| `scheduled` | `handleScheduled` | Cron Trigger events |

Queues are configured by name. Cron jobs are configured by exact cron expression. Unknown queues or unknown cron expressions are skipped.

## Config

Queue and cron config lives in `.env.dev` and `.env.prod`.

```bash
QUEUE_NAMES=image-generate;tts-generate;video-generate
QUEUE_MAX_CONCURRENCY=
CRONS=*/10 * * * *
```

Rules:

| Key | Format | Meaning |
| --- | --- | --- |
| `QUEUE_NAMES` | Semicolon-separated names | Queue resources and Worker producer/consumer bindings |
| `QUEUE_MAX_CONCURRENCY` | Empty or integer `1..250` | Optional Cloudflare consumer max concurrency |
| `CRONS` | Semicolon-separated cron expressions | Worker Cron Triggers |

Empty `QUEUE_NAMES` means no queue bindings. Empty `CRONS` means no cron triggers.

`prepare-cloudflare.mjs` deduplicates queue names after trimming whitespace. It does not validate queue names beyond binding-name conversion, so keep names lowercase and hyphenated.

## Generated Bindings

`prepare-cloudflare.mjs` converts queue names to Worker bindings:

| Queue name | Binding |
| --- | --- |
| `image-generate` | `Q_IMAGE_GENERATE` |
| `tts-generate` | `Q_TTS_GENERATE` |
| `video-generate` | `Q_VIDEO_GENERATE` |
| `task-check` | `Q_TASK_CHECK` |

Binding rule:

```
Q_<QUEUE_NAME_UPPER_WITH_NON_ALNUM_AS_UNDERSCORE>
```

Generated `wrangler.jsonc` contains both producers and consumers:

```json
{
  "queues": {
    "producers": [
      {
        "binding": "Q_IMAGE_GENERATE",
        "queue": "image-generate"
      }
    ],
    "consumers": [
      {
        "queue": "image-generate"
      }
    ]
  }
}
```

When `QUEUE_MAX_CONCURRENCY=1`, each consumer entry also gets `max_concurrency: 1`.

## Queue Dispatch

All queue dispatch starts at `src/backend/consumers/index.ts`.

```typescript
export async function handleQueue(
  batch: MessageBatch<unknown>,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  const handler = queueHandlers[batch.queue]
  if (!handler) {
    return
  }

  await handler(batch, env, ctx)
}
```

Registered handlers:

| Queue | Handler |
| --- | --- |
| `image-generate` | `handleAIImageQueue` |
| `tts-generate` | `handleAITTSQueue` |
| `video-generate` | `handleAIVideoQueue` |

Do not add branching inside `src/index.ts`. Add a handler to `queueHandlers`.

## Queue Message Rules

Queue messages should be small and durable-state based.

Current AI queues use this shape:

```typescript
{
  taskId: string
  userId: string
}
```

This is intentional:

- `taskId` points to the row that contains prompt, provider, model, references, and output options
- `userId` lets the consumer reopen the correct Tenant Shard DB through Meta DB
- retry is idempotent because the task row is the source of truth

Do not put prompts, API keys, provider configs, R2 options, or full user payloads into queue messages.

## Existing AI Queues

Image, TTS, and video async tasks are tenant-owned. They are stored in Tenant Shard DB tables:

| Queue | Table | Task creator |
| --- | --- | --- |
| `image-generate` | `ai_image_tasks` | `createAIImageTask` |
| `tts-generate` | `ai_tts_tasks` | `createAITTSTask`, `createAITTSSourceTask` |
| `video-generate` | `ai_video_tasks` | `createAIVideoTask` |

Flow:

```
request handler or service
  |
  +-- insert processing task row in Tenant Shard DB
  |
  +-- env.Q_*.send({ taskId, userId })
        |
        +-- consumer opens user's Tenant Shard DB
        |
        +-- load task row
        |
        +-- call AI provider
        |
        +-- update task row to completed or failed
```

The consumer opens the user's DB with:

```typescript
const metaDb = getMetaDb(env.META_DB)
const tenant = await createTenantShardAccess(metaDb, env).openUserDb(userId)
```

That lookup is required because queue events do not have request middleware context.

## Retry and Ack Rules

Consumers must explicitly finish each message:

| Action | Meaning |
| --- | --- |
| `message.ack()` | Message is done and should not retry |
| `message.retry({ delaySeconds })` | Message should be retried later |

Current AI retry behavior:

| Queue | Max attempts | Delay |
| --- | --- | --- |
| `image-generate` | 3 | 10s, 30s |
| `tts-generate` | 3 | 10s, 30s |
| `video-generate` | 3 failure attempts | 10s, 30s |

Video has one extra rule: if the remote SeedDance provider task is still running, the consumer retries the queue message after 30 seconds without incrementing `attemptCount`.

Consumers ack missing or non-processing tasks. That is not swallowing a bug. It is idempotency: a duplicate message should not re-run a completed task.

## Cron Dispatch

All Cron Trigger dispatch starts at `src/backend/jobs/index.ts`.

```typescript
export async function handleScheduled(
  controller: ScheduledController,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  const handler = scheduledHandlers[controller.cron]
  if (!handler) {
    return
  }

  await handler(controller, env, ctx)
}
```

The key is the exact cron expression string from Cloudflare. If `CRONS` contains `*/10 * * * *`, the handler map must also use `*/10 * * * *`.

## Existing Cron Jobs

Current registered job:

| Cron | Job |
| --- | --- |
| `*/10 * * * *` | Run credit maintenance and clean AI history on every active or draining tenant shard |

The job:

1. Opens Meta DB
2. Lists active and draining tenant shard DBs
3. Runs `CreditsService.expire({ limit: 20 })` on each shard
4. Runs `CreditsService.cleanupTransactions({ limit: 100 })` on each shard
5. Deletes AI channel metric buckets older than 24 hours
6. Deletes `completed` and `failed` Image, TTS, and Video task rows older than `AI_TASK_RETENTION_DAYS`
7. Logs structured job results

`CREDITS_HISTORY_RETENTION_DAYS` controls transaction cleanup retention. Current parsing falls back to `90` when the value is missing or invalid. That is existing behavior; do not copy this pattern into new config without a product reason.

`AI_TASK_RETENTION_DAYS` is strictly validated by the Cloudflare preparation step and has no runtime fallback. AI cleanup uses indexed timestamp predicates, never deletes `processing` tasks, and never reads task result JSON or accesses R2.

## Add A Queue

Add a queue only when work must continue outside the request lifecycle.

Steps:

1. Add the queue name to `QUEUE_NAMES`
2. Run `pnpm prepare:cloudflare:dev`
3. Use the generated binding, for example `env.Q_TASK_CHECK.send(...)`
4. Add a message type near the domain that owns the task
5. Add a consumer handler under `src/backend/consumers/`
6. Register it in `queueHandlers`
7. Add unit tests for dispatch, ack, retry, and idempotent duplicate handling

Minimal message shape:

```typescript
export interface TaskCheckQueueMessage {
  taskId: string
  userId: string
}
```

Send:

```typescript
await env.Q_TASK_CHECK.send({
  taskId,
  userId
})
```

Do not create a generic queue framework. The map in `queueHandlers` is enough.

## Add A Cron

Add cron only when the job is truly periodic. If the work is user-triggered or provider-triggered, use a queue or webhook.

Steps:

1. Add the cron expression to `CRONS`
2. Add a handler in `scheduledHandlers`
3. Keep the handler short
4. For long work, enqueue tasks instead of doing everything inside the scheduled event
5. Add unit tests for registered and unknown cron behavior

Example:

```typescript
export const scheduledHandlers: Record<string, ScheduledJobHandler> = {
  '*/10 * * * *': async (controller, env): Promise<void> => {
    // existing credits job
  },
  '0 0 * * *': async (_controller, _env): Promise<void> => {
    // daily maintenance
  }
}
```

Cron format:

```text
* * * * *
| | | | |
| | | | +-- day of week
| | | +---- month
| | +------ day of month
| +-------- hour
+---------- minute
```

## Local Testing

For unit tests, call handlers directly:

```typescript
await handleQueue(batch, env, ctx)
await handleScheduled(controller, env, ctx)
```

For local scheduled events:

```bash
pnpm prepare:cloudflare:dev
pnpm exec wrangler dev --test-scheduled --env-file .wrangler/runtime-secrets.env
```

For generated bindings and types:

```bash
pnpm prepare:cloudflare:dev
pnpm exec wrangler types --config .wrangler/wrangler.types.jsonc --env-file .wrangler/runtime-secrets.env --strict-vars false
```

Do not run remote E2E to test resource creation. Remote E2E should only call HTTP APIs against an already deployed environment.

## Common Mistakes

**Adding queue logic to `src/index.ts`**

Keep `src/index.ts` as the Worker entrypoint only. Register queue handlers in `src/backend/consumers/index.ts`.

**Using comma-separated config**

`QUEUE_NAMES` and `CRONS` use semicolons.

**Putting full job payloads in messages**

Put the durable row in D1 and send `{ taskId, userId }`.

**Forgetting the generated binding name**

`task-check` becomes `Q_TASK_CHECK`. Use the generated `Env` type instead of hand-writing env interfaces.

**Doing long work inside cron**

Cron should coordinate. Queue should execute long or retryable jobs.

**Changing the existing `*/10 * * * *` cron casually**

That expression drives credit expiry and cleanup. Changing it changes real business timing.
