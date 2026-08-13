import { beforeAll, describe } from 'vitest'
import { runCases, type TestCase } from '../src/backend/testing/bdd'
import {
	createLocalTestUser,
	getAdminSessionCookie,
	type LocalTestUser
} from './support/auth'

type E2EEnv = {
	APP_BASE_URL?: string
}

const e2eEnv =
	(globalThis as unknown as { process?: { env?: E2EEnv } }).process?.env ?? {}
const appBaseUrl: string = e2eEnv.APP_BASE_URL ?? 'http://localhost:5173'
const appOrigin: string = new URL(appBaseUrl).origin
const isRemote: boolean = appOrigin !== 'http://localhost:5173'
const canCreateUser: boolean = !isRemote
let adminSessionCookie: string

describe('feedback api e2e', () => {
	beforeAll(async () => {
		const res = await fetch(`${appBaseUrl}/api/health`)
		if (res.status !== 200) {
			throw new Error('dev server is not ready for e2e tests')
		}
		if (canCreateUser) {
			adminSessionCookie = await getAdminSessionCookie(appBaseUrl)
		}
	})

	type PublicGiven = Record<string, never>
	type PublicWhen = {
		action: 'submit_without_auth' | 'list_without_admin'
	}
	type PublicThen = {
		status: number
		code: string
	}

	const publicCases: TestCase<PublicGiven, PublicWhen, PublicThen>[] = [
		{
			scenario: 'submit feedback requires auth',
			given: 'no bearer token',
			when: 'submitting feedback',
			then: 'returns unauthorized',
			givenDetail: {},
			whenDetail: {
				action: 'submit_without_auth'
			},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED'
			}
		},
		{
			scenario: 'list feedbacks requires administrator authorization',
			given: 'no admin authorization header',
			when: 'listing feedbacks',
			then: 'returns unauthorized',
			givenDetail: {},
			whenDetail: {
				action: 'list_without_admin'
			},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED'
			}
		}
	]

	runCases(publicCases, async (_given, when) => {
		if (when.action === 'submit_without_auth') {
			const res = await postJson('/api/submit_feedback', {
				type: 'e2e-feedback',
				content: 'no auth'
			})
			const payload = (await res.json()) as { code: string }
			return {
				status: res.status,
				code: payload.code
			}
		}

		const res = await postJson('/api/admin/list_feedbacks', {})
		const payload = (await res.json()) as { code: string }
		return {
			status: res.status,
			code: payload.code
		}
	})

	describe.skipIf(!canCreateUser)('feedback authenticated flow', () => {
		type FlowGiven = Record<string, never>
		type FlowWhen = Record<string, never>
		type FlowThen = {
			submitStatus: number
			tenantShardHeader: boolean
			adminListStatus: number
			adminListTotal: number
			adminListFound: boolean
		}

		const flowCases: TestCase<FlowGiven, FlowWhen, FlowThen>[] = [
			{
				scenario: 'user submits feedback to tenant shard',
				given: 'a signed in user and administrator session',
				when: 'submitting feedback and listing globally',
				then: 'submit succeeds and admin can list the feedback',
				givenDetail: {},
				whenDetail: {},
				thenExpected: {
					submitStatus: 200,
					tenantShardHeader: true,
					adminListStatus: 200,
					adminListTotal: 1,
					adminListFound: true
				}
			}
		]

		runCases(flowCases, async () => {
			const runId = String(Date.now())
			const token = await createUserToken(`feedback-${runId}`)
			const feedbackType = `e2e-feedback-${runId}`
			const content = `feedback-content-${runId}`
			const submitRes = await postJson(
				'/api/submit_feedback',
				{
					type: feedbackType,
					content
				},
				{
					authorization: `Bearer ${token}`
				}
			)

			const listRes = await postJson(
				'/api/admin/list_feedbacks',
				{
					type: feedbackType
				},
				{
					cookie: adminSessionCookie
				}
			)
			const listPayload = (await listRes.json()) as {
				items: Array<{ type: string; content: string }>
				total: number
			}

			return {
				submitStatus: submitRes.status,
				tenantShardHeader: Boolean(submitRes.headers.get('x-d1-tenant-shard')),
				adminListStatus: listRes.status,
				adminListTotal: listPayload.total,
				adminListFound: listPayload.items.some((item: { type: string; content: string }): boolean => {
					return item.type === feedbackType && item.content === content
				})
			}
		})
	})
})

async function createUserToken(tag: string): Promise<string> {
	const user: LocalTestUser = await createLocalTestUser({ appBaseUrl, tag })
	return user.token
}

function buildHeaders(extra?: Record<string, string>): Headers {
	const headers = new Headers({
		'content-type': 'application/json',
		origin: appOrigin,
		referer: `${appOrigin}/`
	})
	if (!extra) {
		return headers
	}
	for (const [key, value] of Object.entries(extra)) {
		headers.set(key, value)
	}
	return headers
}

function postJson(
	path: string,
	body: unknown,
	headers?: Record<string, string>
): Promise<Response> {
	return fetch(`${appBaseUrl}${path}`, {
		method: 'POST',
		headers: buildHeaders(headers),
		body: JSON.stringify(body)
	})
}
