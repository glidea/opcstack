---
title: AI 集成
description: 对话、图像、TTS、实时、视频、异步任务、队列、R2 输出与 provider 配置
group: Guides
group_order: 1
order: 5
---

# AI 集成

OPCStack 将 AI provider 代码放在 `src/backend/ai/` 下。处理器和业务模块应调用该目录下的简单客户端接口，而不是直接调用 provider SDK。这样可以将 provider 特定的请求结构、Provider endpoint、任务持久化、队列重试行为和 R2 输出处理集中在一处。

当前 AI 功能仅限后端：

| 领域 | 入口 | Providers | 异步任务 |
| --- | --- | --- | --- |
| 对话 | `src/backend/ai/chat` | OpenAI 兼容 | 否 |
| 图像 | `src/backend/ai/image` | Gemini, OpenAI, SeedDream, Aliyun | 是 |
| TTS | `src/backend/ai/tts` | Gemini, Seed | 是 |
| 实时 | `src/backend/ai/realtime` | Doubao | 否 |
| 视频 | `src/backend/ai/video` | SeedDance | 是 |

## AI 模型

每个 AI 模块都暴露一个小型的 `createAI...Clients` 工厂函数。工厂返回一个 `simple` 客户端，以及在需要时返回原生 Provider 客户端。

```
业务代码
  |
  +-- createAI...Clients(userId, tenantDb, options)
        |
        +-- simple 客户端接口
        |
        +-- provider 实现
              |
              +-- 明确的 endpoint
              +-- provider SDK 或 fetch
              +-- 可选：Tenant Shard DB 中的任务行
              +-- 可选：R2 输出
```

业务操作在读取配置前确定组合后的 Provider Type 和模型。配置组件按精确的 `type + model` 筛选已启用的 D1 Provider 实体，Provider Router 对这些实体排序，选中的实体再把 endpoint 和 API Key 传给工厂。工厂内部不存在默认 Provider 或第二次 Provider 选择。

不支持的 Provider Type 会抛出 `AIError('UNSUPPORTED_AI_PROVIDER')`。

## 模块结构

```
src/backend/ai/
  error.ts              # AIError 和类型化错误码
  endpoint.ts           # 明确的 provider endpoint 类型
  chat/
    index.ts
    openai/
  image/
    index.ts            # simple 图像客户端类型
    task.ts             # 图像异步任务行 + 队列消息
    reference.ts        # inline/R2 图像引用解析
    gemini/
    openai/
    seedream/
    aliyun/
  tts/
    index.ts            # simple TTS 客户端类型
    task.ts             # TTS 异步任务行 + 队列消息
    gemini/
    seed/
  realtime/
    index.ts
    doubao/
  video/
    index.ts            # simple 视频客户端类型
    task.ts             # 视频异步任务行 + 队列消息
    reference.ts        # R2 引用到公共/签名 URL
    seedance/
```

队列处理器位于 `src/backend/ai/` 之外：

```
src/backend/consumers/
  index.ts
  ai-image.ts
  ai-tts.ts
  ai-video.ts
```

## Providers

公共 TypeScript 契约包含所有支持的组合 Provider Type。

| 模块 | Provider Type | 实现目录 |
| --- | --- | --- |
| 对话 | `chat_openai` | `chat/openai` |
| 图像 | `image_gemini` | `image/gemini` |
| 图像 | `image_openai` | `image/openai` |
| 图像 | `image_seedream` | `image/seedream` |
| 图像 | `image_aliyun` | `image/aliyun` |
| TTS | `tts_gemini` | `tts/gemini` |
| TTS | `tts_seed` | `tts/seed` |
| 实时 | `realtime_doubao` | `realtime/doubao` |
| 视频 | `video_seedance` | `video/seedance` |

当调用方需要已知的模型名或语音名时，使用 provider 的 `constants.ts` 文件中的常量。不要在处理器或前端代码中重复硬编码模型列表。

## 对话

对话兼容 OpenAI，是同步调用。

```typescript
import { createAIClients } from '$backend/ai/chat'

const clients = createAIClients({ provider: 'openai', model, endpoint })
const text = await clients.simple.generateText('Explain D1 sharding in three lines')
```

结构化输出使用 Zod schema：

```typescript
import { z } from 'zod'
import { createAIClients } from '$backend/ai/chat'

const schema = z.object({
  title: z.string(),
  summary: z.string()
})

const result = await createAIClients({ provider: 'openai', model, endpoint }).simple.generateObject(
  'Summarize this product idea',
  schema
)
```

对话按请求模型选择已启用的 `chat_openai` Provider 实体。API Key 在创建客户端前解密，配置读取 API 永远不返回明文。

## 图像

图像支持生成和编辑流程。引用可以是内联 base64 或已有的 R2 对象。

```typescript
import { createAIImageClients } from '$backend/ai/image'

const clients = createAIImageClients(env, userId, tenantDb, {
  provider: 'gemini',
  model,
  endpoint
})

const images = await clients.simple.generate({
  prompt: 'A clean SaaS dashboard screenshot',
  numberOfImages: 1,
  aspectRatio: '16:9',
  imageSize: '1K',
  uploadToR2: true,
  r2UploadDir: 'generated/images',
  r2UploadIsPublic: false
})
```

图像输入字段：

| 字段 | 含义 |
| --- | --- |
| `prompt` | 文本指令 |
| `numberOfImages` | 请求输出数量 |
| `references` | Inline 或 R2 图像引用 |
| `aspectRatio` | `1:1`、`3:4`、`4:3`、`9:16` 或 `16:9` |
| `imageSize` | `1K`、`2K` 或 `4K` |
| `lowCensorship` | Provider 特定的宽松审核模式 |
| `uploadToR2` | 将生成输出存储到 R2 |
| `r2UploadDir` | 相对于选定 R2 可见性前缀的输出目录 |
| `r2UploadIsPublic` | 输出是否公开 |

R2 引用使用 R2 客户端并遵循正常的 R2 读取规则：

```typescript
const images = await clients.simple.generate({
  prompt: 'Make the product image brighter',
  references: [
    {
      r2: {
        key: 'private/user_123/uploads/source.png',
        variant: 'large'
      }
    }
  ]
})
```

当 `uploadToR2=true` 时，`r2UploadDir` 和 `r2UploadIsPublic` 都是必填项。缺少任意一个会分别抛出 `AI_IMAGE_R2_UPLOAD_DIR_REQUIRED` 或 `AI_IMAGE_R2_UPLOAD_IS_PUBLIC_REQUIRED`。

Provider 说明：

| Provider | 说明 |
| --- | --- |
| Gemini | 使用 Google GenAI `generateContent`，支持内联图像引用 |
| OpenAI | 使用流式图像生成/编辑，并将最终事件转换为图像结果 |
| SeedDream | 使用 Volcengine Ark 的 OpenAI 兼容图像端点 |
| Aliyun | 使用 DashScope，有 provider 特定的模型和尺寸限制 |

## TTS

TTS 接受明确的发言人和台词列表。调用方负责脚本质量。客户端只校验发言人数量和名称。

```typescript
import { createAITTSClients } from '$backend/ai/tts'

const clients = createAITTSClients(env, userId, tenantDb, {
  provider: 'gemini',
  model,
  endpoint
})

const audio = await clients.simple.generateSpeech({
  instruction: 'Natural technical podcast style',
  speakers: [
    {
      name: 'Host',
      voiceName: 'Charon',
      profile: 'Senior backend engineer',
      speechStyle: 'calm and direct'
    },
    {
      name: 'Guest',
      voiceName: 'Puck'
    }
  ],
  lines: [
    { speakerName: 'Host', text: 'What problem does shard routing solve' },
    { speakerName: 'Guest', text: 'It keeps user data pinned to one tenant database' }
  ],
  uploadToR2: true
})
```

Provider 行为：

| Provider | 输出格式 | 说明 |
| --- | --- | --- |
| Gemini | WAV | 支持一到两个发言人 |
| Seed `seed-tts-2.0-standard` | MP3 | 标准语音生成 |
| Seed `doubao-seed-podcast` | MP3 | 支持基于源内容的播客生成 |

`generateSpeechFromSource` 仅在 Seed 使用 `doubao-seed-podcast` 模型时可用。其他 TTS 模型会抛出 `TTS_SOURCE_NOT_SUPPORTED`。

`uploadToR2=true` 时，TTS 输出写入 `audio/` 目录。

## 实时

实时目前支持通过 WebSocket 使用 Doubao。返回一个包含类型化事件流和直接控制方法的 session 对象。

```typescript
import { createAIRealtimeClient } from '$backend/ai/realtime'

const client = createAIRealtimeClient(userId, {
  provider: 'doubao',
  model,
  endpoint
})

const session = await client.startSession({
  speaker: 'zh_female_vv_jupiter_bigtts',
  prompt: 'Answer like a concise technical assistant'
})

await session.sendText('Explain why cross-DB transactions are avoided')
```

Session 方法：

| 方法 | 用途 |
| --- | --- |
| `sendAudio(audio)` | 发送 PCM 音频字节 |
| `sendText(text)` | 发送文本查询 |
| `interrupt()` | 中断当前助手响应 |
| `finish()` | 结束 session 并关闭 provider 连接 |

流事件类型：

| 事件 | 含义 |
| --- | --- |
| `session_started` | Provider session 已就绪 |
| `user_transcript` | ASR 识别文本 |
| `assistant_text` | 助手文本响应 |
| `assistant_audio` | 助手音频块 |
| `assistant_audio_ended` | 当前音频响应结束 |
| `interrupted` | 响应已中断 |
| `finished` | Session 已结束 |
| `error` | 运行时错误事件 |

Doubao 模型别名在代码中校验。未知的实时模型会抛出 `DOUBAO_REALTIME_MODEL_UNSUPPORTED`。

## 视频

视频目前支持 SeedDance。simple 客户端总是先创建一个本地异步任务。队列 consumer 负责创建或轮询远端 provider 任务。

```typescript
import { createAIVideoClients } from '$backend/ai/video'

const clients = createAIVideoClients(env, userId, tenantDb, {
  provider: 'seedance',
  model
})

const task = await clients.simple.generate({
  prompt: 'A 5 second product UI motion demo',
  ratio: '16:9',
  resolution: '720p',
  duration: 5,
  r2UploadDir: 'generated/videos',
  r2UploadIsPublic: false
})
```

视频引用是带有媒体类型声明的 R2 对象：

```typescript
const task = await clients.simple.generate({
  prompt: 'Animate this product screenshot',
  duration: 5,
  references: [
    {
      type: 'image',
      r2: { key: 'private/user_123/uploads/source.png' }
    }
  ]
})
```

引用 URL 规则：

| R2 key | Provider URL |
| --- | --- |
| `public/*` | 公共 `/api/r2/...` URL |
| `tmp/public/*` | 公共 `/api/r2/...` URL |
| 私有 key | 签名读取 URL |

视频 consumer 将最终 provider 视频 URL 以流的方式下载并写入 R2，格式为 `video/mp4`。不要将此改为 `arrayBuffer` 或 base64。大型视频输出不能在内存中缓冲。

## 异步任务流程

图像、TTS 和视频支持在 Tenant Shard DB 中存储异步任务行。

跨用户查看任务并跳转相关 Cloudflare 资源的流程参阅[管理控制台](admin-console.md)。

```
API 或业务代码
  |
  +-- simple.generateAsync / generateSpeechAsync / video.generate
        |
        +-- 在当前用户的 Tenant Shard DB 中插入处理中的任务行
        |
        +-- 发送队列消息 { taskId, userId }
              |
              +-- consumer 通过 Meta shard 注册表打开用户 DB
              |
              +-- 调用 provider
              |
              +-- 写入已完成或失败的任务行
```

表：

| 表 | 归属 | 用途 |
| --- | --- | --- |
| `ai_image_tasks` | Tenant Shard DB | 图像生成/编辑任务状态和结果 |
| `ai_tts_tasks` | Tenant Shard DB | TTS 任务状态和结果 |
| `ai_video_tasks` | Tenant Shard DB | 视频任务状态、provider 任务 id 和结果 |

任务状态：

| 状态 | 含义 |
| --- | --- |
| `processing` | 任务已入队、正在运行或等待 provider 轮询 |
| `completed` | 结果 JSON 已写入 |
| `failed` | 达到最大尝试次数或 provider 返回失败状态 |

Consumer 跳过缺失的任务和非 processing 状态的任务，然后对队列消息执行 `ack()`。这使重试在任务行边界上具有幂等性。

现有的 `*/10 * * * *` scheduled job 每次触发只从 D1 读取一次 `taskRetentionDays`，并删除更早的 `completed` 和 `failed` 任务行。它绝不删除 `processing` 任务。数据库清理不读取任务结果，也不删除生成的 R2 对象；对象保留仍由 R2 lifecycle rules 管理。

## 队列 Consumer

所需队列名称：

```bash
QUEUE_NAMES=image-generate;tts-generate;video-generate
```

生成的 bindings：

| 队列 | Binding | 处理器 |
| --- | --- | --- |
| `image-generate` | `Q_IMAGE_GENERATE` | `handleAIImageQueue` |
| `tts-generate` | `Q_TTS_GENERATE` | `handleAITTSQueue` |
| `video-generate` | `Q_VIDEO_GENERATE` | `handleAIVideoQueue` |

队列消息格式有意保持简洁：

```typescript
{
  taskId: string
  userId: string
}
```

不要在队列消息中添加 prompt、provider 配置、引用或输出选项。任务行是持久的事实来源。

重试行为：

| Consumer | 最大尝试次数 | 重试延迟 |
| --- | --- | --- |
| 图像 | 3 | 10s, 30s, 然后失败 |
| TTS | 3 | 10s, 30s, 然后失败 |
| 视频 | 3 次 provider/错误尝试 | 10s, 30s, 然后失败 |

视频轮询与失败重试是分开的。正在运行的 provider 任务会在 30 秒后重试，不增加 `attemptCount`。

## R2 输出规则

仅在输出需要在请求结束后保留时才使用 R2。

| 领域 | 内存结果 | R2 结果 |
| --- | --- | --- |
| 图像 | `imageBase64`, `mimeType` | 可选 `r2.key`, `r2.url` |
| TTS | `audioBase64`, `mimeType` | 可选 `r2.key`, `r2.url` |
| 视频 | 无 | 必须有最终 `video/mp4` 对象 |

规则：

- 图像上传需要显式指定 `r2UploadDir` 和 `r2UploadIsPublic`
- TTS 上传到 `audio/`
- 视频上传到 `r2UploadDir` 或 `videos`
- 视频 provider 输出必须流式写入 R2
- 私有引用应使用签名 URL 而非公共路径
- 生成的公共文件仍需遵循存储指南中的正常 R2 路径规则

## 租户数据归属

AI 任务行是租户数据，因为它们是用户的运行时产物。

```
Meta DB
  |
  +-- user_shards
        |
        +-- openUserDb(userId)
              |
              +-- Tenant Shard DB
                    |
                    +-- ai_image_tasks
                    +-- ai_tts_tasks
                    +-- ai_video_tasks
```

为当前用户创建任务的请求处理器应使用当前请求的 `tenantDb`。队列 consumer 没有请求上下文，因此使用 `createTenantShardAccess(metaDb, env).openUserDb(userId)`。

不要将 AI 任务行存储在 Meta DB 中。Meta DB 只负责存储找到 Tenant DB 所需的 shard 注册表。

## Endpoint 规则

每个 AI 操作在路由前都已经确定 Provider Type 和模型。配置模块按精确的 `type + model` 从 `ai_providers` 筛选启用的 Provider。Provider 实现只接收一个显式 endpoint，不负责选择或重试其他 Provider。

## Provider Router

Provider Router 只对已经筛选好的候选列表排序。它不知道 Image、OpenAI 或任何 Provider Type。同步调用使用排名第一的 Provider。Image 和 TTS 异步 consumer 可以在一次 Queue 尝试中依次尝试排名靠前的 Provider。

评分使用当前 Tenant Shard 最近 5 分钟和 1 小时的 1 分钟桶：

```text
normalize(value, pool_max) = pool_max == 0 ? 0 : value / pool_max
penalty = (error * error_weight + latency * latency_weight + price * price_weight) / total_weight
score = (1 - penalty) * 100
```

同时存在 5 分钟和 1 小时数据时按 `70% + 30%` 合并。缺少错误率或延迟时使用候选池中位数。整个候选池都没有某项指标时，其归一化惩罚为 `0.5`。分数相同时按 Provider ID 升序排列。

每次上游尝试增加一条 `(provider_id, model, bucket_start)` 分钟桶。成功调用累计延迟，失败的上游调用只累计错误次数。Router 不写每次调用明细，不依赖进程内存，也不增加全局指标服务。现有 10 分钟 scheduled job 会清理每个 active 或 draining Tenant Shard 中超过 24 小时的指标桶。

Video 仅在创建新的远程任务时选择 Provider。Provider 返回任务 ID 后，consumer 同时持久化 `provider_id`、`provider_started_at` 和 `provider_task_id`。后续轮询从已存 Provider ID 解析 endpoint，不再路由，即使该 Provider 已停用也不受影响。远程任务明确失败时，consumer 记录 Provider 错误、把 ID 追加到 `failed_provider_ids_json`，并在下一次 Queue 尝试选择其他 Provider 前清空执行字段。轮询网络错误保留已有绑定。

## 配置

`META_DB` 是 AI 业务配置的唯一来源。`system_settings.ai_config` 保存路由权重和任务保留期。每条 `ai_providers` 记录独立保存一个 Provider，包括组合后的 Provider Type、支持模型、endpoint、价格系数、启用状态和使用 AES-GCM 加密的 API Key。读取 API 只返回 `api_key_configured`。

配置保存后对下一个请求、Queue 消息、WebSocket 连接或 Cron 触发生效。已经开始的操作继续使用启动时的快照。已经取得远程任务 ID 的 Video 任务继续使用持久化的 Provider。

在**后台 > 系统设置 > AI 路由**保存路由权重和任务保留期，打开**AI 提供商**管理 Provider 实体。创建 Provider 时必须填写名称、Provider Type、至少一个模型、Base URL、价格系数、启用状态和 API Key。新建、编辑、删除成功后只更新目标行。版本过期时需要显式刷新。页面只显示 API Key 是否已配置。

任何 AI 业务设置或凭据都不应写入 `.env.dev`、`.env.prod`、`.env.secret.*` 或 `wrangler.jsonc`。

## 添加 Provider

保持 provider 添加的简单性。

1. 在对应领域下添加 provider 模块，例如 `src/backend/ai/image/acme`
2. 从 `constants.ts` 导出常量
3. 实现现有的 simple 客户端接口
4. 将组合后的 Provider Type 加入配置联合类型、API schema 和后台下拉选项
5. 在该领域的 `createAI...Clients` 工厂中添加一个分支
6. 针对请求映射、任务创建和 provider 错误映射添加专项单元测试

除非至少有两个领域需要完全相同的动态注册行为，否则不要创建通用 provider 注册表。当前显式的 `switch`/分支写法更简单易读。

## 常见错误

**在处理器中直接调用 provider SDK**

不要这样做。使用 `src/backend/ai/*` 的 simple 客户端，以便 Provider endpoint、任务行和 R2 规则保持集中管理。

**将任务负载放入队列消息**

队列消息应只包含 `taskId` 和 `userId`。任务行是事实来源。

**将 AI 任务存储在 Meta DB 中**

AI 任务是租户数据，应存储在 Tenant Shard DB 中。

**缓冲视频输出**

不要对生成的视频输出使用 `arrayBuffer` 或 base64。将 provider 响应体流式写入 R2。

**假设每个 provider 都支持所有选项**

`lowCensorship`、图像尺寸、基于源内容的 TTS 和引用等选项是 provider 特定的。如果 provider 不支持某个选项，应抛出 `AIError` 而不是静默忽略。

**将 AI 密钥放在 `clientConfig` 中**

AI key 是后端密钥。前端代码必须调用后端 API，不能接收 provider key。
