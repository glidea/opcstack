---
title: Queues and Cron
description: Queue and Cron usage
group: Guides
order: 4
---

# Queues and Cron

OPC Stack supports Cloudflare Queues and Cron Triggers.

## Queue

### Define queues

Define queue names in `.env.dev` or `.env.prod`:

```bash
QUEUES=task-check,email-send
```

`pre-build.mjs` auto creates queues and generates bindings:
- `task-check` -> `Q_TASK_CHECK`
- `email-send` -> `Q_EMAIL_SEND`

### Send messages

```typescript
// src/api/handler/tasks.ts
await ctx.env.Q_TASK_CHECK.send({
  taskId: 'task-123',
  userId: 'user-456',
  timestamp: Date.now()
})

// Batch send
await ctx.env.Q_TASK_CHECK.sendBatch([
  { body: { taskId: 'task-1' } },
  { body: { taskId: 'task-2' } },
  { body: { taskId: 'task-3' } }
])
```

### Consume messages

Handle queue messages in `src/consumers/index.ts` and dispatch to different handlers by queue name.

### Error handling

Use `message.ack()` for success and `message.retry()` for retry on failure.

## Cron

### Define cron expressions

Define cron expressions in `.env.dev` or `.env.prod`:

```bash
CRONS=0 0 * * *,0 */6 * * *
```

`pre-build.mjs` auto generates `wrangler.jsonc` config.

### Handle cron jobs

Handle scheduled jobs in `src/jobs/index.ts` and dispatch by cron expression.

### Cron format

```
* * * * *
│ │ │ │ │
│ │ │ │ └─ day of week (0-7 and both 0 and 7 mean Sunday)
│ │ │ └─── month (1-12)
│ │ └───── day of month (1-31)
│ └─────── hour (0-23)
└───────── minute (0-59)
```

Common examples:
- `0 0 * * *` every day at 00:00
- `0 */6 * * *` every 6 hours
- `*/15 * * * *` every 15 minutes
- `0 9 * * 1` every Monday at 09:00

## Local testing

### Test queue

```bash
# Send test message
curl -X POST http://localhost:8787/api/test-queue
```

### Test cron

```bash
# Trigger cron manually
wrangler dev --test-scheduled
```

## Monitoring

### Queue status

```bash
# Show queue list
wrangler queues list
```

### Cron logs

```bash
# Show logs
wrangler tail
```

## Best practices

### Queue

1. Idempotency: make message handling idempotent to avoid duplicates
2. Timeout control: keep single message handling within 30 seconds
3. Batch processing: use `sendBatch` for efficiency
4. Retry errors: use `message.retry()` instead of `message.ack()` for failures

### Cron

1. Avoid long running task: keep one run within 30 seconds
2. Use queue: send long tasks to queue for async processing
3. Handle errors: catch errors to avoid impacting next run
4. Idempotency: repeated execution should not create side effects

## FAQ

**Q: What if queue messages are lost**

Check whether `message.ack()` is called correctly and inspect queue metrics in Cloudflare dashboard.

**Q: Why cron does not run**

Check cron expression and verify `wrangler.jsonc` was generated correctly.

**Q: How to implement delayed queue**

Cloudflare Queues does not support delay directly. Put timestamp in message and check due time during consumption.
