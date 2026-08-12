import type { z } from 'zod'
import type OpenAI from 'openai'
import type { AIEndpoint } from '../endpoint'
import { AIError } from '../error'
import { createOpenAISimpleChatClient, createOpenAINativeChatClient } from './openai'

export interface AIClients {
    simple: AISimpleChatClient
    openai: OpenAI
}

export function createAIClients(options: AIChatClientOptions): AIClients {
    const provider = options.provider ?? 'openai'
    if (provider === 'openai') {
        return {
            simple: createOpenAISimpleChatClient(options),
            openai: createOpenAINativeChatClient(options.endpoint)
        }
    }

    throw new AIError('UNSUPPORTED_AI_PROVIDER', `Unsupported AI provider: ${provider}`)
}

export interface AISimpleChatClient {
    generateText(prompt: string): Promise<string>
    generateObject<TSchema extends z.ZodTypeAny>(
        prompt: string,
        schema: TSchema
    ): Promise<z.infer<TSchema>>
}

export interface AIChatClientOptions {
    provider?: 'openai'
	model: string
	endpoint: AIEndpoint
    temperature?: number
}
