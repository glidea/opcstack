import { describe, expect, it } from 'vitest'
import { createAIChatClients } from './index'

describe('createAIChatClients', () => {
	it('creates clients for the selected provider type', () => {
		const result: ReturnType<typeof createAIChatClients> = createAIChatClients({
			type: 'chat_openai',
			model: 'gpt-4.1-mini',
			endpoint: {
				baseURL: 'https://api.openai.com/v1',
				apiKey: 'test-key'
			}
		})

		expect({
			simple: typeof result.simple.generateText,
			openai: result.openai.constructor.name
		}).toEqual({
			simple: 'function',
			openai: 'OpenAI'
		})
	})
})
