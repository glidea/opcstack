import { beforeEach, describe, vi } from 'vitest'
import { runCases, type TestCase } from '../../testing/bdd'
import { createResendNativeEmailClient, createResendSimpleEmailClient } from './index'

const { resendConstructorMock, resendSendMock } = vi.hoisted(() => {
	return {
		resendConstructorMock: vi.fn(),
		resendSendMock: vi.fn()
	}
})

vi.mock('resend', () => {
	class MockResend {
		emails: {
			send: typeof resendSendMock
		}

		constructor(apiKey: string) {
			resendConstructorMock(apiKey)
			this.emails = {
				send: resendSendMock
			}
		}
	}

	return {
		Resend: MockResend
	}
})

describe('createResendNativeEmailClient', () => {
type GivenDetail = {
	apiKey: string
}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		constructorApiKey: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'constructs official resend sdk client',
			given: 'email resend api key is configured',
			when: 'creating native resend client',
			then: 'passes api key to official sdk constructor',
			givenDetail: {
				apiKey: 'rk-native'
			},
			whenDetail: {},
			thenExpected: {
				constructorApiKey: 'rk-native'
			}
		}
	]

	runCases(cases, (given, when) => {
		void when
		resendConstructorMock.mockReset()
		resendSendMock.mockReset()
		createResendNativeEmailClient({
			APP_NAME: 'opcstack',
			EMAIL_RESEND_API_KEY: given.apiKey,
			EMAIL_FROM: 'openstack@glidea.app'
		} as unknown as Env)
		return {
			constructorApiKey: String(resendConstructorMock.mock.calls[0]?.[0] ?? '')
		}
	})
})

describe('createResendSimpleEmailClient.send', () => {
	beforeEach(() => {
		vi.restoreAllMocks()
		vi.spyOn(console, 'error').mockImplementation((): void => {
			return
		})
	})

	type GivenDetail = {
		appName: string
		emailFrom: string
		statusCode: number
		sendThrows: boolean
	}
	type WhenDetail = {
		to: string
		subject: string
		html: string
	}
	type ThenExpected = {
		error: string
		sendCallCount: number
		from: string
		to: string
		subject: string
		html: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'send success',
			given: 'simple client and resend sdk success response',
			when: 'sending one email',
			then: 'forwards from to subject html to resend sdk',
			givenDetail: {
				appName: 'opcstack',
				emailFrom: 'openstack@glidea.app',
				statusCode: 200,
				sendThrows: false
			},
			whenDetail: {
				to: 'u1@example.com',
				subject: 'Verify your email',
				html: '<a href="https://app/verify">https://app/verify</a>'
			},
			thenExpected: {
				error: '',
				sendCallCount: 1,
				from: 'openstack@glidea.app',
				to: 'u1@example.com',
				subject: 'opcstack: Verify your email',
				html: '<a href="https://app/verify">https://app/verify</a>'
			}
		},
		{
			scenario: 'send failure',
			given: 'simple client and resend sdk business error response',
			when: 'sending one email',
			then: 'throws email send failed with status code',
			givenDetail: {
				appName: 'opcstack',
				emailFrom: 'openstack@glidea.app',
				statusCode: 429,
				sendThrows: false
			},
			whenDetail: {
				to: 'u2@example.com',
				subject: 'Reset your password',
				html: '<a href="https://app/reset">https://app/reset</a>'
			},
			thenExpected: {
				error: 'EMAIL_SEND_FAILED:429',
				sendCallCount: 1,
				from: 'openstack@glidea.app',
				to: 'u2@example.com',
				subject: 'opcstack: Reset your password',
				html: '<a href="https://app/reset">https://app/reset</a>'
			}
		},
		{
			scenario: 'send exception',
			given: 'simple client and resend sdk transport exception',
			when: 'sending one email',
			then: 'propagates original sdk error',
			givenDetail: {
				appName: 'opcstack',
				emailFrom: 'openstack@glidea.app',
				statusCode: 200,
				sendThrows: true
			},
			whenDetail: {
				to: 'u3@example.com',
				subject: 'Verify your email',
				html: '<a href="https://app/verify">https://app/verify</a>'
			},
			thenExpected: {
				error: 'network down',
				sendCallCount: 1,
				from: 'openstack@glidea.app',
				to: 'u3@example.com',
				subject: 'opcstack: Verify your email',
				html: '<a href="https://app/verify">https://app/verify</a>'
			}
		}
	]

	runCases(cases, async (given, when) => {
		resendConstructorMock.mockReset()
		resendSendMock.mockReset()

		if (given.sendThrows) {
			resendSendMock.mockRejectedValue(new Error('network down'))
		} else if (given.statusCode >= 400) {
			resendSendMock.mockResolvedValue({
				data: null,
				error: {
					message: 'resend failed',
					statusCode: given.statusCode
				}
			})
		} else {
			resendSendMock.mockResolvedValue({
				data: {
					id: 'e1'
				},
				error: null
			})
		}

		const simpleClient = createResendSimpleEmailClient(
			{
				APP_NAME: given.appName,
				EMAIL_RESEND_API_KEY: 'rk-simple',
				EMAIL_FROM: given.emailFrom
			} as unknown as Env,
			createResendNativeEmailClient({
				APP_NAME: given.appName,
				EMAIL_RESEND_API_KEY: 'rk-simple',
				EMAIL_FROM: given.emailFrom
			} as unknown as Env)
		)

		let error = ''
		try {
			await simpleClient.send({
				to: when.to,
				subject: when.subject,
				html: when.html
			})
		} catch (e) {
			error = e instanceof Error ? e.message : String(e)
		}

		const firstSendArg = resendSendMock.mock.calls[0]?.[0] as
			| {
					from?: string
					to?: string
					subject?: string
					html?: string
			  }
			| undefined

		return {
			error,
			sendCallCount: resendSendMock.mock.calls.length,
			from: firstSendArg?.from ?? '',
			to: firstSendArg?.to ?? '',
			subject: firstSendArg?.subject ?? '',
			html: firstSendArg?.html ?? ''
		}
	})
})
