---
title: 队列与 Cron
description: Cloudflare Queues、Cron Triggers、异步消费者与定时任务
group: Guides
group_order: 1
order: 4
---

# 队列与 Cron

OPCStack 使用 Cloudflare Queues 处理异步工作，使用 Cloudflare Cron Triggers 处理周期性任务。两者都通过 `src/index.ts` 进入同一个 Worker 部署，再分发到后端处理器。

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

保持队列和 Cron 的简单性。队列消息应指向持久化状态，不应携带完整的任务负载。

## 运行时模型

`src/index.ts` 导出三个 Worker 入口点：

| 入口点 | 处理器 | 用途 |
| --- | --- | --- |
| `fetch` | API 或 SvelteKit SSR | 用户请求和 Webhook |
| `queue` | `handleQueue` | Cloudflare Queue 批次 |
| `scheduled` | `handleScheduled` | Cron Trigger 事件 |

队列按名称配置，Cron 任务按精确的 cron 表达式配置。未知队列或未知 cron 表达式会被跳过。

## 配置

队列和 cron 配置放在 `.env.dev` 和 `.env.prod` 中。

```bash
QUEUE_NAMES=image-generate;tts-generate;video-generate
QUEUE_MAX_CONCURRENCY=
CRONS=*/10 * * * *
```

规则：

| 配置项 | 格式 | 含义 |
| --- | --- | --- |
| `QUEUE_NAMES` | 分号分隔的名称 | 队列资源及 Worker producer/consumer bindings |
| `QUEUE_MAX_CONCURRENCY` | 空或整数 `1..250` | 可选的 Cloudflare consumer 最大并发数 |
| `CRONS` | 分号分隔的 cron 表达式 | Worker Cron Triggers |

`QUEUE_NAMES` 为空表示没有队列 bindings。`CRONS` 为空表示没有 cron triggers。

`prepare-cloudflare.mjs` 在去除空格后对队列名称进行去重。它不会校验队列名称是否符合 binding 命名规则，因此请保持名称小写和连字符格式。

## 生成的 Bindings

`prepare-cloudflare.mjs` 将队列名称转换为 Worker bindings：

| 队列名称 | Binding |
| --- | --- |
| `image-generate` | `Q_IMAGE_GENERATE` |
| `tts-generate` | `Q_TTS_GENERATE` |
| `video-generate` | `Q_VIDEO_GENERATE` |
| `task-check` | `Q_TASK_CHECK` |

命名规则：

```
Q_<QUEUE_NAME_UPPER_WITH_NON_ALNUM_AS_UNDERSCORE>
```

生成的 `wrangler.jsonc` 同时包含 producers 和 consumers：

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

当 `QUEUE_MAX_CONCURRENCY=1` 时，每个 consumer 条目还会附加 `max_concurrency: 1`。

## 队列分发

所有队列分发从 `src/backend/consumers/index.ts` 开始。

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

已注册的处理器：

| 队列 | 处理器 |
| --- | --- |
| `image-generate` | `handleAIImageQueue` |
| `tts-generate` | `handleAITTSQueue` |
| `video-generate` | `handleAIVideoQueue` |

不要在 `src/index.ts` 中添加分支逻辑，在 `queueHandlers` 中注册处理器即可。

## 队列消息规则

队列消息应简洁，基于持久化状态。

当前 AI 队列使用如下格式：

```typescript
{
  taskId: string
  userId: string
}
```

这是有意为之：

- `taskId` 指向包含 prompt、provider、model、references 和输出选项的任务行
- `userId` 让 consumer 通过 Meta DB 重新打开正确的 Tenant Shard DB
- 重试具有幂等性，因为任务行是事实来源

不要在队列消息中放入 prompt、API key、provider 配置、R2 选项或完整的用户负载。

## 现有 AI 队列

图像、TTS 和视频异步任务属于租户数据，存储在 Tenant Shard DB 的表中：

| 队列 | 表 | 任务创建者 |
| --- | --- | --- |
| `image-generate` | `ai_image_tasks` | `createAIImageTask` |
| `tts-generate` | `ai_tts_tasks` | `createAITTSTask`、`createAITTSSourceTask` |
| `video-generate` | `ai_video_tasks` | `createAIVideoTask` |

流程：

```
请求处理器或 service
  |
  +-- 在 Tenant Shard DB 中插入处理中的任务行
  |
  +-- env.Q_*.send({ taskId, userId })
        |
        +-- consumer 打开用户的 Tenant Shard DB
        |
        +-- 加载任务行
        |
        +-- 调用 AI provider
        |
        +-- 更新任务行为 completed 或 failed
```

consumer 通过以下方式打开用户的 DB：

```typescript
const metaDb = getMetaDb(env.META_DB)
const tenant = await createTenantShardAccess(metaDb, env).openUserDb(userId)
```

这个查找是必要的，因为队列事件没有请求中间件上下文。

## 重试与 Ack 规则

Consumer 必须显式完成每条消息：

| 操作 | 含义 |
| --- | --- |
| `message.ack()` | 消息处理完成，不需要重试 |
| `message.retry({ delaySeconds })` | 消息应稍后重试 |

当前 AI 重试行为：

| 队列 | 最大尝试次数 | 延迟 |
| --- | --- | --- |
| `image-generate` | 3 | 10s、30s |
| `tts-generate` | 3 | 10s、30s |
| `video-generate` | 3 次失败尝试 | 10s、30s |

视频有一条额外规则：如果远端 SeedDance provider 任务仍在运行，consumer 会在 30 秒后重试队列消息，不增加 `attemptCount`。

Consumer 对缺失或非 processing 状态的任务执行 ack。这不是在吞掉 bug，而是幂等性设计：重复消息不应重新执行已完成的任务。

## Cron 分发

所有 Cron Trigger 分发从 `src/backend/jobs/index.ts` 开始。

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

键是来自 Cloudflare 的精确 cron 表达式字符串。如果 `CRONS` 包含 `*/10 * * * *`，处理器映射中也必须使用 `*/10 * * * *`。

## 现有 Cron 任务

当前已注册的任务：

| Cron | 任务 |
| --- | --- |
| `*/10 * * * *` | 对每个活跃的 Tenant Shard 执行积分过期和清理旧积分交易 |

任务流程：

1. 打开 Meta DB
2. 列出活跃的 Tenant Shard DB
3. 对每个分片运行 `CreditsService.expire({ limit: 20 })`
4. 对每个分片运行 `CreditsService.cleanupTransactions({ limit: 100 })`
5. 记录结构化的任务结果

Cron 每次执行时从 Meta D1 读取一次 Credits 交易保留期和 AI 任务保留期。动态配置缺失或无效时任务直接失败，不使用 ENV 静默回退。

## 添加队列

只有当工作必须在请求生命周期之外继续时，才添加队列。

步骤：

1. 将队列名称添加到 `QUEUE_NAMES`
2. 运行 `pnpm prepare:cloudflare:dev`
3. 使用生成的 binding，例如 `env.Q_TASK_CHECK.send(...)`
4. 在拥有该任务的领域附近添加消息类型
5. 在 `src/backend/consumers/` 下添加 consumer 处理器
6. 在 `queueHandlers` 中注册
7. 为分发、ack、重试和幂等重复处理添加单元测试

最小消息格式：

```typescript
export interface TaskCheckQueueMessage {
  taskId: string
  userId: string
}
```

发送：

```typescript
await env.Q_TASK_CHECK.send({
  taskId,
  userId
})
```

不要创建通用的队列框架。`queueHandlers` 中的映射已经足够。

## 添加 Cron

只有在任务是真正周期性的情况下才添加 cron。如果工作是用户触发或 provider 触发的，使用队列或 webhook。

步骤：

1. 将 cron 表达式添加到 `CRONS`
2. 在 `scheduledHandlers` 中添加处理器
3. 保持处理器简短
4. 对于耗时较长的工作，将任务入队而不是在 scheduled event 中全部完成
5. 为已注册和未知 cron 行为添加单元测试

示例：

```typescript
export const scheduledHandlers: Record<string, ScheduledJobHandler> = {
  '*/10 * * * *': async (controller, env): Promise<void> => {
    // 现有的积分任务
  },
  '0 0 * * *': async (_controller, _env): Promise<void> => {
    // 每日维护
  }
}
```

Cron 格式：

```text
* * * * *
| | | | |
| | | | +-- 星期几
| | | +---- 月份
| | +------ 日
| +-------- 小时
+---------- 分钟
```

## 本地测试

单元测试中直接调用处理器：

```typescript
await handleQueue(batch, env, ctx)
await handleScheduled(controller, env, ctx)
```

本地 scheduled 事件：

```bash
pnpm prepare:cloudflare:dev
pnpm exec wrangler dev --test-scheduled --env-file .wrangler/runtime-secrets.env
```

生成 bindings 和类型：

```bash
pnpm prepare:cloudflare:dev
pnpm exec wrangler types --config .wrangler/wrangler.types.jsonc --env-file .wrangler/runtime-secrets.env --strict-vars false
```

不要通过运行远端 E2E 来测试资源创建。远端 E2E 只应对已部署的环境调用 HTTP API。

## 常见错误

**在 `src/index.ts` 中添加队列逻辑。** 保持 `src/index.ts` 作为 Worker 入口点。在 `src/backend/consumers/index.ts` 中注册队列处理器。

**使用逗号分隔的配置。** `QUEUE_NAMES` 和 `CRONS` 使用分号。

**将完整任务负载放入消息。** 将持久行放在 D1 中，发送 `{ taskId, userId }`。

**忘记生成的 binding 名称。** `task-check` 变为 `Q_TASK_CHECK`。使用生成的 `Env` 类型而不是手写 env 接口。

**在 cron 中执行耗时工作。** Cron 应负责协调，队列应执行耗时或可重试的任务。

**随意修改现有的 `*/10 * * * *` cron。** 该表达式驱动积分过期和清理。修改它会改变真实的业务时序。
