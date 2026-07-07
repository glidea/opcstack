---
title: AI 集成
description: 对话、图像、TTS、实时、视频、异步任务、队列、R2 输出与 provider 配置
group: Guides
group_order: 1
order: 5
---

# AI 集成

OPCStack 将 AI provider 代码放在 `src/backend/ai/` 下。处理器和业务模块应调用该目录下的简单客户端接口，而不是直接调用 provider SDK。这样可以将 provider 特定的请求结构、fallback 端点规则、任务持久化、队列重试行为和 R2 输出处理集中在一处。

当前 AI 功能仅限后端：

| 领域 | 入口 | Providers | 异步任务 |
| --- | --- | --- | --- |
| 对话 | `src/backend/ai/chat` | OpenAI 兼容 | 否 |
| 图像 | `src/backend/ai/image` | Gemini, OpenAI, SeedDream, Aliyun | 是 |
| TTS | `src/backend/ai/tts` | Gemini, Seed | 是 |
| 实时 | `src/backend/ai/realtime` | Doubao | 否 |
| 视频 | `src/backend/ai/video` | SeedDance | 是 |

## AI 模型

每个 AI 领域都暴露一个小型的 `createAI...Clients` 工厂函数。工厂返回一个 `simple` 客户端，以及在有需要时返回原生 provider 客户端。

```
业务代码
  |
  +-- createAI...Clients(env, userId, tenantDb, options)
        |
        +-- simple 客户端接口
        |
        +-- provider 实现
              |
              +-- resolveAIEndpoints(primary, fallback)
              +-- provider SDK 或 fetch
              +-- 可选：Tenant Shard DB 中的任务行
              +-- 可选：R2 输出
```

Provider 在 `options.provider` 中显式指定。仅在产品有明确默认值时才设置默认值：

| 领域 | 默认 provider |
| --- | --- |
| 对话 | `openai` |
| 图像 | `gemini` |
| TTS | `gemini` |
| 实时 | `doubao` |
| 视频 | `seedance` |

不支持的 provider 名称会抛出 `AIError('UNSUPPORTED_AI_PROVIDER')`。

## 模块结构

```
src/backend/ai/
  error.ts              # AIError 和类型化错误码
  fallback.ts           # primary + fallback 端点解析
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

每个 AI 领域的公共 TypeScript 契约中都包含支持的 provider id。

| 领域 | Provider id | 模块 | 默认模型环境变量 |
| --- | --- | --- | --- |
| 对话 | `openai` | `chat/openai` | `CHAT_OPENAI_MODEL` |
| 图像 | `gemini` | `image/gemini` | `IMAGE_GEMINI_MODEL` |
| 图像 | `openai` | `image/openai` | `IMAGE_OPENAI_MODEL` |
| 图像 | `seedream` | `image/seedream` | `IMAGE_SEEDDREAM_MODEL` |
| 图像 | `aliyun` | `image/aliyun` | `IMAGE_ALIYUN_MODEL` |
| TTS | `gemini` | `tts/gemini` | `TTS_GEMINI_MODEL` |
| TTS | `seed` | `tts/seed` | `TTS_SEED_MODEL` |
| 实时 | `doubao` | `realtime/doubao` | `REALTIME_DOUBAO_MODEL` |
| 视频 | `seedance` | `video/seedance` | `VIDEO_SEEDDANCE_MODEL` |

当调用方需要已知的模型名或语音名时，使用 provider 的 `constants.ts` 文件中的常量。不要在处理器或前端代码中重复硬编码模型列表。

## 对话

对话兼容 OpenAI，是同步调用。

```typescript
import { createAIClients } from '$backend/ai/chat'

const clients = createAIClients(env)
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

const result = await createAIClients(env).simple.generateObject(
  'Summarize this product idea',
  schema
)
```

对话配置：

| 键 | 文件 | 用途 |
| --- | --- | --- |
| `CHAT_OPENAI_BASE_URL` | `.env.dev`, `.env.prod` | 主 OpenAI 兼容 base URL |
| `CHAT_OPENAI_FALLBACK_BASE_URL` | `.env.dev`, `.env.prod` | 可选 fallback base URL |
| `CHAT_OPENAI_MODEL` | `.env.dev`, `.env.prod` | 默认对话模型 |
| `CHAT_OPENAI_API_KEY` | `.env.secret.example` | 主 API key 占位符 |
| `CHAT_OPENAI_FALLBACK_API_KEY` | `.env.secret.example` | Fallback API key 占位符 |

## 图像

图像支持生成和编辑流程。引用可以是内联 base64 或已有的 R2 对象。

```typescript
import { createAIImageClients } from '$backend/ai/image'

const clients = createAIImageClients(env, userId, tenantDb, {
  provider: 'gemini'
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
  provider: 'gemini'
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

`generateSpeechFromSource` 仅在 Seed 配合 `TTS_SEED_MODEL=doubao-seed-podcast` 时可用。其他 TTS 模型会抛出 `TTS_SOURCE_NOT_SUPPORTED`。

`uploadToR2=true` 时，TTS 输出写入 `audio/` 目录。

## 实时

实时目前支持通过 WebSocket 使用 Doubao。返回一个包含类型化事件流和直接控制方法的 session 对象。

```typescript
import { createAIRealtimeClient } from '$backend/ai/realtime'

const client = createAIRealtimeClient(env, userId, {
  provider: 'doubao'
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
  provider: 'seedance'
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

## Fallback 端点规则

Fallback 配置由所有 AI provider 实现通过 `resolveAIEndpoints` 共享。

规则：

- 始终使用主 base URL 和主 API key
- 空 fallback base URL 和空 fallback API key 表示禁用 fallback
- 有 fallback base URL 但没有 fallback API key 是无效配置
- 有 fallback API key 但没有 fallback base URL 是无效配置
- 无效的 fallback 组合会抛出 `AI_FALLBACK_CONFIG_INCOMPLETE`

`prepare-cloudflare.mjs` 在部署前校验同样的规则。如果设置了 fallback base URL，则需要对应的 fallback 密钥。

## 配置

公共 AI 配置位于 `.env.dev` 和 `.env.prod` 中。

| 键 | 用途 |
| --- | --- |
| `CHAT_OPENAI_BASE_URL` | OpenAI 兼容对话 base URL |
| `CHAT_OPENAI_FALLBACK_BASE_URL` | 可选对话 fallback base URL |
| `CHAT_OPENAI_MODEL` | 默认对话模型 |
| `IMAGE_GEMINI_BASE_URL` | Gemini 图像 base URL |
| `IMAGE_GEMINI_FALLBACK_BASE_URL` | 可选 Gemini 图像 fallback base URL |
| `IMAGE_GEMINI_MODEL` | 默认 Gemini 图像模型 |
| `IMAGE_OPENAI_BASE_URL` | OpenAI 图像 base URL |
| `IMAGE_OPENAI_FALLBACK_BASE_URL` | 可选 OpenAI 图像 fallback base URL |
| `IMAGE_OPENAI_MODEL` | 默认 OpenAI 图像模型 |
| `IMAGE_SEEDDREAM_BASE_URL` | SeedDream base URL |
| `IMAGE_SEEDDREAM_FALLBACK_BASE_URL` | 可选 SeedDream fallback base URL |
| `IMAGE_SEEDDREAM_MODEL` | 默认 SeedDream 图像模型 |
| `IMAGE_ALIYUN_BASE_URL` | Aliyun DashScope base URL |
| `IMAGE_ALIYUN_FALLBACK_BASE_URL` | 可选 Aliyun fallback base URL |
| `IMAGE_ALIYUN_MODEL` | 默认 Aliyun 图像模型 |
| `TTS_GEMINI_BASE_URL` | Gemini TTS base URL |
| `TTS_GEMINI_FALLBACK_BASE_URL` | 可选 Gemini TTS fallback base URL |
| `TTS_GEMINI_MODEL` | 默认 Gemini TTS 模型 |
| `TTS_SEED_BASE_URL` | Seed TTS base URL |
| `TTS_SEED_FALLBACK_BASE_URL` | 可选 Seed TTS fallback base URL |
| `TTS_SEED_MODEL` | 默认 Seed TTS 模型 |
| `REALTIME_DOUBAO_BASE_URL` | Doubao 实时 base URL |
| `REALTIME_DOUBAO_FALLBACK_BASE_URL` | 可选 Doubao 实时 fallback base URL |
| `REALTIME_DOUBAO_MODEL` | 默认 Doubao 实时模型 |
| `VIDEO_SEEDDANCE_BASE_URL` | SeedDance 视频 base URL |
| `VIDEO_SEEDDANCE_FALLBACK_BASE_URL` | 可选 SeedDance fallback base URL |
| `VIDEO_SEEDDANCE_MODEL` | 默认 SeedDance 视频模型 |

密钥占位符位于 `.env.secret.example`。

| 密钥 | 用途 |
| --- | --- |
| `CHAT_OPENAI_API_KEY` | 主对话 key |
| `CHAT_OPENAI_FALLBACK_API_KEY` | Fallback 对话 key |
| `IMAGE_GEMINI_API_KEY` | 主 Gemini 图像 key |
| `IMAGE_GEMINI_FALLBACK_API_KEY` | Fallback Gemini 图像 key |
| `IMAGE_OPENAI_API_KEY` | 主 OpenAI 图像 key |
| `IMAGE_OPENAI_FALLBACK_API_KEY` | Fallback OpenAI 图像 key |
| `IMAGE_SEEDDREAM_API_KEY` | 主 SeedDream key |
| `IMAGE_SEEDDREAM_FALLBACK_API_KEY` | Fallback SeedDream key |
| `IMAGE_ALIYUN_API_KEY` | 主 Aliyun key |
| `IMAGE_ALIYUN_FALLBACK_API_KEY` | Fallback Aliyun key |
| `TTS_GEMINI_API_KEY` | 主 Gemini TTS key |
| `TTS_GEMINI_FALLBACK_API_KEY` | Fallback Gemini TTS key |
| `TTS_SEED_API_KEY` | 主 Seed TTS key |
| `TTS_SEED_FALLBACK_API_KEY` | Fallback Seed TTS key |
| `REALTIME_DOUBAO_API_KEY` | 主 Doubao 实时 key |
| `REALTIME_DOUBAO_FALLBACK_API_KEY` | Fallback Doubao 实时 key |
| `VIDEO_SEEDDANCE_API_KEY` | 主 SeedDance key |
| `VIDEO_SEEDDANCE_FALLBACK_API_KEY` | Fallback SeedDance key |

不要将 API key 放在公共环境文件或前端配置中。

## 添加 Provider

保持 provider 添加的简单性。

1. 在对应领域下添加 provider 模块，例如 `src/backend/ai/image/acme`
2. 从 `constants.ts` 导出常量
3. 实现现有的 simple 客户端接口
4. 将 provider id 添加到该领域的 provider 联合类型中
5. 在该领域的 `createAI...Clients` 工厂中添加一个分支
6. 将环境变量添加到 `.env.dev`、`.env.prod`、`.env.secret.example`、`wrangler.jsonc.tpl` 和 `SECRET_KEYS`
7. 如果 provider 支持 fallback，添加 fallback 校验
8. 针对请求映射、fallback 行为、任务创建和 provider 错误映射添加专项单元测试

除非至少有两个领域需要完全相同的动态注册行为，否则不要创建通用 provider 注册表。当前显式的 `switch`/分支写法更简单易读。

## 常见错误

**在处理器中直接调用 provider SDK**

不要这样做。使用 `src/backend/ai/*` 的 simple 客户端，以便配置、fallback、任务行和 R2 规则保持集中管理。

**将任务负载放入队列消息**

队列消息应只包含 `taskId` 和 `userId`。任务行是事实来源。

**将 AI 任务存储在 Meta DB 中**

AI 任务是租户数据，应存储在 Tenant Shard DB 中。

**缓冲视频输出**

不要对生成的视频输出使用 `arrayBuffer` 或 base64。将 provider 响应体流式写入 R2。

**只配置一个 fallback key**

Fallback base URL 和 fallback API key 必须同时配置。缺少其中一个是无效配置。

**假设每个 provider 都支持所有选项**

`lowCensorship`、图像尺寸、基于源内容的 TTS 和引用等选项是 provider 特定的。如果 provider 不支持某个选项，应抛出 `AIError` 而不是静默忽略。

**将 AI 密钥放在 `clientConfig` 中**

AI key 是后端密钥。前端代码必须调用后端 API，不能接收 provider key。
