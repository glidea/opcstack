import type { z } from 'zod'
import type OpenAI from 'openai'
import type { AIProviderType } from '../config'
import type { AIEndpoint } from '../endpoint'
import { createOpenAISimpleChatClient, createOpenAINativeChatClient } from './openai'

export interface AIClients {
	simple: AISimpleChatClient
	openai: OpenAI
}

export function createAIChatClients(options: AIChatClientOptions): AIClients {
	return {
		simple: createOpenAISimpleChatClient(options),
		openai: createOpenAINativeChatClient(options.endpoint)
	}
}

export interface AISimpleChatClient {
    generateText(prompt: string): Promise<string>
    generateObject<TSchema extends z.ZodTypeAny>(
        prompt: string,
        schema: TSchema
    ): Promise<z.infer<TSchema>>
}

export interface AIChatClientOptions {
	type: Extract<AIProviderType, 'chat_openai'>
	model: string
	endpoint: AIEndpoint
	temperature?: number
}
