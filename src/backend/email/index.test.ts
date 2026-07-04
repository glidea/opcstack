import { describe } from 'vitest'
import { runCases, type TestCase } from '../testing/bdd'
import { createEmailClients } from './index'

describe('createEmailClients', () => {
	type GivenDetail = {
		provider: 'resend' | 'cloudflare' | 'unknown'
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		error: string
		hasSimpleClient: boolean
		hasResendClient: boolean
		hasCloudflareClient: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'select resend provider',
			given: 'email provider is resend',
			when: 'creating email clients',
			then: 'returns simple email client',
			givenDetail: {
				provider: 'resend'
			},
			whenDetail: {},
			thenExpected: {
				error: '',
				hasSimpleClient: true,
				hasResendClient: true,
				hasCloudflareClient: false
			}
		},
		{
			scenario: 'select cloudflare provider',
			given: 'email provider is cloudflare',
			when: 'creating email clients',
			then: 'returns simple email client',
			givenDetail: {
				provider: 'cloudflare'
			},
			whenDetail: {},
			thenExpected: {
				error: '',
				hasSimpleClient: true,
				hasResendClient: false,
				hasCloudflareClient: true
			}
		},
		{
			scenario: 'reject unknown provider',
			given: 'email provider is unknown',
			when: 'creating email clients',
			then: 'throws unsupported email provider',
			givenDetail: {
				provider: 'unknown'
			},
			whenDetail: {},
			thenExpected: {
				error: 'UNSUPPORTED_EMAIL_PROVIDER: unknown',
				hasSimpleClient: false,
				hasResendClient: false,
				hasCloudflareClient: false
			}
		}
	]

	runCases(cases, (given) => {
		try {
			const clients = createEmailClients({
				APP_NAME: 'opcstack',
				EMAIL_PROVIDER: given.provider,
				EMAIL_RESEND_API_KEY: 'rk-test',
				SYSTEM_EMAIL: 'noreply@example.com',
				SEND_EMAIL: {
					send: async (_message: unknown): Promise<void> => {
						return
					}
				}
			} as unknown as Env)
			return {
				error: '',
				hasSimpleClient: typeof clients.simple.send === 'function',
				hasResendClient: Boolean(clients.resend),
				hasCloudflareClient: Boolean(clients.cloudflare)
			}
		} catch (error) {
			return {
				error: error instanceof Error ? error.message : '',
				hasSimpleClient: false,
				hasResendClient: false,
				hasCloudflareClient: false
			}
		}
	})
})
