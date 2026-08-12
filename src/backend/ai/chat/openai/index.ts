import OpenAI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import type { z } from 'zod'
import type { AIEndpoint } from '../../endpoint'
import type { AISimpleChatClient, AIChatClientOptions } from '..'

export function createOpenAINativeChatClient(endpoint: AIEndpoint): OpenAI {
	return new OpenAI({
		apiKey: endpoint.apiKey,
		baseURL: endpoint.baseURL
	})
}

export function createOpenAISimpleChatClient(options: AIChatClientOptions): AISimpleChatClient {
	return new openAISimpleChatClient(options)
}

class openAISimpleChatClient implements AISimpleChatClient {
	private readonly endpoint: AIEndpoint
	private readonly model: string
	private readonly temperature: number | undefined

	constructor(options: AIChatClientOptions) {
		this.endpoint = options.endpoint
		this.model = options.model
		this.temperature = options.temperature
	}

	async generateText(prompt: string): Promise<string> {
		const client = createOpenAIClient(this.endpoint)
		const completion = await client.chat.completions.create({
			model: this.model,
			messages: [{ role: 'system', content: prompt }],
			temperature: this.temperature,
		})

		return completion.choices[0]?.message.content ?? ''
	}

	async generateObject<TSchema extends z.ZodTypeAny>(
		prompt: string,
		schema: TSchema
	): Promise<z.infer<TSchema>> {
		const client = createOpenAIClient(this.endpoint)
		const completion = await client.chat.completions.parse({
			model: this.model,
			messages: [{ role: 'system', content: prompt }],
			temperature: this.temperature,
			response_format: zodResponseFormat(schema, 'output')
		})

		return completion.choices[0]?.message.parsed as z.infer<TSchema>
	}
}

function createOpenAIClient(endpoint: AIEndpoint): OpenAI {
	return new OpenAI({
		apiKey: endpoint.apiKey,
		baseURL: endpoint.baseURL
	})
}
