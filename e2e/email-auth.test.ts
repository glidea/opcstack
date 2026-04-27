import { beforeAll, describe } from 'vitest'
import { runCases, type TestCase } from '../src/testing/bdd'

type E2EEnv = {
	APP_BASE_URL?: string
	E2E_EMAIL_ENABLED?: string
	E2E_EMAIL_SIGNUP_ENABLED?: string
	E2E_EMAIL_SIGNUP_DOMAIN_ALLOWLIST?: string
	E2E_EMAIL_RESEND_API_KEY?: string
	E2E_EMAIL_FROM?: string
}

type ApiCodeResponse = {
	code?: string
	status?: boolean
}

const e2eEnv =
	(globalThis as unknown as { process?: { env?: E2EEnv } }).process?.env ?? {}
const appBaseUrl: string = e2eEnv.APP_BASE_URL ?? 'http://localhost:5173'
const appOrigin: string = new URL(appBaseUrl).origin
const emailEnabled: boolean = e2eEnv.E2E_EMAIL_ENABLED === 'true'
const emailSignupEnabled: boolean = e2eEnv.E2E_EMAIL_SIGNUP_ENABLED === 'true'
const signupDomainAllowlist: string = e2eEnv.E2E_EMAIL_SIGNUP_DOMAIN_ALLOWLIST ?? ''
const hasSignupDomainAllowlist: boolean = signupDomainAllowlist.trim() !== ''
const resendApiKey: string = e2eEnv.E2E_EMAIL_RESEND_API_KEY ?? ''
const emailFrom: string = e2eEnv.E2E_EMAIL_FROM ?? ''
const fromAddress: string = extractEmailAddress(emailFrom)
const fromLocalPart: string = extractLocalPart(fromAddress)
const signupDomain: string = resolveSignupDomain(signupDomainAllowlist, emailFrom)
const runId: string = `${Date.now()}`
const resendClosedLoopEnabled: boolean =
	emailEnabled && emailSignupEnabled && resendApiKey !== '' && signupDomain !== ''

describe('email auth e2e', () => {
	beforeAll(async () => {
		const res = await fetch(`${appBaseUrl}/api/health`)
		if (res.status !== 200) {
			throw new Error('dev server is not ready for e2e tests')
		}
	})

	type GivenDetail = Record<string, never>
	type WhenDetail = {
		action:
		| 'request_password_reset_once'
		| 'request_password_reset_twice'
		| 'send_verification_email_once'
		| 'send_verification_email_twice'
	}
	type ThenExpected = {
		status: number
		code: string
		ok: boolean
	}

	const resetEmail = buildScenarioEmail('reset')
	const verifyEmail = buildScenarioEmail('verify')

	const actionCases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'request password reset once',
			given: 'email feature switch state from env',
			when: 'posting request-password-reset once with a non-existing email',
			then: 'returns feature disabled or success',
			givenDetail: {},
			whenDetail: {
				action: 'request_password_reset_once'
			},
			thenExpected: {
				status: emailEnabled ? 200 : 400,
				code: emailEnabled ? '' : 'EMAIL_DISABLED',
				ok: emailEnabled
			}
		},
		{
			scenario: 'request password reset twice',
			given: 'same email in same scene within cooldown window',
			when: 'posting request-password-reset twice',
			then: 'returns rate limited on second request when email enabled',
			givenDetail: {},
			whenDetail: {
				action: 'request_password_reset_twice'
			},
			thenExpected: {
				status: emailEnabled ? 429 : 400,
				code: emailEnabled ? 'EMAIL_ACTION_RATE_LIMITED' : 'EMAIL_DISABLED',
				ok: false
			}
		},
		{
			scenario: 'send verification email once',
			given: 'email feature switch state from env',
			when: 'posting send-verification-email once with a non-existing email',
			then: 'returns feature disabled or success',
			givenDetail: {},
			whenDetail: {
				action: 'send_verification_email_once'
			},
			thenExpected: {
				status: emailEnabled ? 200 : 400,
				code: emailEnabled ? '' : 'EMAIL_DISABLED',
				ok: emailEnabled
			}
		},
		{
			scenario: 'send verification email twice',
			given: 'same email in same scene within cooldown window',
			when: 'posting send-verification-email twice',
			then: 'returns rate limited on second request when email enabled',
			givenDetail: {},
			whenDetail: {
				action: 'send_verification_email_twice'
			},
			thenExpected: {
				status: emailEnabled ? 429 : 400,
				code: emailEnabled ? 'EMAIL_ACTION_RATE_LIMITED' : 'EMAIL_DISABLED',
				ok: false
			}
		}
	]

	runCases(actionCases, async (_given, when) => {
			if (when.action === 'request_password_reset_once') {
				const res = await postJson('/api/auth/request-password-reset', {
					email: resetEmail,
					redirectTo: `${appBaseUrl}/reset-password`
				})
				const payload = await readApiCodeResponse(res)
				return {
					status: res.status,
					code: payload.code ?? '',
					ok: payload.status === true
				}
		}

		if (when.action === 'request_password_reset_twice') {
			await postJson('/api/auth/request-password-reset', {
				email: resetEmail,
				redirectTo: `${appBaseUrl}/reset-password`
			})
				const res = await postJson('/api/auth/request-password-reset', {
					email: resetEmail,
					redirectTo: `${appBaseUrl}/reset-password`
				})
				const payload = await readApiCodeResponse(res)
				return {
					status: res.status,
					code: payload.code ?? '',
					ok: payload.status === true
				}
		}

			if (when.action === 'send_verification_email_once') {
				const res = await postJson('/api/auth/send-verification-email', {
					email: verifyEmail,
					callbackURL: `${appBaseUrl}/auth/verified`
				})
				const payload = await readApiCodeResponse(res)
				return {
					status: res.status,
					code: payload.code ?? '',
					ok: payload.status === true
				}
		}

		await postJson('/api/auth/send-verification-email', {
			email: verifyEmail,
			callbackURL: `${appBaseUrl}/auth/verified`
		})
			const res = await postJson('/api/auth/send-verification-email', {
				email: verifyEmail,
				callbackURL: `${appBaseUrl}/auth/verified`
			})
			const payload = await readApiCodeResponse(res)
			return {
				status: res.status,
				code: payload.code ?? '',
				ok: payload.status === true
			}
	})

	if (!emailEnabled || !emailSignupEnabled || hasSignupDomainAllowlist) {
		type SignupGivenDetail = Record<string, never>
		type SignupWhenDetail = {
			action: 'sign_up_blocked_by_switch_or_domain'
		}
		type SignupThenExpected = {
			status: number
			code: string
		}

		const signupCases: TestCase<SignupGivenDetail, SignupWhenDetail, SignupThenExpected>[] = [
			{
				scenario: 'sign-up is blocked by switch or domain policy',
				given: 'email sign-up policy from env',
				when: 'posting sign-up with non-allowlisted domain',
				then: 'returns deterministic middleware code',
				givenDetail: {},
				whenDetail: {
						action: 'sign_up_blocked_by_switch_or_domain'
					},
					thenExpected: {
						status: !emailEnabled ? 400 : 400,
						code: !emailEnabled
							? 'EMAIL_DISABLED'
							: !emailSignupEnabled
								? 'EMAIL_SIGNUP_DISABLED'
								: 'EMAIL_DOMAIN_NOT_ALLOWED'
					}
				}
			]

			runCases(signupCases, async () => {
				const res = await postJson('/api/auth/sign-up/email', {
					name: 'e2e-user',
					email: buildScenarioEmail('signup-blocked', 'blocked-domain.example'),
					password: 'Password123',
					callbackURL: `${appBaseUrl}/auth/verified`
				})
				const payload = await readApiCodeResponse(res)
				return {
					status: res.status,
					code: payload.code ?? ''
				}
			})
	}

	if (resendClosedLoopEnabled) {
		type FlowGivenDetail = Record<string, never>
		type FlowWhenDetail = {
			action: 'signup_verify_reset_signin'
		}
		type FlowThenExpected = {
			signupOk: boolean
			signupStatus: number
			signupCode: string
			verifyEmailFound: boolean
			verifyLinkOk: boolean
			verifyStatus: number
			verifyRedirectToCallback: boolean
			resetRequestOk: boolean
			resetRequestStatus: number
			resetRequestCode: string
			resetEmailFound: boolean
			resetTokenFound: boolean
			resetSubmitOk: boolean
			resetSubmitStatus: number
			resetSubmitCode: string
			signinWithNewPasswordOk: boolean
			signinWithNewPasswordStatus: number
			signinWithNewPasswordCode: string
		}

		const flowCases: TestCase<FlowGivenDetail, FlowWhenDetail, FlowThenExpected>[] = [
			{
				scenario: 'completes resend send-side closed loop for signup verify reset and signin',
				given: 'email auth is enabled and resend key is configured',
				when: 'signing up and replaying links from resend email body',
				then: 'all key steps succeed',
				timeoutMs: 180_000,
				givenDetail: {},
				whenDetail: {
					action: 'signup_verify_reset_signin'
				},
					thenExpected: {
						signupOk: true,
						signupStatus: 200,
						signupCode: '',
						verifyEmailFound: true,
						verifyLinkOk: true,
						verifyStatus: 302,
						verifyRedirectToCallback: true,
						resetRequestOk: true,
						resetRequestStatus: 200,
						resetRequestCode: '',
						resetEmailFound: true,
						resetTokenFound: true,
						resetSubmitOk: true,
						resetSubmitStatus: 200,
						resetSubmitCode: '',
						signinWithNewPasswordOk: true,
						signinWithNewPasswordStatus: 200,
						signinWithNewPasswordCode: ''
					}
				}
			]

			runCases(flowCases, async () => {
				const email = buildScenarioEmail('flow', signupDomain)
				const oldPassword = 'Password123'
				const newPassword = 'Password456'
			const verifyCallbackURL = `${appBaseUrl}/auth/verified?runId=${runId}`
			const resetRedirectTo = `${appBaseUrl}/auth/reset?runId=${runId}`

			const verifyEmailStartMs = Date.now()
			const signupRes = await postJson('/api/auth/sign-up/email', {
				name: 'e2e-user',
				email,
				password: oldPassword,
				callbackURL: verifyCallbackURL
			})
			const signupOk = signupRes.ok
			const signupPayload = await readApiCodeResponse(signupRes)
			const signupCode = signupPayload.code ?? ''
			if (!signupOk) {
				return {
					...buildFailedFlowResult(),
					signupStatus: signupRes.status,
					signupCode
				}
			}

			const verifyEmail = await waitForResendEmail({
				apiKey: resendApiKey,
				to: email,
				subject: 'Verify your email',
				startMs: verifyEmailStartMs
			})
			const verifyEmailFound = verifyEmail.id !== ''
			const verifyURL = extractFirstURL(verifyEmail.html, verifyEmail.text)
			const verifyLinkOk = verifyURL !== ''
			const verifyRes = await fetch(verifyURL, { redirect: 'manual' })
				const verifyStatus = isRedirectStatus(verifyRes.status) ? 302 : verifyRes.status
			const verifyRedirectToCallback =
				isRedirectStatus(verifyStatus) &&
				(verifyRes.headers.get('location') ?? '').includes(`/auth/verified?runId=${runId}`)

			const resetEmailStartMs = Date.now()
			const resetReqRes = await postJson('/api/auth/request-password-reset', {
				email,
				redirectTo: resetRedirectTo
			})
			const resetRequestOk = resetReqRes.ok
			const resetReqPayload = await readApiCodeResponse(resetReqRes)
			const resetRequestCode = resetReqPayload.code ?? ''
			if (!resetRequestOk) {
				return {
					signupOk,
					signupStatus: signupRes.status,
					signupCode,
					verifyEmailFound,
					verifyLinkOk,
					verifyStatus,
					verifyRedirectToCallback,
					resetRequestOk,
					resetRequestStatus: resetReqRes.status,
					resetRequestCode,
					resetEmailFound: false,
					resetTokenFound: false,
					resetSubmitOk: false,
					resetSubmitStatus: 0,
					resetSubmitCode: '',
					signinWithNewPasswordOk: false,
					signinWithNewPasswordStatus: 0,
					signinWithNewPasswordCode: ''
				}
			}

			const resetEmail = await waitForResendEmail({
				apiKey: resendApiKey,
				to: email,
				subject: 'Reset your password',
				startMs: resetEmailStartMs
			})
			const resetEmailFound = resetEmail.id !== ''
			const resetURL = extractFirstURL(resetEmail.html, resetEmail.text)
			const resetToken = extractResetToken(resetURL)
			const resetTokenFound = resetToken !== ''
			const resetSubmitRes = await postJson('/api/auth/reset-password', {
				token: resetToken,
				newPassword
			})
			const resetSubmitOk = resetSubmitRes.ok
			const resetSubmitPayload = await readApiCodeResponse(resetSubmitRes)
			const resetSubmitCode = resetSubmitPayload.code ?? ''
			const signInRes = await postJson('/api/auth/sign-in/email', {
				email,
				password: newPassword
			})
			const signInPayload = await readApiCodeResponse(signInRes)
			const signInCode = signInPayload.code ?? ''

			return {
				signupOk,
				signupStatus: signupRes.status,
				signupCode,
				verifyEmailFound,
				verifyLinkOk,
				verifyStatus,
				verifyRedirectToCallback,
				resetRequestOk,
				resetRequestStatus: resetReqRes.status,
				resetRequestCode,
				resetEmailFound,
				resetTokenFound,
				resetSubmitOk,
				resetSubmitStatus: resetSubmitRes.status,
				resetSubmitCode,
				signinWithNewPasswordOk: signInRes.ok,
				signinWithNewPasswordStatus: signInRes.status,
				signinWithNewPasswordCode: signInCode
			}
		})
	}
})

function buildHeaders(): Headers {
	return new Headers({
		'content-type': 'application/json',
		origin: appOrigin,
		referer: `${appOrigin}/`
	})
}

async function postJson(path: string, body: unknown): Promise<Response> {
	return fetch(`${appBaseUrl}${path}`, {
		method: 'POST',
		headers: buildHeaders(),
		body: JSON.stringify(body)
	})
}

function buildFailedFlowResult(): {
	signupOk: boolean
	signupStatus: number
	signupCode: string
	verifyEmailFound: boolean
	verifyLinkOk: boolean
	verifyStatus: number
	verifyRedirectToCallback: boolean
	resetRequestOk: boolean
	resetRequestStatus: number
	resetRequestCode: string
	resetEmailFound: boolean
	resetTokenFound: boolean
	resetSubmitOk: boolean
	resetSubmitStatus: number
	resetSubmitCode: string
	signinWithNewPasswordOk: boolean
	signinWithNewPasswordStatus: number
	signinWithNewPasswordCode: string
} {
	return {
		signupOk: false,
		signupStatus: 0,
		signupCode: '',
		verifyEmailFound: false,
		verifyLinkOk: false,
		verifyStatus: 0,
		verifyRedirectToCallback: false,
		resetRequestOk: false,
		resetRequestStatus: 0,
		resetRequestCode: '',
		resetEmailFound: false,
		resetTokenFound: false,
		resetSubmitOk: false,
		resetSubmitStatus: 0,
		resetSubmitCode: '',
		signinWithNewPasswordOk: false,
		signinWithNewPasswordStatus: 0,
		signinWithNewPasswordCode: ''
	}
}

function resolveSignupDomain(allowlistRaw: string, emailFromRaw: string): string {
	const allowlist = allowlistRaw
		.split(';')
		.map((item) => item.trim().toLowerCase())
		.filter((item) => item !== '')
	if (allowlist.length > 0) {
		const firstDomain = allowlist[0]
		return firstDomain ?? ''
	}
	const fromAddress = extractEmailAddress(emailFromRaw)
	const fromDomain = extractDomain(fromAddress)
	if (fromDomain) {
		return fromDomain
	}
	return 'example.com'
}

function extractEmailAddress(value: string): string {
	const leftBracket = value.indexOf('<')
	const rightBracket = value.indexOf('>')
	if (leftBracket >= 0 && rightBracket > leftBracket) {
		return value.slice(leftBracket + 1, rightBracket).trim().toLowerCase()
	}
	return value.trim().toLowerCase()
}

function extractDomain(email: string): string {
	const at = email.lastIndexOf('@')
	if (at < 0) {
		return ''
	}
	return email.slice(at + 1)
}

function extractLocalPart(email: string): string {
	const at = email.lastIndexOf('@')
	if (at <= 0) {
		return 'e2e'
	}
	return email.slice(0, at)
}

function buildScenarioEmail(tag: string, domainOverride?: string): string {
	const targetDomain = (domainOverride ?? signupDomain).trim().toLowerCase()
	const domain = targetDomain !== '' ? targetDomain : 'example.com'
	return `${fromLocalPart}+${tag}-${runId}@${domain}`
}

type ResendEmailRecord = {
	id: string
	to: unknown
	subject: string
	createdAtMs: number
}

type ResendEmailBody = {
	id: string
	html: string
	text: string
}

type WaitForResendEmailInput = {
	apiKey: string
	to: string
	subject: string
	startMs: number
}

async function waitForResendEmail(input: WaitForResendEmailInput): Promise<ResendEmailBody> {
	let attempt = 0
	while (attempt < 20) {
		attempt += 1
		const record = await findResendEmailRecord(input)
		if (record) {
			return readResendEmailBody(input.apiKey, record.id)
		}
		await sleep(3000)
	}
	throw new Error(`failed to wait resend email for ${input.subject}`)
}

async function findResendEmailRecord(
	input: WaitForResendEmailInput
): Promise<ResendEmailRecord | undefined> {
	const response = await fetch('https://api.resend.com/emails', {
		method: 'GET',
		headers: {
			authorization: `Bearer ${input.apiKey}`
		}
	})
	if (!response.ok) {
		throw new Error(`failed to list resend emails: ${response.status}`)
	}
	const payload = (await response.json()) as unknown
	if (!payload || typeof payload !== 'object') {
		return undefined
	}
	const data = (payload as { data?: unknown }).data
	if (!Array.isArray(data)) {
		return undefined
	}

	const targetEmail = input.to.trim().toLowerCase()
	for (const item of data) {
		if (!item || typeof item !== 'object') {
			continue
		}
		const row = item as Record<string, unknown>
		const id = typeof row.id === 'string' ? row.id : ''
		const subject = typeof row.subject === 'string' ? row.subject : ''
		const createdAtMs = parseResendDate(row.created_at)
		if (id === '' || !isResendSubjectMatch(subject, input.subject)) {
			continue
		}
		if (createdAtMs < input.startMs - 60_000) {
			continue
		}
		if (!resendRecipientContains(row.to, targetEmail)) {
			continue
		}
		return {
			id,
			to: row.to,
			subject,
			createdAtMs
		}
	}

	return undefined
}

function isResendSubjectMatch(actual: string, expected: string): boolean {
	if (actual === expected) {
		return true
	}
	return actual.endsWith(`: ${expected}`)
}

function parseResendDate(value: unknown): number {
	if (typeof value === 'number') {
		return value
	}
	if (typeof value === 'string') {
		const ms = Date.parse(value)
		return Number.isNaN(ms) ? 0 : ms
	}
	return 0
}

function resendRecipientContains(value: unknown, targetEmail: string): boolean {
	if (typeof value === 'string') {
		return value.trim().toLowerCase() === targetEmail
	}

	if (!Array.isArray(value)) {
		return false
	}

	for (const item of value) {
		if (typeof item === 'string' && item.trim().toLowerCase() === targetEmail) {
			return true
		}
		if (item && typeof item === 'object') {
			const email = (item as { email?: unknown }).email
			if (typeof email === 'string' && email.trim().toLowerCase() === targetEmail) {
				return true
			}
		}
	}

	return false
}

async function readResendEmailBody(apiKey: string, id: string): Promise<ResendEmailBody> {
	const response = await fetch(`https://api.resend.com/emails/${id}`, {
		method: 'GET',
		headers: {
			authorization: `Bearer ${apiKey}`
		}
	})
	if (!response.ok) {
		throw new Error(`failed to retrieve resend email: ${response.status}`)
	}
	const payload = (await response.json()) as unknown
	if (!payload || typeof payload !== 'object') {
		throw new Error('invalid resend email payload')
	}
	const body = payload as Record<string, unknown>
	return {
		id: typeof body.id === 'string' ? body.id : '',
		html: typeof body.html === 'string' ? body.html : '',
		text: typeof body.text === 'string' ? body.text : ''
	}
}

function extractFirstURL(html: string, text: string): string {
	const source = `${html}\n${text}`.replaceAll('&amp;', '&')
	const matches = source.match(/https?:\/\/[^\s"'<>]+/g)
	if (!matches) {
		throw new Error('failed to extract url from resend email body')
	}
	const first = matches[0]
	if (!first) {
		throw new Error('failed to extract url from resend email body')
	}
	return first
}

function extractResetToken(urlString: string): string {
	try {
		const url = new URL(urlString)
		const tokenInQuery = url.searchParams.get('token')
		if (tokenInQuery) {
			return tokenInQuery
		}
		const parts = url.pathname.split('/').filter((item) => item !== '')
		if (parts.length === 0) {
			return ''
		}
		const last = parts[parts.length - 1]
		return last ?? ''
	} catch {
		return ''
	}
}

function isRedirectStatus(status: number): boolean {
	return status === 302 || status === 303 || status === 307 || status === 308
}

async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms)
	})
}

async function readApiCodeResponse(response: Response): Promise<ApiCodeResponse> {
	try {
		return (await response.clone().json()) as ApiCodeResponse
	} catch {
		return {}
	}
}
