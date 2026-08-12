import { describe } from 'vitest'
import { runCases, type TestCase } from '../../../testing/bdd'
import {
	createDoubaoRealtimeSocketRequest,
	encodeDoubaoRealtimeAudioRequestFrame,
	encodeDoubaoRealtimeInterruptFrame,
	encodeDoubaoRealtimeTextQueryFrame,
	toDoubaoRealtimeStartSessionPayload
} from './index'
import {
	DOUBAO_REALTIME_MODEL_O2,
	DOUBAO_REALTIME_MODEL_SC2,
	DOUBAO_REALTIME_SPEAKER_SATURN_ZH_FEMALE_AOJIAONVYOU_TOB,
	DOUBAO_REALTIME_SPEAKER_ZH_FEMALE_VV_JUPITER_BIGTTS
} from './constants'
import {
	decodeDoubaoRealtimeFrame,
	type DoubaoRealtimeFrame
} from './frame'

describe('doubao realtime request mapping', () => {
	type GivenDetail = {
		baseUrl: string
		model: typeof DOUBAO_REALTIME_MODEL_O2 | typeof DOUBAO_REALTIME_MODEL_SC2
		speaker:
			| typeof DOUBAO_REALTIME_SPEAKER_ZH_FEMALE_VV_JUPITER_BIGTTS
			| typeof DOUBAO_REALTIME_SPEAKER_SATURN_ZH_FEMALE_AOJIAONVYOU_TOB
		prompt?: string
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		url: string
		apiKey: string
		resourceId: string
		appKey: string
		connectId: string
		model: string
		speaker: string
		context: string
		format: string
		sampleRate: number
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'o2 session maps to volc realtime dialogue',
			given: 'api key auth and article prompt',
			when: 'building socket request and start session payload',
			then: 'uses fixed resource id app key model speaker and pcm audio',
			givenDetail: {
				baseUrl: 'https://openspeech.bytedance.com/api/v3/',
				model: DOUBAO_REALTIME_MODEL_O2,
				speaker: DOUBAO_REALTIME_SPEAKER_ZH_FEMALE_VV_JUPITER_BIGTTS,
				prompt: 'article text'
			},
			whenDetail: {},
			thenExpected: {
				url: 'https://openspeech.bytedance.com/api/v3/realtime/dialogue',
				apiKey: 'api-key',
				resourceId: 'volc.speech.dialog',
				appKey: 'PlgvMymc7f3tQnJ6',
				connectId: 'connect-1',
				model: '1.2.1.1',
				speaker: 'zh_female_vv_jupiter_bigtts',
				context: 'article text',
				format: 'pcm',
				sampleRate: 16000
			}
		},
		{
			scenario: 'sc2 session maps to volc realtime dialogue',
			given: 'role model and no prompt',
			when: 'building socket request and start session payload',
			then: 'uses sc2 model and empty context',
			givenDetail: {
				baseUrl: 'https://openspeech.bytedance.com/api/v3',
				model: DOUBAO_REALTIME_MODEL_SC2,
				speaker: DOUBAO_REALTIME_SPEAKER_SATURN_ZH_FEMALE_AOJIAONVYOU_TOB
			},
			whenDetail: {},
			thenExpected: {
				url: 'https://openspeech.bytedance.com/api/v3/realtime/dialogue',
				apiKey: 'api-key',
				resourceId: 'volc.speech.dialog',
				appKey: 'PlgvMymc7f3tQnJ6',
				connectId: 'connect-1',
				model: '2.2.0.0',
				speaker: 'saturn_zh_female_aojiaonvyou_tob',
				context: '',
				format: 'pcm',
				sampleRate: 16000
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		const request: Request = createDoubaoRealtimeSocketRequest(
			{ baseURL: given.baseUrl, apiKey: 'api-key' },
			'connect-1'
		)
		const payload = toDoubaoRealtimeStartSessionPayload({
			sessionId: 'session-1',
			userId: 'u1',
			model: given.model,
			speaker: given.speaker,
			prompt: given.prompt
		})

		return {
			url: request.url,
			apiKey: request.headers.get('X-Api-Key') ?? '',
			resourceId: request.headers.get('X-Api-Resource-Id') ?? '',
			appKey: request.headers.get('X-Api-App-Key') ?? '',
			connectId: request.headers.get('X-Api-Connect-Id') ?? '',
			model: payload.model,
			speaker: payload.tts.speaker,
			context: payload.dialog.context ?? '',
			format: payload.tts.audio_config.format,
			sampleRate: payload.tts.audio_config.sample_rate
		}
	})
})

describe('doubao realtime input frame mapping', () => {
	type GivenDetail = {
		sessionId: string
		text: string
		audio: number[]
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		audioEvent: number
		textEvent: number
		interruptEvent: number
		sessionId: string
		audio: number[]
		text: string
		interruptPayload: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'client input maps to volc realtime events',
			given: 'one session with binary audio and text',
			when: 'encoding input frames',
			then: 'uses task request text query and client interrupt events',
			givenDetail: {
				sessionId: 'session-1',
				text: 'hello',
				audio: [1, 2, 3]
			},
			whenDetail: {},
			thenExpected: {
				audioEvent: 200,
				textEvent: 501,
				interruptEvent: 515,
				sessionId: 'session-1',
				audio: [1, 2, 3],
				text: 'hello',
				interruptPayload: '{}'
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		const audioFrame: DoubaoRealtimeFrame = decodeDoubaoRealtimeFrame(
			encodeDoubaoRealtimeAudioRequestFrame(given.sessionId, new Uint8Array(given.audio))
		)
		const textFrame: DoubaoRealtimeFrame = decodeDoubaoRealtimeFrame(
			encodeDoubaoRealtimeTextQueryFrame(given.sessionId, given.text)
		)
		const interruptFrame: DoubaoRealtimeFrame = decodeDoubaoRealtimeFrame(
			encodeDoubaoRealtimeInterruptFrame(given.sessionId)
		)
		const textPayload: { text: string } = JSON.parse(new TextDecoder().decode(textFrame.payload)) as {
			text: string
		}

		return {
			audioEvent: audioFrame.event,
			textEvent: textFrame.event,
			interruptEvent: interruptFrame.event,
			sessionId: audioFrame.sessionId,
			audio: Array.from(audioFrame.payload),
			text: textPayload.text,
			interruptPayload: new TextDecoder().decode(interruptFrame.payload)
		}
	})
})
