import { describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../testing/bdd'
import {
	createCloudflareNativeEmailClient,
	createCloudflareSimpleEmailClient
} from './index'

describe('createCloudflareNativeEmailClient', () => {
	type GivenDetail = Record<string, never>
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		sameBinding: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'return worker send email binding',
			given: 'cloudflare send email binding exists on env',
			when: 'creating native cloudflare email client',
			then: 'returns the same binding',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				sameBinding: true
			}
		}
	]

	runCases(cases, () => {
		const binding = {
			send: async (_message: unknown): Promise<void> => {
				return
			}
		} as unknown as SendEmail
		const client = createCloudflareNativeEmailClient({
			SEND_EMAIL: binding
		} as unknown as Env)
		return {
			sameBinding: client === binding
		}
	})
})

describe('createCloudflareSimpleEmailClient.send', () => {
	type GivenDetail = {
		appName: string
		emailFrom: string
	}
	type WhenDetail = {
		to: string
		subject: string
		html: string
	}
	type ThenExpected = {
		sendCallCount: number
		from: string
		to: string
		subject: string
		html: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'send success',
			given: 'simple client and cloudflare email binding',
			when: 'sending one email',
			then: 'forwards from to subject html to cloudflare binding',
			givenDetail: {
				appName: 'opcstack',
				emailFrom: 'noreply@example.com'
			},
			whenDetail: {
				to: 'u1@example.com',
				subject: 'Verify your email',
				html: '<p>123456</p>'
			},
			thenExpected: {
				sendCallCount: 1,
				from: 'noreply@example.com',
				to: 'u1@example.com',
				subject: 'opcstack: Verify your email',
				html: '<p>123456</p>'
			}
		}
	]

	runCases(cases, async (given, when) => {
		const send = vi.fn(async (_message: unknown): Promise<void> => {
			return
		})
		const client = createCloudflareSimpleEmailClient({
			APP_NAME: given.appName,
			EMAIL_FROM: given.emailFrom,
			SEND_EMAIL: {
				send
			}
		} as unknown as Env)

		await client.send({
			to: when.to,
			subject: when.subject,
			html: when.html
		})

		const message = send.mock.calls[0]?.[0] as {
			from?: string
			to?: string
			subject?: string
			html?: string
		}
		return {
			sendCallCount: send.mock.calls.length,
			from: message.from ?? '',
			to: message.to ?? '',
			subject: message.subject ?? '',
			html: message.html ?? ''
		}
	})
})
