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

interface NotificationListResponse {
	items: Array<{
		id: string
		type: string
		title: string
		content: string
		read: boolean
		created_at: number
	}>
}

const e2eEnv =
	(globalThis as unknown as { process?: { env?: E2EEnv } }).process?.env ?? {}
const appBaseUrl: string = e2eEnv.APP_BASE_URL ?? 'http://localhost:5173'
const appOrigin: string = new URL(appBaseUrl).origin
const isRemote: boolean = appOrigin !== 'http://localhost:5173'
const canCreateUser: boolean = !isRemote
let adminSessionCookie: string

describe('notification api e2e', () => {
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
		action: 'create_without_admin' | 'list_without_auth' | 'read_without_auth'
	}
	type PublicThen = {
		status: number
		code: string
	}

	const publicCases: TestCase<PublicGiven, PublicWhen, PublicThen>[] = [
		{
			scenario: 'create notification requires admin api token',
			given: 'no admin authorization header',
			when: 'creating notification',
			then: 'returns unauthorized',
			givenDetail: {},
			whenDetail: {
				action: 'create_without_admin'
			},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED'
			}
		},
		{
			scenario: 'list notifications requires auth',
			given: 'no bearer token',
			when: 'listing notifications',
			then: 'returns unauthorized',
			givenDetail: {},
			whenDetail: {
				action: 'list_without_auth'
			},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED'
			}
		},
		{
			scenario: 'read notification requires auth',
			given: 'no bearer token',
			when: 'marking notification read',
			then: 'returns unauthorized',
			givenDetail: {},
			whenDetail: {
				action: 'read_without_auth'
			},
			thenExpected: {
				status: 401,
				code: 'UNAUTHORIZED'
			}
		}
	]

	runCases(publicCases, async (_given, when) => {
		if (when.action === 'create_without_admin') {
			const res = await postJson('/api/admin/create_notification', {
				title: 'no auth',
				content: 'no auth'
			})
			const payload = (await res.json()) as { code: string }
			return {
				status: res.status,
				code: payload.code
			}
		}

		if (when.action === 'list_without_auth') {
			const res = await postJson('/api/list_notifications', {})
			const payload = (await res.json()) as { code: string }
			return {
				status: res.status,
				code: payload.code
			}
		}

		const res = await postJson('/api/read_notification', { id: 'n1' })
		const payload = (await res.json()) as { code: string }
		return {
			status: res.status,
			code: payload.code
		}
	})

	describe.skipIf(!canCreateUser)('notification authenticated flow', () => {
		type FlowGiven = Record<string, never>
		type FlowWhen = Record<string, never>
		type FlowThen = {
			createStatus: number
			firstListStatus: number
			firstListTenantShardHeader: boolean
			firstListContainsNotification: boolean
			firstReadState: boolean
			readStatus: number
			readTenantShardHeader: boolean
			secondReadState: boolean
		}

		const flowCases: TestCase<FlowGiven, FlowWhen, FlowThen>[] = [
			{
				scenario: 'admin creates global notification and user can read it',
				given: 'admin api token and a signed in user',
				when: 'creating listing and reading a notification',
				then: 'notification read state changes from false to true',
				givenDetail: {},
				whenDetail: {},
				thenExpected: {
					createStatus: 200,
					firstListStatus: 200,
					firstListTenantShardHeader: true,
					firstListContainsNotification: true,
					firstReadState: false,
					readStatus: 200,
					readTenantShardHeader: true,
					secondReadState: true
				}
			}
		]

		runCases(flowCases, async () => {
			const runId = String(Date.now())
			const token = await createUserToken(`notification-${runId}`)
			const title = `e2e-title-${runId}`
			const content = `e2e-content-${runId}`
			const createRes = await postJson(
				'/api/admin/create_notification',
				{
					type: 'system',
					title,
					content
				},
				{
					cookie: adminSessionCookie
				}
			)

			const firstListRes = await postJson(
				'/api/list_notifications',
				{},
				{
					authorization: `Bearer ${token}`
				}
			)
			const firstListPayload = (await firstListRes.json()) as NotificationListResponse
			const firstNotification = firstListPayload.items.find((item) => {
				return item.title === title && item.content === content
			})
			if (!firstNotification) {
				return {
					createStatus: createRes.status,
					firstListStatus: firstListRes.status,
					firstListTenantShardHeader: Boolean(firstListRes.headers.get('x-d1-tenant-shard')),
					firstListContainsNotification: false,
					firstReadState: true,
					readStatus: 0,
					readTenantShardHeader: false,
					secondReadState: false
				}
			}

			const readRes = await postJson(
				'/api/read_notification',
				{
					id: firstNotification.id
				},
				{
					authorization: `Bearer ${token}`
				}
			)

			const secondListRes = await postJson(
				'/api/list_notifications',
				{},
				{
					authorization: `Bearer ${token}`
				}
			)
			const secondListPayload = (await secondListRes.json()) as NotificationListResponse
			const secondNotification = secondListPayload.items.find((item) => {
				return item.id === firstNotification.id
			})

			return {
				createStatus: createRes.status,
				firstListStatus: firstListRes.status,
				firstListTenantShardHeader: Boolean(firstListRes.headers.get('x-d1-tenant-shard')),
				firstListContainsNotification: true,
				firstReadState: firstNotification.read,
				readStatus: readRes.status,
				readTenantShardHeader: Boolean(readRes.headers.get('x-d1-tenant-shard')),
				secondReadState: secondNotification?.read ?? false
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
