import OpenAI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import type { z } from 'zod'
import { resolveAIEndpoints, runWithAIFallback, type AIEndpoint } from '../../fallback'
import type { AISimpleChatClient, AIChatClientOptions } from '..'

export function newOpenAINativeChatClient(env: Env): OpenAI {
	return new OpenAI({
		apiKey: env.CHAT_OPENAI_API_KEY,
		baseURL: env.CHAT_OPENAI_BASE_URL
	})
}

export function newOpenAISimpleChatClient(env: Env, options: AIChatClientOptions = {}): AISimpleChatClient {
	return new openAISimpleChatClient(env, options)
}

class openAISimpleChatClient implements AISimpleChatClient {
	private readonly endpoints: AIEndpoint[]
	private readonly model: string
	private readonly temperature: number | undefined

	constructor(env: Env, options: AIChatClientOptions) {
		this.endpoints = resolveAIEndpoints(
			env.CHAT_OPENAI_BASE_URL,
			env.CHAT_OPENAI_API_KEY,
			env.CHAT_OPENAI_FALLBACK_BASE_URL,
			env.CHAT_OPENAI_FALLBACK_API_KEY
		)
		this.model = options.model ?? env.CHAT_OPENAI_MODEL
		this.temperature = options.temperature
	}

	async generateText(prompt: string): Promise<string> {
		const completion = await runWithAIFallback(this.endpoints, async (endpoint: AIEndpoint) => {
			const client = newOpenAIClient(endpoint)
			return client.chat.completions.create({
				model: this.model,
				messages: [{ role: 'system', content: prompt }],
				temperature: this.temperature,
			})
		})

		return completion.choices[0]?.message.content ?? ''
	}

	async generateObject<TSchema extends z.ZodTypeAny>(
		prompt: string,
		schema: TSchema
	): Promise<z.infer<TSchema>> {
		const completion = await runWithAIFallback(this.endpoints, async (endpoint: AIEndpoint) => {
			const client = newOpenAIClient(endpoint)
			return client.chat.completions.parse({
				model: this.model,
				messages: [{ role: 'system', content: prompt }],
				temperature: this.temperature,
				response_format: zodResponseFormat(schema, 'output')
			})
		})

		return completion.choices[0]?.message.parsed as z.infer<TSchema>
	}
}

function newOpenAIClient(endpoint: AIEndpoint): OpenAI {
	return new OpenAI({
		apiKey: endpoint.apiKey,
		baseURL: endpoint.baseURL
	})
}
