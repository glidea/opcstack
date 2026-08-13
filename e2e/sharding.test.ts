import { beforeAll, describe } from 'vitest'
import { runCases, type TestCase } from '../src/backend/testing/bdd'
import { createLocalTestUser, getAdminSessionCookie } from './support/auth'

type E2EEnv = {
	APP_BASE_URL?: string
	E2E_REMOTE?: string
	E2E_D1_SHARD_COUNT?: string
	E2E_RUN_DAILY_CHECKIN_FLOW?: string
}

type AuthToken = {
	token: string
	userId: string
}

type CreditSummaryResponse = {
	balance: string
	daily_checked_in: boolean
	daily_checkin_amount: string
}

type DailyCheckinResponse = {
	balance: string
	checked_in: boolean
	amount: string
}

type GenerateCreditCodesResponse = {
	codes: Array<{
		id: string
		code: string
		amount: string
	}>
}

type ListCreditCodesResponse = {
	items: Array<{
		id: string
		code: string
		status: string
		claimed_by: string | null
		granted_at: number | null
	}>
	total: number
}

type RedeemCreditCodeResponse = {
	balance: string
	amount: string
}

type CreateNotificationResponse = {
	id: string
}

type ListNotificationsResponse = {
	items: Array<{
		id: string
		title: string
		content: string
		read: boolean
	}>
	total: number
}

const e2eEnv: E2EEnv =
	(globalThis as unknown as { process?: { env?: E2EEnv } }).process?.env ?? {}
const appBaseUrl: string = e2eEnv.APP_BASE_URL ?? 'http://localhost:5173'
const appOrigin: string = new URL(appBaseUrl).origin
const isRemote: boolean = appOrigin !== 'http://localhost:5173'
const d1ShardCount: number = Number(e2eEnv.E2E_D1_SHARD_COUNT ?? '1')
const creditsDailyCheckinEnabled: boolean =
	e2eEnv.E2E_RUN_DAILY_CHECKIN_FLOW === 'true'
let adminSessionCookie: string

describe('tenant sharding e2e', () => {
	beforeAll(async (): Promise<void> => {
		const res: Response = await fetch(`${appBaseUrl}/api/health`)
		if (res.status !== 200) {
			throw new Error('dev server is not ready for e2e tests')
		}
		if (!isRemote) {
			adminSessionCookie = await getAdminSessionCookie(appBaseUrl)
		}
	})

	type FlowGiven = Record<string, never>
	type FlowWhen = Record<string, never>
	type FlowThen = {
		shardCountVisible: boolean
		summaryStatus: number
		firstShardHeader: boolean
		firstBookmarkHeader: boolean
		secondShardMatches: boolean
		secondBookmarkHeader: boolean
		dailyStatus: number
		dailyShardMatches: boolean
		dailyCheckedIn: boolean
		redeemStatus: number
		redeemShardMatches: boolean
		redeemAmount: string
		codeStatus: string
		codeGranted: boolean
		createNotificationStatus: number
		listNotificationStatus: number
		readNotificationStatus: number
		notificationShardMatches: boolean
		notificationRead: boolean
	}

	const cases: TestCase<FlowGiven, FlowWhen, FlowThen>[] = [
		{
			scenario: 'tenant shard APIs keep user data on one shard',
			given: 'a verified user and administrator session',
			when: 'using credits redemption code and notification read APIs',
			then: 'responses carry one tenant shard and persisted tenant state',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				shardCountVisible: true,
				summaryStatus: 200,
				firstShardHeader: true,
				firstBookmarkHeader: creditsDailyCheckinEnabled,
				secondShardMatches: true,
				secondBookmarkHeader: true,
				dailyStatus: 200,
				dailyShardMatches: true,
				dailyCheckedIn: creditsDailyCheckinEnabled,
				redeemStatus: 200,
				redeemShardMatches: true,
				redeemAmount: '3.000000',
				codeStatus: 'granted',
				codeGranted: true,
				createNotificationStatus: 200,
				listNotificationStatus: 200,
				readNotificationStatus: 200,
				notificationShardMatches: true,
				notificationRead: true
			},
			timeoutMs: 45_000
		}
	]

	describe.skipIf(isRemote)('authenticated shard flow', () => {
		runCases(cases, async (): Promise<FlowThen> => {
			const runId: string = String(Date.now())
			const auth: AuthToken = await createUserAuthToken(`shard-${runId}`)

			const dailyRes: Response = await postJson(
				'/api/daily_checkin',
				{},
				{
					authorization: `Bearer ${auth.token}`
				}
			)
			const dailyPayload = (await dailyRes.json()) as DailyCheckinResponse
			const firstShard: string = dailyRes.headers.get('x-d1-tenant-shard') ?? ''
			const firstBookmark: string = dailyRes.headers.get('x-d1-tenant-bookmark') ?? ''

			const secondSummaryRes: Response = await postJson(
				'/api/get_credit_summary',
				{},
				{
					authorization: `Bearer ${auth.token}`,
					'x-d1-tenant-bookmark': firstBookmark
				}
			)
			const secondShard: string = secondSummaryRes.headers.get('x-d1-tenant-shard') ?? ''
			const secondBookmark: string = secondSummaryRes.headers.get('x-d1-tenant-bookmark') ?? ''
			const secondSummary = (await secondSummaryRes.json()) as CreditSummaryResponse

			const generateRes: Response = await postJson(
				'/api/admin/generate_credit_codes',
				{
					count: 1,
					amount: '3'
				},
				{
					cookie: adminSessionCookie
				}
			)
			const generated = (await generateRes.json()) as GenerateCreditCodesResponse
			const code: string = generated.codes[0].code
			const redeemRes: Response = await postJson(
				'/api/redeem_credit_code',
				{
					code
				},
				{
					authorization: `Bearer ${auth.token}`
				}
			)
			const redeemPayload = (await redeemRes.json()) as RedeemCreditCodeResponse
			const redeemShard: string = redeemRes.headers.get('x-d1-tenant-shard') ?? ''

			const listCodesRes: Response = await postJson(
				'/api/admin/list_credit_codes',
				{
					code
				},
				{
					cookie: adminSessionCookie
				}
			)
			const listCodesPayload = (await listCodesRes.json()) as ListCreditCodesResponse
			const redeemedCode = listCodesPayload.items.find((item) => {
				return item.code === code
			})

			const notificationTitle: string = `e2e-shard-title-${runId}`
			const notificationContent: string = `e2e-shard-content-${runId}`
			const createNotificationRes: Response = await postJson(
				'/api/admin/create_notification',
				{
					type: 'system',
					title: notificationTitle,
					content: notificationContent,
					target_user_id: auth.userId
				},
				{
					cookie: adminSessionCookie
				}
			)
			const createdNotification = (await createNotificationRes.json()) as CreateNotificationResponse
			const listNotificationRes: Response = await postJson(
				'/api/list_notifications',
				{},
				{
					authorization: `Bearer ${auth.token}`
				}
			)
			const listNotificationPayload =
				(await listNotificationRes.json()) as ListNotificationsResponse
			const listedNotification = listNotificationPayload.items.find((item) => {
				return item.id === createdNotification.id
			})

			const readNotificationRes: Response = await postJson(
				'/api/read_notification',
				{
					id: createdNotification.id
				},
				{
					authorization: `Bearer ${auth.token}`
				}
			)
			const notificationShard: string =
				readNotificationRes.headers.get('x-d1-tenant-shard') ?? ''
			const secondListNotificationRes: Response = await postJson(
				'/api/list_notifications',
				{
					read: true
				},
				{
					authorization: `Bearer ${auth.token}`
				}
			)
			const secondListNotificationPayload =
				(await secondListNotificationRes.json()) as ListNotificationsResponse
			const readNotification = secondListNotificationPayload.items.find((item) => {
				return item.id === createdNotification.id
			})

			return {
				shardCountVisible: d1ShardCount >= 1,
				summaryStatus: secondSummaryRes.status,
				firstShardHeader: firstShard !== '',
				firstBookmarkHeader: firstBookmark !== '',
				secondShardMatches: secondShard === firstShard,
				secondBookmarkHeader: secondBookmark !== '',
				dailyStatus: dailyRes.status,
				dailyShardMatches: secondShard === firstShard,
				dailyCheckedIn: Boolean(dailyPayload.checked_in && secondSummary.daily_checked_in),
				redeemStatus: redeemRes.status,
				redeemShardMatches: redeemShard === firstShard,
				redeemAmount: redeemPayload.amount,
				codeStatus: redeemedCode?.status ?? '',
				codeGranted: redeemedCode?.granted_at !== null,
				createNotificationStatus: createNotificationRes.status,
				listNotificationStatus: listNotificationRes.status,
				readNotificationStatus: readNotificationRes.status,
				notificationShardMatches:
					listedNotification?.read === false && notificationShard === firstShard,
				notificationRead: readNotification?.read ?? false
			}
		})
	})
})

async function createUserAuthToken(tag: string): Promise<AuthToken> {
	return createLocalTestUser({ appBaseUrl, tag })
}

function buildHeaders(extra?: Record<string, string>): Headers {
	const headers: Headers = new Headers({
		'content-type': 'application/json',
		'x-captcha-response': 'XXXX.DUMMY.TOKEN.XXXX',
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
