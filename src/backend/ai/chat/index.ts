import type { z } from 'zod'
import type OpenAI from 'openai'
import { AIError } from '../error'
import { createOpenAISimpleChatClient, createOpenAINativeChatClient } from './openai'

export interface AIClients {
    simple: AISimpleChatClient
    openai: OpenAI
}

export function createAIClients(env: Env, options: AIChatClientOptions = {}): AIClients {
    const provider = options.provider ?? 'openai'
    if (provider === 'openai') {
        return {
            simple: createOpenAISimpleChatClient(env, options),
            openai: createOpenAINativeChatClient(env)
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
    model?: string
    temperature?: number
}
