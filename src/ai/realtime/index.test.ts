import { describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../testing/bdd'
import {
	newAIRealtimeClient,
	type AIRealtimeClient,
	type AIRealtimeSession,
	type AIRealtimeStartSessionInput
} from './index'
import {
	DOUBAO_REALTIME_MODEL_O2,
	DOUBAO_REALTIME_MODEL_SC2,
	DOUBAO_REALTIME_SPEAKER_ZH_FEMALE_VV_JUPITER_BIGTTS
} from './index'

type ConstructorCall = {
	userId: string
	model: string
}

type StartSessionCall = {
	speaker: string
	prompt: string
}

const {
	constructorCalls,
	startSessionCalls
} = vi.hoisted(() => {
	return {
		constructorCalls: [] as ConstructorCall[],
		startSessionCalls: [] as StartSessionCall[]
	}
})

vi.mock('./doubao', async () => {
	const actual = await vi.importActual<typeof import('./doubao')>('./doubao')
	class FakeRealtimeClient implements AIRealtimeClient {
		async startSession(input: AIRealtimeStartSessionInput): Promise<AIRealtimeSession> {
			startSessionCalls.push({
				speaker: input.speaker,
				prompt: input.prompt ?? ''
			})
			return {
				sessionId: 'session-1',
				events: new ReadableStream(),
				sendAudio: async (): Promise<void> => {
					return
				},
				sendText: async (): Promise<void> => {
					return
				},
				interrupt: async (): Promise<void> => {
					return
				},
				finish: async (): Promise<void> => {
					return
				}
			}
		}
	}
	return {
		...actual,
		newDoubaoRealtimeClient: (_env: Env, userId: string, model: string): AIRealtimeClient => {
			constructorCalls.push({ userId, model })
			return new FakeRealtimeClient()
		}
	}
})

describe('newAIRealtimeClient', () => {
	type GivenDetail = {
		optionsModel?: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		userId: string
		model: string
		speaker: string
		prompt: string
		sessionId: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'uses default doubao model from env',
			given: 'no model option',
			when: 'starting realtime session',
			then: 'passes user model speaker and prompt to provider client',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				userId: 'u1',
				model: DOUBAO_REALTIME_MODEL_O2,
				speaker: DOUBAO_REALTIME_SPEAKER_ZH_FEMALE_VV_JUPITER_BIGTTS,
				prompt: 'article',
				sessionId: 'session-1'
			}
		},
		{
			scenario: 'model option overrides env model',
			given: 'explicit model option',
			when: 'starting realtime session',
			then: 'passes option model to provider client',
			givenDetail: {
				optionsModel: DOUBAO_REALTIME_MODEL_SC2
			},
			whenDetail: {},
			thenExpected: {
				userId: 'u1',
				model: DOUBAO_REALTIME_MODEL_SC2,
				speaker: DOUBAO_REALTIME_SPEAKER_ZH_FEMALE_VV_JUPITER_BIGTTS,
				prompt: 'article',
				sessionId: 'session-1'
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		constructorCalls.length = 0
		startSessionCalls.length = 0
		const env: Env = {
			REALTIME_DOUBAO_MODEL: DOUBAO_REALTIME_MODEL_O2
		} as unknown as Env
		const client: AIRealtimeClient = newAIRealtimeClient(env, 'u1', {
			model: given.optionsModel
		})
		const session: AIRealtimeSession = await client.startSession({
			speaker: DOUBAO_REALTIME_SPEAKER_ZH_FEMALE_VV_JUPITER_BIGTTS,
			prompt: 'article'
		})
		return {
			userId: constructorCalls[0]!.userId,
			model: constructorCalls[0]!.model,
			speaker: startSessionCalls[0]!.speaker,
			prompt: startSessionCalls[0]!.prompt,
			sessionId: session.sessionId
		}
	})
})
