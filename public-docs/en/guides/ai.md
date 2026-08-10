---
title: AI Integration
description: Chat, image, TTS, realtime, video, async tasks, queues, R2 outputs, and provider config
group: Guides
group_order: 1
order: 5
---

# AI Integration

OPCStack keeps AI provider code under `src/backend/ai/`. Handlers and business modules should call the simple client interfaces from that directory, not provider SDKs directly. This keeps provider-specific request shapes, channel endpoint rules, task persistence, queue retry behavior, and R2 output handling in one place.

The current AI surface is backend-only:

| Area | Entry | Providers | Async task |
| --- | --- | --- | --- |
| Chat | `src/backend/ai/chat` | OpenAI-compatible | No |
| Image | `src/backend/ai/image` | Gemini, OpenAI, SeedDream, Aliyun | Yes |
| TTS | `src/backend/ai/tts` | Gemini, Seed | Yes |
| Realtime | `src/backend/ai/realtime` | Doubao | No |
| Video | `src/backend/ai/video` | SeedDance | Yes |

## AI Model

Every AI area exposes a small `createAI...Clients` factory. The factory returns a `simple` client and, where useful, the native provider client.

```
Business code
  |
  +-- createAI...Clients(env, userId, tenantDb, options)
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

Provider selection is explicit in `options.provider`. Defaults exist only where the product has one clear default:

| Area | Default provider |
| --- | --- |
| Chat | `openai` |
| Image | `gemini` |
| TTS | `gemini` |
| Realtime | `doubao` |
| Video | `seedance` |

Unsupported provider names throw `AIError('UNSUPPORTED_AI_PROVIDER')`.

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

Supported provider ids are part of the public TypeScript contract for each AI area.

| Area | Provider id | Module | Default model env |
| --- | --- | --- | --- |
| Chat | `openai` | `chat/openai` | `CHAT_OPENAI_MODEL` |
| Image | `gemini` | `image/gemini` | `IMAGE_GEMINI_MODEL` |
| Image | `openai` | `image/openai` | `IMAGE_OPENAI_MODEL` |
| Image | `seedream` | `image/seedream` | `IMAGE_SEEDDREAM_MODEL` |
| Image | `aliyun` | `image/aliyun` | `IMAGE_ALIYUN_MODEL` |
| TTS | `gemini` | `tts/gemini` | `TTS_GEMINI_MODEL` |
| TTS | `seed` | `tts/seed` | `TTS_SEED_MODEL` |
| Realtime | `doubao` | `realtime/doubao` | `REALTIME_DOUBAO_MODEL` |
| Video | `seedance` | `video/seedance` | `VIDEO_SEEDDANCE_MODEL` |

Use provider constants from the provider `constants.ts` files when the caller needs a known model or voice name. Do not duplicate literal model lists in handlers or frontend code.

## Chat

Chat is OpenAI-compatible and synchronous.

```typescript
import { createAIClients } from '$backend/ai/chat'

const clients = createAIClients(env)
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

const result = await createAIClients(env).simple.generateObject(
  'Summarize this product idea',
  schema
)
```

Chat config:

| Key | File | Purpose |
| --- | --- | --- |
| `CHAT_OPENAI_BASE_URL` | `.env.dev`, `.env.prod` | Primary OpenAI-compatible base URL |
| `CHAT_OPENAI_MODEL` | `.env.dev`, `.env.prod` | Default chat model |
| `CHAT_OPENAI_API_KEY` | `.env.secret.example` | Primary API key placeholder |

## Image

Image supports generate and edit flows. References can be inline base64 or existing R2 objects.

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

Provider behavior:

| Provider | Output | Notes |
| --- | --- | --- |
| Gemini | WAV | Supports one or two speakers |
| Seed `seed-tts-2.0-standard` | MP3 | Standard speech generation |
| Seed `doubao-seed-podcast` | MP3 | Supports source-driven podcast generation |

`generateSpeechFromSource` only works for Seed with `TTS_SEED_MODEL=doubao-seed-podcast`. Other TTS models throw `TTS_SOURCE_NOT_SUPPORTED`.

TTS output is written to `audio/` when `uploadToR2=true`.

## Realtime

Realtime currently supports Doubao over WebSocket. It returns a session object with a typed event stream and direct control methods.

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

The existing `*/10 * * * *` scheduled job deletes `completed` and `failed` task rows whose `updated_at` is older than `AI_TASK_RETENTION_DAYS`. It never deletes `processing` rows. This database cleanup does not read task results or delete generated R2 objects; object retention stays with R2 lifecycle rules.

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

Synchronous Chat and Realtime calls use their provider's single configured endpoint. Image and TTS synchronous calls use the same provider endpoint unless the caller passes an explicit endpoint. Async consumers always pass the endpoint selected by Channel Router. Providers never choose a second endpoint or retry through another endpoint.

## Channel Router

Channel Router is used only by Image, TTS, and Video async consumers. Task creation still accepts only a provider and model. The consumer discovers complete channel prefixes from `Env`, filters channels that declare the task model, and selects the highest score before calling the provider.

The score is calculated inside the current Tenant Shard from 1-minute buckets over the last 5 minutes and 1 hour:

```text
normalize(value, pool_max) = pool_max == 0 ? 0 : value / pool_max
penalty = (error * error_weight + latency * latency_weight + price * price_weight) / total_weight
score = (1 - penalty) * 100
```

The 5-minute and 1-hour values are combined as `70% + 30%` when both exist. Missing error or latency values use the candidate-pool median. When the entire pool has no value for one metric, its normalized penalty is `0.5`. Equal scores use the complete channel prefix in ascending order.

Each upstream attempt increments one `(channel, model, bucket_start)` row. Successful attempts add latency; failed upstream attempts only add the error count. The router does not write per-call detail rows, use process memory, or add a global metrics service. The existing 10-minute scheduled job deletes metric buckets older than 24 hours from every active or draining Tenant Shard.

Video selects a channel only when creating a new remote provider task. After the provider returns a task id, the consumer persists `channel`, `channel_started_at`, and `provider_task_id` together. Later polling resolves the endpoint from that stored channel and never calls Channel Router again. A confirmed remote `failed` result records the channel error, appends the channel to `failed_channels_json`, and clears all three execution fields before the next queue attempt selects another channel. Polling network errors keep the existing binding.

## Config

Public AI config lives in `.env.dev` and `.env.prod`.

| Key | Purpose |
| --- | --- |
| `CHAT_OPENAI_BASE_URL` | OpenAI-compatible chat base URL |
| `CHAT_OPENAI_MODEL` | Default chat model |
| `IMAGE_GEMINI_BASE_URL` | Gemini image base URL |
| `IMAGE_GEMINI_MODEL` | Default Gemini image model |
| `IMAGE_OPENAI_BASE_URL` | OpenAI image base URL |
| `IMAGE_OPENAI_MODEL` | Default OpenAI image model |
| `IMAGE_SEEDDREAM_BASE_URL` | SeedDream base URL |
| `IMAGE_SEEDDREAM_MODEL` | Default SeedDream image model |
| `IMAGE_ALIYUN_BASE_URL` | Aliyun DashScope base URL |
| `IMAGE_ALIYUN_MODEL` | Default Aliyun image model |
| `TTS_GEMINI_BASE_URL` | Gemini TTS base URL |
| `TTS_GEMINI_MODEL` | Default Gemini TTS model |
| `TTS_SEED_BASE_URL` | Seed TTS base URL |
| `TTS_SEED_MODEL` | Default Seed TTS model |
| `REALTIME_DOUBAO_BASE_URL` | Doubao realtime base URL |
| `REALTIME_DOUBAO_MODEL` | Default Doubao realtime model |
| `VIDEO_SEEDDANCE_BASE_URL` | SeedDance video base URL |
| `VIDEO_SEEDDANCE_MODEL` | Default SeedDance video model |
| `AI_ROUTING_ERROR_WEIGHT` | Async channel error-rate score weight |
| `AI_ROUTING_LATENCY_WEIGHT` | Async channel latency score weight |
| `AI_ROUTING_PRICE_WEIGHT` | Async channel price score weight |
| `AI_TASK_RETENTION_DAYS` | Retention period for completed and failed async tasks |

Secret placeholders live in `.env.secret.example`.

| Secret | Purpose |
| --- | --- |
| `CHAT_OPENAI_API_KEY` | Primary chat key |
| `IMAGE_GEMINI_API_KEY` | Primary Gemini image key |
| `IMAGE_OPENAI_API_KEY` | Primary OpenAI image key |
| `IMAGE_SEEDDREAM_API_KEY` | Primary SeedDream key |
| `IMAGE_ALIYUN_API_KEY` | Primary Aliyun key |
| `TTS_GEMINI_API_KEY` | Primary Gemini TTS key |
| `TTS_SEED_API_KEY` | Primary Seed TTS key |
| `REALTIME_DOUBAO_API_KEY` | Primary Doubao realtime key |
| `VIDEO_SEEDDANCE_API_KEY` | Primary SeedDance key |
| `IMAGE_GEMINI_OFFICIAL_API_KEY` | Gemini image channel key |
| `IMAGE_OPENAI_OFFICIAL_API_KEY` | OpenAI image channel key |
| `IMAGE_SEEDDREAM_OFFICIAL_API_KEY` | SeedDream image channel key |
| `IMAGE_ALIYUN_OFFICIAL_API_KEY` | Aliyun image channel key |
| `TTS_GEMINI_OFFICIAL_API_KEY` | Gemini TTS channel key |
| `TTS_SEED_OFFICIAL_API_KEY` | Seed TTS channel key |
| `VIDEO_SEEDDANCE_OFFICIAL_API_KEY` | SeedDance video channel key |

Do not put API keys in public env files or frontend config.

Async channel configuration uses one complete ENV prefix per channel:

```bash
IMAGE_OPENAI_OFFICIAL_BASE_URL=https://api.openai.com/v1
IMAGE_OPENAI_OFFICIAL_MODELS=gpt-image-2
IMAGE_OPENAI_OFFICIAL_PRICE_MULTIPLIER=1
IMAGE_OPENAI_OFFICIAL_API_KEY=
```

`MODELS` accepts semicolon-separated model names. `PRICE_MULTIPLIER` must be positive. The Cloudflare preparation script discovers complete channel prefixes and injects their public fields and secret keys into the generated runtime configuration.

## Add A Provider

Keep provider additions boring.

1. Add the provider module under the right area, for example `src/backend/ai/image/acme`
2. Export constants from `constants.ts`
3. Implement the existing simple client interface
4. Add the provider id to the area's provider union
5. Add one branch in the area's `createAI...Clients` factory
6. Add env keys to `.env.dev`, `.env.prod`, `.env.secret.example`, `wrangler.jsonc.tpl`, and `SECRET_KEYS`
7. Add focused unit tests for request mapping, task creation, and provider error mapping

Do not create a generic provider registry unless at least two areas need the exact same dynamic registration behavior. The current explicit `switch`/branch style is simpler and easier to read.

## Common Mistakes

**Calling provider SDKs from handlers**

Do not do this. Use `src/backend/ai/*` simple clients so config, channel endpoints, task rows, and R2 rules stay centralized.

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
