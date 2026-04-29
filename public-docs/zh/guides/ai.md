---
title: AI 集成
description: Chat Image TTS 集成
group: 指南
order: 5
---

# AI 集成

OPC Stack 集成了 OpenAI 和 Gemini，支持 Chat Image 和结构化脚本 TTS。

## OpenAI Chat

### 配置

```bash
CHAT_OPENAI_API_KEY=sk-xxx
CHAT_OPENAI_BASE_URL=https://api.openai.com/v1
CHAT_OPENAI_MODEL=gpt-5.4-mini
```

### 使用

```typescript
import { newAIClients } from '../../../src/ai/chat'

const clients = newAIClients(env)
const text = await clients.simple.generateText('用三句话解释 D1 read replication')
console.log(text)
```

## Gemini Image

### 配置

```bash
IMAGE_GEMINI_API_KEY=xxx
IMAGE_GEMINI_BASE_URL=https://generativelanguage.googleapis.com
IMAGE_GEMINI_MODEL=gemini-3.1-flash-image-preview
```

### 使用

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

### 配置

```bash
TTS_GEMINI_API_KEY=xxx
TTS_GEMINI_BASE_URL=https://generativelanguage.googleapis.com
TTS_GEMINI_MODEL=gemini-3.1-flash-tts-preview
```

### 使用

```typescript
import { newAITTSClients } from '../../../src/ai/tts'

const clients = newAITTSClients(env)
const audio = await clients.simple.generateSpeech({
  instruction: '中文技术访谈风格 自然 节奏稳定',
  speakers: [
    {
      name: '老周',
      voiceName: 'Charon',
      profile: '资深 Go 后端工程师',
      speechStyle: '沉稳 语速中等 发音清晰'
    },
    {
      name: '小林',
      voiceName: 'Puck',
      profile: 'Prometheus PaaS 平台开发',
      speechStyle: '自然 追问时更轻快'
    }
  ],
  lines: [
    { speakerName: '老周', text: '今天聊租户边界' },
    { speakerName: '小林', text: '重点是写入链路隔离' }
  ]
})

console.log(audio.mimeType)
```

## 常见问题

**Q: OpenAI API 调用失败？**

检查 API Key 是否正确，查看余额是否充足。

**Q: 如何降低成本？**

使用 AI Gateway 缓存重复请求，优先选择更低成本模型。

**Q: Gemini TTS 支持自定义音色吗？**

不支持上传音色克隆。当前使用 `prebuiltVoiceConfig.voiceName` 选择预置音色。
