import { describe, vi } from 'vitest'
import { z } from 'zod'
import { runCases, type TestCase } from '../../../testing/bdd'
import { createOpenAINativeChatClient, createOpenAISimpleChatClient } from './index'

type CreateResponseLike = {
	choices?: Array<{
		message?: {
			content?: string | null
		}
	}>
}

type ParseResponseLike = {
	choices?: Array<{
		message?: {
			parsed?: unknown
		}
	}>
}

const {
	openAIConstructorMock,
	createMock,
	parseMock,
	zodResponseFormatMock
} = vi.hoisted(() => {
	return {
		openAIConstructorMock: vi.fn(),
		createMock: vi.fn(),
		parseMock: vi.fn(),
		zodResponseFormatMock: vi.fn()
	}
})

vi.mock('openai', () => {
	class MockOpenAI {
		chat: {
			completions: {
				create: typeof createMock
				parse: typeof parseMock
			}
		}

		constructor(config: { apiKey: string; baseURL: string }) {
			openAIConstructorMock(config)
			this.chat = {
				completions: {
					create: createMock,
					parse: parseMock
				}
			}
		}
	}

	return {
		default: MockOpenAI
	}
})

vi.mock('openai/helpers/zod', () => {
	return {
		zodResponseFormat: zodResponseFormatMock
	}
})

describe('createOpenAISimpleChatClient', () => {
	type GivenDetail = {
		envModel: string
		optionsModel?: string
		optionsTemperature?: number
		createResponse?: CreateResponseLike
		parseResponse?: ParseResponseLike
	}
	type WhenDetail = {
		prompt: string
	}
	type ThenExpected = {
		text: string
		objectTitle: string
		modelInCreate: string
		modelInParse: string
		temperatureInCreate: number
		temperatureInParse: number
		systemPromptInCreate: string
		systemPromptInParse: string
		zodFormatName: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'uses env model when options model is empty',
			given: 'env model and custom temperature',
			when: 'generating text and object from the same prompt',
			then: 'calls create and parse with env model and prompt in system message',
			givenDetail: {
				envModel: 'gpt-env',
				optionsTemperature: 0.4,
				createResponse: {
					choices: [{ message: { content: 'ok-text' } }]
				},
				parseResponse: {
					choices: [{ message: { parsed: { title: 'ok-object' } } }]
				}
			},
			whenDetail: {
				prompt: 'extract title'
			},
			thenExpected: {
				text: 'ok-text',
				objectTitle: 'ok-object',
				modelInCreate: 'gpt-env',
				modelInParse: 'gpt-env',
				temperatureInCreate: 0.4,
				temperatureInParse: 0.4,
				systemPromptInCreate: 'extract title',
				systemPromptInParse: 'extract title',
				zodFormatName: 'output'
			}
		},
		{
			scenario: 'options model overrides env model',
			given: 'env model and options model',
			when: 'generating text and object',
			then: 'uses options model for both create and parse',
			givenDetail: {
				envModel: 'gpt-env',
				optionsModel: 'gpt-opt',
				createResponse: {
					choices: [{ message: { content: 'text-2' } }]
				},
				parseResponse: {
					choices: [{ message: { parsed: { title: 'object-2' } } }]
				}
			},
			whenDetail: {
				prompt: 'summarize'
			},
			thenExpected: {
				text: 'text-2',
				objectTitle: 'object-2',
				modelInCreate: 'gpt-opt',
				modelInParse: 'gpt-opt',
				temperatureInCreate: Number.NaN,
				temperatureInParse: Number.NaN,
				systemPromptInCreate: 'summarize',
				systemPromptInParse: 'summarize',
				zodFormatName: 'output'
			}
		}
	]

	runCases(cases, async (given, when) => {
		vi.clearAllMocks()

		createMock.mockResolvedValue(given.createResponse ?? { choices: [] })
		parseMock.mockResolvedValue(given.parseResponse ?? { choices: [] })

		zodResponseFormatMock.mockImplementation((_schema: unknown, name: string) => {
			return { __name: name }
		})

		const client = createOpenAISimpleChatClient({
			type: 'chat_openai',
			model: given.optionsModel ?? given.envModel,
			endpoint: { baseURL: 'https://api.openai.com/v1', apiKey: 'k' },
			temperature: given.optionsTemperature
		})

		const schema = z.object({
			title: z.string()
		})

		const text = await client.generateText(when.prompt)
		const object = await client.generateObject(when.prompt, schema)

		const createArg = createMock.mock.calls[0]?.[0] as
			| {
					model?: string
					temperature?: number
					messages?: Array<{ role: string; content: string }>
			  }
			| undefined
		const parseArg = parseMock.mock.calls[0]?.[0] as
			| {
					model?: string
					temperature?: number
					messages?: Array<{ role: string; content: string }>
					response_format?: { __name?: string }
			  }
			| undefined

		return {
			text,
			objectTitle: object.title,
			modelInCreate: createArg?.model ?? '',
			modelInParse: parseArg?.model ?? '',
			temperatureInCreate: createArg?.temperature ?? Number.NaN,
			temperatureInParse: parseArg?.temperature ?? Number.NaN,
			systemPromptInCreate: createArg?.messages?.[0]?.content ?? '',
			systemPromptInParse: parseArg?.messages?.[0]?.content ?? '',
			zodFormatName: parseArg?.response_format?.__name ?? ''
		}
	})
})

describe('createOpenAINativeChatClient', () => {
	type GivenDetail = {
		apiKey: string
		baseURL: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		constructorCallCount: number
		apiKey: string
		baseURL: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'creates native openai client with env credentials',
			given: 'chat openai api key and base url',
			when: 'creating native client',
			then: 'passes env config to openai constructor',
			givenDetail: {
				apiKey: 'k1',
				baseURL: 'https://api.openai.test/v1'
			},
			whenDetail: {},
			thenExpected: {
				constructorCallCount: 1,
				apiKey: 'k1',
				baseURL: 'https://api.openai.test/v1'
			}
		}
	]

	runCases(cases, (given, _when) => {
		vi.clearAllMocks()
		createOpenAINativeChatClient({ apiKey: given.apiKey, baseURL: given.baseURL })
		const config = openAIConstructorMock.mock.calls[0]?.[0] as
			| { apiKey?: string; baseURL?: string }
			| undefined

		return {
			constructorCallCount: openAIConstructorMock.mock.calls.length,
			apiKey: config?.apiKey ?? '',
			baseURL: config?.baseURL ?? ''
		}
	})
})
