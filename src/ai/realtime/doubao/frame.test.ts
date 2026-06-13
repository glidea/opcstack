import { describe } from 'vitest'
import { runCases, type TestCase } from '../../../testing/bdd'
import {
	decodeDoubaoRealtimeFrame,
	encodeDoubaoRealtimeConnectionFrame,
	encodeDoubaoRealtimeSessionFrame
} from './frame'

describe('doubao realtime websocket frame', () => {
	type GivenDetail = Record<string, never>
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		connectionEvent: number
		connectionPayload: string
		sessionEvent: number
		sessionId: string
		sessionPayload: string
		decodedEvent: number
		decodedSessionId: string
		decodedPayload: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'encode and decode websocket v3 frame',
			given: 'connection frame and session frame',
			when: 'reading binary fields',
			then: 'preserves event id session id and payload',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				connectionEvent: 1,
				connectionPayload: '{}',
				sessionEvent: 100,
				sessionId: 'session-1',
				sessionPayload: '{"speaker":"zh_female_vv_jupiter_bigtts"}',
				decodedEvent: 150,
				decodedSessionId: 'session-1',
				decodedPayload: '{"dialog_id":"dialog-1"}'
			}
		}
	]

	runCases(cases, async (): Promise<ThenExpected> => {
		const connectionFrame: Uint8Array = encodeDoubaoRealtimeConnectionFrame(
			1,
			new TextEncoder().encode('{}')
		)
		const sessionFrame: Uint8Array = encodeDoubaoRealtimeSessionFrame(
			100,
			'session-1',
			new TextEncoder().encode('{"speaker":"zh_female_vv_jupiter_bigtts"}')
		)
		const responseFrame: Uint8Array = encodeDoubaoRealtimeSessionFrame(
			150,
			'session-1',
			new TextEncoder().encode('{"dialog_id":"dialog-1"}')
		)
		const decoded = decodeDoubaoRealtimeFrame(responseFrame)

		return {
			connectionEvent: new DataView(connectionFrame.buffer).getInt32(4),
			connectionPayload: new TextDecoder().decode(connectionFrame.slice(12)),
			sessionEvent: new DataView(sessionFrame.buffer).getInt32(4),
			sessionId: new TextDecoder().decode(sessionFrame.slice(12, 21)),
			sessionPayload: new TextDecoder().decode(sessionFrame.slice(25)),
			decodedEvent: decoded.event,
			decodedSessionId: decoded.sessionId,
			decodedPayload: new TextDecoder().decode(decoded.payload)
		}
	})
})
