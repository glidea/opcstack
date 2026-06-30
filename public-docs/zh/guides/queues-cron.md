---
title: 队列和定时任务
description: Queue 和 Cron 使用
group: 指南
order: 4
---

# 队列和定时任务

OPC Stack 支持 Cloudflare Queues 和 Cron Triggers。

## Queue 队列

### 定义队列

在 `.env.dev` 或 `.env.prod` 中定义队列名称：

```bash
QUEUE_NAMES=task-check;email-send
```

`scripts/prepare-cloudflare.mjs` 会自动创建队列，并生成 Binding：
- `task-check` → `Q_TASK_CHECK`
- `email-send` → `Q_EMAIL_SEND`

需要限制消费并发时配置：

```bash
QUEUE_MAX_CONCURRENCY=1
```

`QUEUE_MAX_CONCURRENCY` 为空时使用 Cloudflare Queues 自动并发。

### 发送消息

```typescript
// src/api/handler/tasks.ts
await ctx.env.Q_TASK_CHECK.send({
  taskId: 'task-123',
  userId: 'user-456',
  timestamp: Date.now()
})

// 批量发送
await ctx.env.Q_TASK_CHECK.sendBatch([
  { body: { taskId: 'task-1' } },
  { body: { taskId: 'task-2' } },
  { body: { taskId: 'task-3' } }
])
```

### 消费消息

在 `src/consumers/index.ts` 中处理队列消息，根据队列名称分发到不同的 handler。

### 错误处理

使用 `message.ack()` 确认消息处理成功，使用 `message.retry()` 重试失败的消息。

## Cron 定时任务

### 定义 Cron

在 `.env.dev` 或 `.env.prod` 中定义 cron 表达式：

```bash
CRONS=0 0 * * *,0 */6 * * *
```

`scripts/prepare-cloudflare.mjs` 会自动生成 wrangler.jsonc 配置。

### 处理 Cron

在 `src/jobs/index.ts` 中处理定时任务，根据 cron 表达式分发到不同的 handler。

### Cron 表达式

```
* * * * *
│ │ │ │ │
│ │ │ │ └─ 星期 (0-7, 0 和 7 都表示周日)
│ │ │ └─── 月份 (1-12)
│ │ └───── 日期 (1-31)
│ └─────── 小时 (0-23)
└───────── 分钟 (0-59)
```

常用示例：
- `0 0 * * *` - 每天 0 点
- `0 */6 * * *` - 每 6 小时
- `*/15 * * * *` - 每 15 分钟
- `0 9 * * 1` - 每周一 9 点

## 本地测试

### 测试 Queue

```bash
# 发送测试消息
curl -X POST http://localhost:8787/api/test-queue
```

### 测试 Cron

```bash
# 手动触发 cron
wrangler dev --test-scheduled
```

## 监控

### 查看队列状态

```bash
# 查看队列消息数量
wrangler queues list
```

### 查看 Cron 执行日志

```bash
# 查看日志
wrangler tail
```

## 最佳实践

### Queue

1. **幂等性**：确保消息处理是幂等的，避免重复处理
2. **超时控制**：单个消息处理不要超过 30 秒
3. **批量处理**：使用 `sendBatch` 提高效率
4. **错误重试**：使用 `message.retry()` 而不是 `message.ack()`

### Cron

1. **避免长时间运行**：单次执行不要超过 30 秒
2. **使用队列**：长时间任务应该发送到队列异步处理
3. **错误处理**：捕获异常，避免影响下次执行
4. **幂等性**：确保重复执行不会产生副作用

## 常见问题

**Q: Queue 消息丢失怎么办？**

检查 `message.ack()` 是否正确调用，查看 Cloudflare 控制台的队列监控。

**Q: Cron 没有执行？**

检查 cron 表达式是否正确，查看 wrangler.jsonc 配置是否生成。

**Q: 如何实现延迟队列？**

Cloudflare Queues 不支持延迟，可以在消息中记录时间戳，消费时判断是否到期。
