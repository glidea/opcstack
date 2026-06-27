import type { z } from 'zod'
import type OpenAI from 'openai'
import { newOpenAISimpleChatClient, newOpenAINativeChatClient } from './openai'

export interface AIClients {
    simple: AISimpleChatClient
    openai: OpenAI
}

export function newAIClients(env: Env, options: AIChatClientOptions = {}): AIClients {
    const provider = options.provider ?? 'openai'
    if (provider === 'openai') {
        return {
            simple: newOpenAISimpleChatClient(env, options),
            openai: newOpenAINativeChatClient(env)
        }
    }

    throw new Error(`UNSUPPORTED_AI_PROVIDER: ${provider}`)
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
