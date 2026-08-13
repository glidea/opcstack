---
title: AI Integration
description: Chat, image, TTS, realtime, video, async tasks, queues, R2 outputs, and provider config
group: Guides
group_order: 1
order: 5
---

# AI Integration

OPCStack keeps AI provider code under `src/backend/ai/`. Handlers and business modules should call the simple client interfaces from that directory, not provider SDKs directly. This keeps provider-specific request shapes, Provider endpoints, task persistence, queue retry behavior, and R2 output handling in one place.

The current AI surface is backend-only:

| Area | Entry | Providers | Async task |
| --- | --- | --- | --- |
| Chat | `src/backend/ai/chat` | OpenAI-compatible | No |
| Image | `src/backend/ai/image` | Gemini, OpenAI, SeedDream, Aliyun | Yes |
| TTS | `src/backend/ai/tts` | Gemini, Seed | Yes |
| Realtime | `src/backend/ai/realtime` | Doubao | No |
| Video | `src/backend/ai/video` | SeedDance | Yes |

## AI Model

Each AI module exposes a small `createAI...Clients` factory. The factory returns a `simple` client and, where useful, the native provider client.

```
Business code
  |
  +-- createAI...Clients(userId, tenantDb, options)
        |
        +-- simple client interface
        |
        +-- provider implementation
              |
              +-- explicit endpoint
              +-- provider SDK or fetch
              +-- optional task row in Tenant Shard DB
              +-- optional R2 output
```

The business operation determines the required combined Provider Type and model before loading configuration. The configuration component filters enabled D1 Provider entities by exact `type + model`, Provider Router ranks those entities, and the selected entity supplies the endpoint and API key to the factory. There is no default Provider or second provider selection inside the factory.

Unsupported Provider Types throw `AIError('UNSUPPORTED_AI_PROVIDER')`.

## Module Layout

```
src/backend/ai/
  error.ts              # AIError and typed error codes
  endpoint.ts           # explicit provider endpoint type
  chat/
    index.ts
    openai/
  image/
    index.ts            # simple image client types
    task.ts             # image async task row + queue message
    reference.ts        # inline/R2 image reference resolution
    gemini/
    openai/
    seedream/
    aliyun/
  tts/
    index.ts            # simple TTS client types
    task.ts             # TTS async task row + queue message
    gemini/
    seed/
  realtime/
    index.ts
    doubao/
  video/
    index.ts            # simple video client types
    task.ts             # video async task row + queue message
    reference.ts        # R2 reference to public/signed URL
    seedance/
```

Queue handlers live outside `src/backend/ai/`:

```
src/backend/consumers/
  index.ts
  ai-image.ts
  ai-tts.ts
  ai-video.ts
```

## Providers

Supported combined Provider Types are part of the public TypeScript contract.

| Module | Provider Type | Implementation |
| --- | --- | --- |
| Chat | `chat_openai` | `chat/openai` |
| Image | `image_gemini` | `image/gemini` |
| Image | `image_openai` | `image/openai` |
| Image | `image_seedream` | `image/seedream` |
| Image | `image_aliyun` | `image/aliyun` |
| TTS | `tts_gemini` | `tts/gemini` |
| TTS | `tts_seed` | `tts/seed` |
| Realtime | `realtime_doubao` | `realtime/doubao` |
| Video | `video_seedance` | `video/seedance` |

Use provider constants from the provider `constants.ts` files when the caller needs a known model or voice name. Do not duplicate literal model lists in handlers or frontend code.

## Chat

Chat is OpenAI-compatible and synchronous.

```typescript
import { createAIClients } from '$backend/ai/chat'

const clients = createAIClients({ provider: 'openai', model, endpoint })
const text = await clients.simple.generateText('Explain D1 sharding in three lines')
```

Structured output uses a Zod schema:

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

Chat selects an enabled `chat_openai` Provider entity for the requested model. Its API key is decrypted before the client is created and is never returned by configuration read APIs.

## Image

Image supports generate and edit flows. References can be inline base64 or existing R2 objects.

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

Image input:

| Field | Meaning |
| --- | --- |
| `prompt` | Text instruction |
| `numberOfImages` | Requested output count |
| `references` | Inline or R2 image references |
| `aspectRatio` | `1:1`, `3:4`, `4:3`, `9:16`, or `16:9` |
| `imageSize` | `1K`, `2K`, or `4K` |
| `lowCensorship` | Provider-specific relaxed moderation mode |
| `uploadToR2` | Store generated output in R2 |
| `r2UploadDir` | Relative output dir under the selected R2 visibility prefix |
| `r2UploadIsPublic` | Whether output is public |

R2 references use the R2 client and respect normal R2 read rules:

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

When `uploadToR2=true`, both `r2UploadDir` and `r2UploadIsPublic` are required. Missing either throws `AI_IMAGE_R2_UPLOAD_DIR_REQUIRED` or `AI_IMAGE_R2_UPLOAD_IS_PUBLIC_REQUIRED`.

Provider notes:

| Provider | Notes |
| --- | --- |
| Gemini | Uses Google GenAI `generateContent`, supports inline image references |
| OpenAI | Uses streaming image generate/edit and converts final events to image results |
| SeedDream | Uses Volcengine Ark OpenAI-compatible image endpoint |
| Aliyun | Uses DashScope and has provider-specific model and size restrictions |

## TTS

TTS accepts explicit speakers and transcript lines. The caller owns script quality. The client only validates speaker count and speaker names.

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

Provider behavior:

| Provider | Output | Notes |
| --- | --- | --- |
| Gemini | WAV | Supports one or two speakers |
| Seed `seed-tts-2.0-standard` | MP3 | Standard speech generation |
| Seed `doubao-seed-podcast` | MP3 | Supports source-driven podcast generation |

`generateSpeechFromSource` only works for Seed with model `doubao-seed-podcast`. Other TTS models throw `TTS_SOURCE_NOT_SUPPORTED`.

TTS output is written to `audio/` when `uploadToR2=true`.

## Realtime

Realtime currently supports Doubao over WebSocket. It returns a session object with a typed event stream and direct control methods.

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

Session methods:

| Method | Purpose |
| --- | --- |
| `sendAudio(audio)` | Send PCM audio bytes |
| `sendText(text)` | Send a text query |
| `interrupt()` | Interrupt the current assistant response |
| `finish()` | Finish the session and close provider connection |

Stream event types:

| Event | Meaning |
| --- | --- |
| `session_started` | Provider session is ready |
| `user_transcript` | ASR transcript |
| `assistant_text` | Assistant text response |
| `assistant_audio` | Assistant audio chunk |
| `assistant_audio_ended` | Current audio response ended |
| `interrupted` | Response interrupted |
| `finished` | Session finished |
| `error` | Runtime error event |

Doubao model aliases are validated in code. Unknown realtime models throw `DOUBAO_REALTIME_MODEL_UNSUPPORTED`.

## Video

Video currently supports SeedDance. The simple client always creates a local async task first. The queue consumer creates or polls the remote provider task.

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

Video references are R2 objects with a declared media type:

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

Reference URL rules:

| R2 key | Provider URL |
| --- | --- |
| `public/*` | Public `/api/r2/...` URL |
| `tmp/public/*` | Public `/api/r2/...` URL |
| Private key | Signed read URL |

The video consumer downloads the final provider video URL as a stream and writes it to R2 as `video/mp4`. Do not change this to `arrayBuffer` or base64. Large video output must not be buffered in memory.

## Async Task Flow

Image, TTS, and Video support async task rows in the Tenant Shard DB.

For cross-user task inspection and contextual Cloudflare links, see [Admin Console](admin-console.md).

```
API or business code
  |
  +-- simple.generateAsync / generateSpeechAsync / video.generate
        |
        +-- insert processing task in current user's Tenant Shard DB
        |
        +-- send queue message { taskId, userId }
              |
              +-- consumer opens user DB through Meta shard registry
              |
              +-- calls provider
              |
              +-- writes completed or failed task row
```

Tables:

| Table | Owner | Purpose |
| --- | --- | --- |
| `ai_image_tasks` | Tenant Shard DB | Image generation/edit task state and result |
| `ai_tts_tasks` | Tenant Shard DB | TTS task state and result |
| `ai_video_tasks` | Tenant Shard DB | Video task state, provider task id, and result |

Task statuses:

| Status | Meaning |
| --- | --- |
| `processing` | Task is queued, running, or waiting for provider polling |
| `completed` | Result JSON is written |
| `failed` | Max attempts reached or provider returned failed state |

Consumers skip missing tasks and non-processing tasks, then `ack()` the queue message. This makes retries idempotent at the task row boundary.

The existing `*/10 * * * *` scheduled job loads `taskRetentionDays` from D1 once per trigger and deletes older `completed` and `failed` task rows. It never deletes `processing` rows. This database cleanup does not read task results or delete generated R2 objects; object retention stays with R2 lifecycle rules.

## Queue Consumers

Required queue names:

```bash
QUEUE_NAMES=image-generate;tts-generate;video-generate
```

Generated bindings:

| Queue | Binding | Handler |
| --- | --- | --- |
| `image-generate` | `Q_IMAGE_GENERATE` | `handleAIImageQueue` |
| `tts-generate` | `Q_TTS_GENERATE` | `handleAITTSQueue` |
| `video-generate` | `Q_VIDEO_GENERATE` | `handleAIVideoQueue` |

Queue message shape is deliberately small:

```typescript
{
  taskId: string
  userId: string
}
```

Do not add prompt, provider config, references, or output options to queue messages. The task row is the durable source of truth.

Retry behavior:

| Consumer | Max attempts | Retry delay |
| --- | --- | --- |
| Image | 3 | 10s, 30s, then fail |
| TTS | 3 | 10s, 30s, then fail |
| Video | 3 provider/error attempts | 10s, 30s, then fail |

Video polling is separate from failure retry. A running provider task is retried after 30 seconds without incrementing `attemptCount`.

## R2 Output Rules

Use R2 only when the output needs to survive the request.

| Area | In-memory result | R2 result |
| --- | --- | --- |
| Image | `imageBase64`, `mimeType` | Optional `r2.key`, `r2.url` |
| TTS | `audioBase64`, `mimeType` | Optional `r2.key`, `r2.url` |
| Video | None | Required final `video/mp4` object |

Rules:

- Image upload requires explicit `r2UploadDir` and `r2UploadIsPublic`
- TTS uploads to `audio/`
- Video uploads to `r2UploadDir` or `videos`
- Video provider output must be streamed into R2
- Private references should use signed URLs instead of public paths
- Generated public files still need normal R2 path rules from the Storage guide

## Tenant Data Ownership

AI task rows are tenant-owned data because they are user runtime artifacts.

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

Request handlers that create tasks for the current user should use the current request `tenantDb`. Queue consumers do not have request context, so they use `createTenantShardAccess(metaDb, env).openUserDb(userId)`.

Do not store AI task rows in Meta DB. Meta DB only owns the shard registry needed to find the tenant DB.

## Endpoint Rules

Every AI operation identifies a Provider Type and model before routing. The configuration module filters enabled `ai_providers` by exact `type + model`. Provider implementations receive one explicit endpoint and never select or retry another Provider.

## Provider Router

Provider Router ranks a prefiltered candidate list. It does not know Image, OpenAI, or any Provider Type. Synchronous calls use the top-ranked Provider. Image and TTS asynchronous consumers may try ranked Providers in one queue attempt.

The score is calculated inside the current Tenant Shard from 1-minute buckets over the last 5 minutes and 1 hour:

```text
normalize(value, pool_max) = pool_max == 0 ? 0 : value / pool_max
penalty = (error * error_weight + latency * latency_weight + price * price_weight) / total_weight
score = (1 - penalty) * 100
```

The 5-minute and 1-hour values are combined as `70% + 30%` when both exist. Missing error or latency values use the candidate-pool median. When the entire pool has no value for one metric, its normalized penalty is `0.5`. Equal scores use Provider ID in ascending order.

Each upstream attempt increments one `(provider_id, model, bucket_start)` row. Successful attempts add latency; failed upstream attempts only add the error count. The router does not write per-call detail rows, use process memory, or add a global metrics service. The existing 10-minute scheduled job deletes metric buckets older than 24 hours from every active or draining Tenant Shard.

Video selects a Provider only when creating a new remote task. After the Provider returns a task ID, the consumer persists `provider_id`, `provider_started_at`, and `provider_task_id` together. Later polling resolves the endpoint from the persisted Provider ID and does not route again, even if that Provider is disabled. A confirmed remote failure records the Provider error, appends its ID to `failed_provider_ids_json`, and clears the execution fields before the next queue attempt selects another Provider. Polling network errors keep the existing binding.

## Config

`META_DB` is the only source of AI business configuration. `system_settings.ai_config` stores routing weights and task retention. Each `ai_providers` row stores one independently versioned Provider with its combined Provider Type, supported models, endpoint, price multiplier, enabled state, and AES-GCM encrypted API key. Read APIs expose only `api_key_configured`.

Configuration saves take effect for the next request, queue message, WebSocket connection, or cron trigger. One operation keeps the snapshot it started with. A Video task that already has a remote task ID keeps its persisted Provider.

Open **Admin > System settings > AI routing** to save routing weights and task retention. Open **Admin > AI providers** to manage Provider entities. A Provider requires a name, Provider Type, at least one model, base URL, price multiplier, enabled state, and an API key when created. Provider create, edit, and delete operations update only the target row. Stale versions require an explicit refresh. The page shows only whether an API key is configured.

No AI business setting or credential belongs in `.env.dev`, `.env.prod`, `.env.secret.*`, or `wrangler.jsonc`.

## Add A Provider

Keep provider additions boring.

1. Add the provider module under the right area, for example `src/backend/ai/image/acme`
2. Export constants from `constants.ts`
3. Implement the existing simple client interface
4. Add the combined Provider Type to the configuration union, API schema, and Admin select
5. Add one branch in the area's `createAI...Clients` factory
6. Add focused unit tests for request mapping, task creation, and provider error mapping

Do not create a generic provider registry unless at least two areas need the exact same dynamic registration behavior. The current explicit `switch`/branch style is simpler and easier to read.

## Common Mistakes

**Calling provider SDKs from handlers**

Do not do this. Use `src/backend/ai/*` simple clients so Provider endpoints, task rows, and R2 rules stay centralized.

**Putting task payload in the queue message**

The queue message should only contain `taskId` and `userId`. The task row is the source of truth.

**Storing AI tasks in Meta DB**

AI tasks are tenant data. Store them in Tenant Shard DB.

**Buffering video output**

Do not use `arrayBuffer` or base64 for generated video output. Stream the provider response body into R2.

**Assuming every provider supports every option**

Options such as `lowCensorship`, image size, source-driven TTS, and references are provider-specific. If the provider cannot support an option, fail with an `AIError` instead of silently ignoring it.

**Using `clientConfig` for AI secrets**

AI keys are backend secrets. Frontend code must call backend APIs. It must not receive provider keys.
