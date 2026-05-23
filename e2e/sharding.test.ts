import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { beforeAll, describe } from 'vitest'
import { Resend } from 'resend'
import { runCases, type TestCase } from '../src/testing/bdd'

type E2EEnv = {
	APP_BASE_URL?: string
	E2E_REMOTE?: string
	E2E_ADMIN_SECRET?: string
	E2E_D1_SHARD_COUNT?: string
	E2E_EMAIL_ENABLED?: string
	E2E_EMAIL_SIGNUP_ENABLED?: string
	E2E_EMAIL_REQUIRE_VERIFICATION?: string
	E2E_EMAIL_RESEND_API_KEY?: string
	E2E_EMAIL_FROM?: string
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
const isRemote: boolean = e2eEnv.E2E_REMOTE === '1'
const adminSecret: string = e2eEnv.E2E_ADMIN_SECRET ?? ''
const d1ShardCount: number = Number(e2eEnv.E2E_D1_SHARD_COUNT ?? '1')
const emailEnabled: boolean = e2eEnv.E2E_EMAIL_ENABLED === 'true'
const emailSignupEnabled: boolean = e2eEnv.E2E_EMAIL_SIGNUP_ENABLED === 'true'
const emailRequireVerification: boolean = e2eEnv.E2E_EMAIL_REQUIRE_VERIFICATION === 'true'
const emailResendApiKey: string = e2eEnv.E2E_EMAIL_RESEND_API_KEY ?? ''
const emailFrom: string = e2eEnv.E2E_EMAIL_FROM ?? ''

describe('tenant sharding e2e', () => {
	beforeAll(async (): Promise<void> => {
		const res: Response = await fetch(`${appBaseUrl}/api/health`)
		if (res.status !== 200) {
			throw new Error('dev server is not ready for e2e tests')
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
			given: 'a verified user and admin secret',
			when: 'using credits redemption code and notification read APIs',
			then: 'responses carry one tenant shard and persisted tenant state',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				shardCountVisible: true,
				summaryStatus: 200,
				firstShardHeader: true,
				firstBookmarkHeader: true,
				secondShardMatches: true,
				secondBookmarkHeader: true,
				dailyStatus: 200,
				dailyShardMatches: true,
				dailyCheckedIn: true,
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

	describe('authenticated shard flow', () => {
		runCases(cases, async (): Promise<FlowThen> => {
			assertShardE2EConfig()
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
					authorization: `Bearer ${adminSecret}`
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
					authorization: `Bearer ${adminSecret}`
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
					authorization: `Bearer ${adminSecret}`
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
				dailyCheckedIn: dailyPayload.checked_in && secondSummary.daily_checked_in,
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

function assertShardE2EConfig(): void {
	if (adminSecret === '') {
		throw new Error('E2E_ADMIN_SECRET_REQUIRED')
	}
	if (!isRemote) {
		return
	}
	if (!emailEnabled || !emailSignupEnabled) {
		throw new Error('REMOTE_E2E_EMAIL_SIGNUP_REQUIRED')
	}
	if (emailRequireVerification && (emailResendApiKey === '' || emailFrom === '')) {
		throw new Error('REMOTE_E2E_EMAIL_OTP_READER_REQUIRED')
	}
}

async function createUserAuthToken(tag: string): Promise<AuthToken> {
	if (!isRemote) {
		return createLocalUserSession(tag)
	}

	const email: string = buildScenarioEmail(tag)
	const password: string = 'Password123'
	const signupStartedAt: number = Date.now() - 1000
	const signupRes: Response = await postJson('/api/auth/sign-up/email', {
		name: 'e2e-user',
		email,
		password
	})
	if (!signupRes.ok) {
		throw new Error(`failed to sign up test user: ${signupRes.status}`)
	}

	if (emailRequireVerification) {
		const otp: string = await readEmailOtp(email, 'Verify your email', signupStartedAt)
		const verifyRes: Response = await postJson('/api/auth/email-otp/verify-email', {
			email,
			otp
		})
		if (!verifyRes.ok) {
			throw new Error(`failed to verify test user: ${verifyRes.status}`)
		}
	}

	const signInRes: Response = await postJson('/api/auth/sign-in/email', {
		email,
		password
	})
	const payload = (await signInRes.json()) as { token?: string; user?: { id?: string } }
	if (!signInRes.ok || !payload.token || !payload.user?.id) {
		throw new Error(`failed to sign in test user: ${signInRes.status}`)
	}
	return {
		token: payload.token,
		userId: payload.user.id
	}
}

function createLocalUserSession(tag: string): AuthToken {
	const now: number = Date.now()
	const userId: string = `u_${tag}_${now}`.replace(/[^a-zA-Z0-9_]/g, '_')
	const sessionId: string = `s_${tag}_${now}`.replace(/[^a-zA-Z0-9_]/g, '_')
	const token: string = `t_${tag}_${now}`.replace(/[^a-zA-Z0-9_]/g, '_')
	const email: string = `${userId}@example.com`
	const expiresAt: number = now + 30 * 24 * 60 * 60 * 1000
	const sql: string = [
		'PRAGMA busy_timeout=5000;',
		`INSERT INTO user (id, name, email, aff_code, email_verified, image, created_at, updated_at) VALUES ('${userId}', 'e2e-user', '${email}', NULL, 1, NULL, ${now}, ${now});`,
		`INSERT INTO session (id, expires_at, token, created_at, updated_at, ip_address, user_agent, user_id) VALUES ('${sessionId}', ${expiresAt}, '${token}', ${now}, ${now}, NULL, 'e2e', '${userId}');`
	].join(' ')
	execFileSync('sqlite3', [readLocalD1SqlitePath(), sql], {
		stdio: 'ignore'
	})
	return {
		token,
		userId
	}
}

async function readEmailOtp(
	email: string,
	subject: string,
	startedAt: number
): Promise<string> {
	const resend: Resend = new Resend(emailResendApiKey)
	let attempt: number = 0
	while (attempt < 30) {
		const otp: string = await findEmailOtp(resend, email, subject, startedAt)
		if (otp !== '') {
			return otp
		}
		await sleep(1000)
		attempt += 1
	}
	throw new Error(`failed to read email otp: ${email} ${subject}`)
}

async function findEmailOtp(
	resend: Resend,
	email: string,
	subject: string,
	startedAt: number
): Promise<string> {
	const listRes = await resend.emails.list({ limit: 100 })
	const lowerEmail: string = email.toLowerCase()
	const item = listRes.data?.data.find((candidate): boolean => {
		const createdAt: number = Date.parse(candidate.created_at)
		if (!Number.isFinite(createdAt) || createdAt < startedAt) {
			return false
		}
		if (!candidate.subject.includes(subject)) {
			return false
		}
		return candidate.to.some((to: string): boolean => {
			return to.toLowerCase() === lowerEmail
		})
	})
	if (!item) {
		return ''
	}

	const detailRes = await resend.emails.get(item.id)
	const body: string = detailRes.data?.html ?? detailRes.data?.text ?? ''
	const htmlMatch: RegExpMatchArray | null = body.match(/>(\d{6})<\/div>/)
	if (htmlMatch?.[1]) {
		return htmlMatch[1]
	}
	const textMatch: RegExpMatchArray | null = body.match(/\b\d{6}\b/)
	return textMatch?.[0] ?? ''
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve: () => void): void => {
		setTimeout(resolve, ms)
	})
}

function readLocalD1SqlitePath(): string {
	const dir: string = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'
	const files: string[] = readdirSync(dir).filter((file: string): boolean => {
		return file.endsWith('.sqlite') && file !== 'metadata.sqlite'
	})
	for (const file of files) {
		const path: string = `${dir}/${file}`
		const output: string = execFileSync(
			'sqlite3',
			[path, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user';"],
			{ encoding: 'utf-8' }
		)
		if (output.trim() === 'user') {
			return path
		}
	}
	throw new Error('LOCAL_META_D1_SQLITE_NOT_FOUND')
}

function buildScenarioEmail(tag: string): string {
	const domain: string = extractEmailDomain(emailFrom) || 'example.com'
	const cleanTag: string = tag.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
	return `e2e-${cleanTag}@${domain}`
}

function extractEmailDomain(value: string): string {
	const email: string = extractEmailAddress(value)
	const at: number = email.lastIndexOf('@')
	if (at < 0) {
		return ''
	}
	return email.slice(at + 1)
}

function extractEmailAddress(value: string): string {
	const match: RegExpMatchArray | null = value.match(/<([^>]+)>/)
	if (match?.[1]) {
		return match[1].trim()
	}
	return value.trim()
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
