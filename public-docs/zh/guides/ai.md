---
title: AI 集成
description: OpenAI 和 Gemini 集成
group: 指南
order: 5
---

# AI 集成

OPC Stack 集成了 OpenAI 和 Gemini，支持聊天和图片生成。

## OpenAI Chat

### 配置

```bash
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1  # 可选
```

### 使用

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

### 流式响应

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

### API 示例

参考 `src/api/handler/ai.ts` 中的实现。

## Gemini Image

### 配置

```bash
GEMINI_API_KEY=xxx
```

### 使用

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

## 常见问题

**Q: OpenAI API 调用失败？**

检查 API Key 是否正确，查看余额是否充足。

**Q: 如何降低成本？**

使用 AI Gateway 缓存重复请求，选择更便宜的模型（如 gpt-3.5-turbo）。

**Q: 如何实现打字机效果？**

使用流式响应，前端逐字显示。
