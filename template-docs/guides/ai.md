---
title: AI Integration
description: Chat Image TTS integration
group: Guides
order: 5
---

# AI Integration

OPC Stack integrates OpenAI and Gemini for Chat Image and structured script TTS.

## OpenAI Chat

### Configuration

`.env.secret.dev` or `.env.secret.prod`:

```bash
CHAT_OPENAI_API_KEY=sk-xxx
```

`.env.dev` or `.env.prod`:

```bash
CHAT_OPENAI_BASE_URL=https://api.openai.com/v1
CHAT_OPENAI_MODEL=gpt-5.4-mini
```

### Usage

```typescript
import { newAIClients } from '../../../src/ai/chat'

const clients = newAIClients(env)
const text = await clients.simple.generateText('Explain D1 read replication in three lines')
console.log(text)
```

## Gemini Image

### Configuration

`.env.secret.dev` or `.env.secret.prod`:

```bash
IMAGE_GEMINI_API_KEY=xxx
```

`.env.dev` or `.env.prod`:

```bash
IMAGE_GEMINI_BASE_URL=https://generativelanguage.googleapis.com
IMAGE_GEMINI_MODEL=gemini-3.1-flash-image-preview
```

### Usage

```typescript
import { newAIImageClients } from '../../../src/ai/image'

const clients = newAIImageClients(env)
const images = await clients.simple.generate({
  prompt: 'sunset over the ocean',
  numberOfImages: 1
})
console.log(images[0]?.mimeType)
```

## Gemini TTS

### Configuration

`.env.secret.dev` or `.env.secret.prod`:

```bash
TTS_GEMINI_API_KEY=xxx
```

`.env.dev` or `.env.prod`:

```bash
TTS_GEMINI_BASE_URL=https://generativelanguage.googleapis.com
TTS_GEMINI_MODEL=gemini-3.1-flash-tts-preview
```

### Usage

```typescript
import { newAITTSClients } from '../../../src/ai/tts'

const clients = newAITTSClients(env)
const audio = await clients.simple.generateSpeech({
  instruction: 'Chinese tech interview style natural stable pace',
  speakers: [
    {
      name: 'Host',
      voiceName: 'Charon',
      profile: 'Senior Go backend engineer',
      speechStyle: 'calm medium pace clear articulation'
    },
    {
      name: 'Guest',
      voiceName: 'Puck',
      profile: 'Prometheus PaaS engineer',
      speechStyle: 'natural more energetic in follow-up questions'
    }
  ],
  lines: [
    { speakerName: 'Host', text: 'Today we discuss tenant boundaries' },
    { speakerName: 'Guest', text: 'Write path isolation is the core issue' }
  ]
})

console.log(audio.mimeType)
```

## FAQ

**Q: OpenAI API call failed**

Check API key and account balance.

**Q: How to reduce cost**

Use AI Gateway cache for repeated requests and choose cheaper models.

**Q: Does Gemini TTS support custom voice cloning**

No. Use `prebuiltVoiceConfig.voiceName` to select a built-in voice.
