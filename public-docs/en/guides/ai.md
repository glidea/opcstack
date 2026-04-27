---
title: AI Integration
description: OpenAI and Gemini integration
group: Guides
order: 5
---

# AI Integration

OPC Stack integrates OpenAI and Gemini for chat and image generation.

## OpenAI Chat

### Configuration

```bash
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1  # optional
```

### Usage

```typescript
import { createChatClient } from '@/ai/chat/openai'

const client = createChatClient({
  apiKey: env.OPENAI_API_KEY,
  baseURL: env.OPENAI_BASE_URL
})

const response = await client.chat({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' }
  ]
})

console.log(response.choices[0].message.content)
```

### Streaming response

```typescript
const stream = await client.chatStream({
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'Tell me a story' }
  ]
})

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content
  if (content) {
    console.log(content)
  }
}
```

### API example

See `src/api/handler/ai.ts` implementation.

## Gemini Image

### Configuration

```bash
GEMINI_API_KEY=xxx
```

### Usage

```typescript
import { createImageClient } from '@/ai/image/gemini'

const client = createImageClient({
  apiKey: env.GEMINI_API_KEY
})

const response = await client.generate({
  prompt: 'A beautiful sunset over the ocean',
  model: 'imagen-3.0-generate-001'
})

console.log(response.images[0].url)
```

## FAQ

**Q: OpenAI API call failed**

Check API key and account balance.

**Q: How to reduce cost**

Use AI Gateway cache for repeated requests and choose cheaper models such as `gpt-3.5-turbo`.

**Q: How to build typing effect**

Use streaming response and render tokens incrementally in frontend.
