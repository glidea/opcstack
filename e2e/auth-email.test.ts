import { beforeAll, describe } from 'vitest'
import { Resend } from 'resend'
import { runCases, type TestCase } from '../src/backend/testing/bdd'

type E2EEnv = {
	APP_BASE_URL?: string
	E2E_REMOTE?: string
	E2E_EMAIL_ENABLED?: string
	E2E_EMAIL_SIGNUP_ENABLED?: string
	E2E_EMAIL_REQUIRE_VERIFICATION?: string
	E2E_EMAIL_RESEND_API_KEY?: string
	E2E_EMAIL_FROM?: string
	E2E_TURNSTILE_ENABLED?: string
}

const e2eEnv =
	(globalThis as unknown as { process?: { env?: E2EEnv } }).process?.env ?? {}
const appBaseUrl: string = e2eEnv.APP_BASE_URL ?? 'http://localhost:5173'
const appOrigin: string = new URL(appBaseUrl).origin
const isRemote: boolean = appOrigin !== 'http://localhost:5173'
const emailEnabled: boolean = e2eEnv.E2E_EMAIL_ENABLED === 'true'
const emailSignupEnabled: boolean = e2eEnv.E2E_EMAIL_SIGNUP_ENABLED === 'true'
const emailRequireVerification: boolean = e2eEnv.E2E_EMAIL_REQUIRE_VERIFICATION === 'true'
const emailResendApiKey: string = e2eEnv.E2E_EMAIL_RESEND_API_KEY ?? ''
const emailFrom: string = e2eEnv.E2E_EMAIL_FROM ?? ''
const turnstileEnabled: boolean = e2eEnv.E2E_TURNSTILE_ENABLED === 'true'
const canUseDummyCaptcha: boolean = !isRemote || !turnstileEnabled
const canRunEmailFlow: boolean =
	emailEnabled &&
	emailSignupEnabled &&
	emailRequireVerification &&
	emailResendApiKey !== '' &&
	emailFrom !== '' &&
	canUseDummyCaptcha

describe('email auth e2e', () => {
	beforeAll(async () => {
		const res = await fetch(`${appBaseUrl}/api/health`)
		if (res.status !== 200) {
			throw new Error('dev server is not ready for e2e tests')
		}
	})

	type PublicGiven = Record<string, never>
	type PublicWhen = {
		action: 'sign_in_email_otp' | 'send_sign_in_otp'
	}
	type PublicThen = {
		status: number
		code: string
	}

	const publicCases: TestCase<PublicGiven, PublicWhen, PublicThen>[] = [
		{
			scenario: 'reject email otp sign in endpoint',
			given: 'email otp sign in request',
			when: 'calling sign in email otp',
			then: 'returns otp sign in disabled',
			givenDetail: {},
			whenDetail: {
				action: 'sign_in_email_otp'
			},
			thenExpected: {
				status: 400,
				code: 'EMAIL_OTP_SIGN_IN_DISABLED'
			}
		},
		{
			scenario: 'reject sign in otp send request',
			given: 'send verification otp request with sign in type',
			when: 'calling send verification otp',
			then: 'returns otp sign in disabled',
			givenDetail: {},
			whenDetail: {
				action: 'send_sign_in_otp'
			},
			thenExpected: {
				status: 400,
				code: 'EMAIL_OTP_SIGN_IN_DISABLED'
			}
		}
	]

	runCases(publicCases, async (_given, when) => {
		const email = buildScenarioEmail(`blocked-${when.action}-${Date.now()}`)
		if (when.action === 'sign_in_email_otp') {
			const res = await postJson('/api/auth/sign-in/email-otp', {
				email,
				otp: '123456'
			})
			const payload = (await res.json()) as { code?: string }
			return {
				status: res.status,
				code: payload.code ?? ''
			}
		}

		const res = await postJson('/api/auth/email-otp/send-verification-otp', {
			email,
			type: 'sign-in'
		})
		const payload = (await res.json()) as { code?: string }
		return {
			status: res.status,
			code: payload.code ?? ''
		}
	})

	describe.skipIf(!canRunEmailFlow)('email otp flow', () => {
		type FlowGiven = Record<string, never>
		type FlowWhen = {
			action: 'signup_verify_sign_in' | 'reset_password'
		}
		type FlowThen = {
			signupStatus: number
			sendOtpStatus: number
			verifyEmailCount: number
			wrongOtpStatus: number
			otpStatus: number
			signInStatus: number
			hasToken: boolean
		}

		const flowCases: TestCase<FlowGiven, FlowWhen, FlowThen>[] = [
			{
				scenario: 'sign up verify email and sign in with password',
				given: 'email auth enabled with resend provider',
				when: 'signing up and verifying email otp',
				then: 'user can sign in with password',
				givenDetail: {},
				whenDetail: {
					action: 'signup_verify_sign_in'
				},
				thenExpected: {
					signupStatus: 200,
					sendOtpStatus: 200,
					verifyEmailCount: 1,
					wrongOtpStatus: 400,
					otpStatus: 200,
					signInStatus: 200,
					hasToken: true
				},
				timeoutMs: 30_000
			},
			{
				scenario: 'request reset password otp and sign in with new password',
				given: 'verified email password user',
				when: 'resetting password with email otp',
				then: 'user can sign in with new password',
				givenDetail: {},
				whenDetail: {
					action: 'reset_password'
				},
				thenExpected: {
					signupStatus: 200,
					sendOtpStatus: 200,
					verifyEmailCount: 1,
					wrongOtpStatus: 400,
					otpStatus: 200,
					signInStatus: 200,
					hasToken: true
				},
				timeoutMs: 70_000
			}
		]

		runCases(flowCases, async (_given, when) => {
			if (when.action === 'signup_verify_sign_in') {
				return signupVerifyAndSignIn(`signup-${Date.now()}`, 'Password123')
			}

			const tag = `reset-${Date.now()}`
			const oldPassword = 'Password123'
			const newPassword = 'Password456'
			const email = buildScenarioEmail(tag)
			const baseResult = await signupVerifyAndSignIn(tag, oldPassword)
			const resetRequestedAt = Date.now() - 1000
			const requestRes = await postJson('/api/auth/email-otp/request-password-reset', {
				email
			})
			if (!requestRes.ok) {
				return {
					...baseResult,
					signInStatus: requestRes.status,
					hasToken: false
				}
			}

			const resetOtp = await readEmailOtp(email, 'Reset your password', resetRequestedAt)
			const wrongResetOtp = resetOtp === '000000' ? '999999' : '000000'
			const wrongResetRes = await postJson('/api/auth/email-otp/reset-password', {
				email,
				otp: wrongResetOtp,
				password: newPassword
			})
			const resetRes = await postJson('/api/auth/email-otp/reset-password', {
				email,
				otp: resetOtp,
				password: newPassword
			})
			const signInRes = await postJson('/api/auth/sign-in/email', {
				email,
				password: newPassword
			})
			const signInPayload = (await signInRes.json()) as { token?: string }
			return {
				signupStatus: baseResult.signupStatus,
				sendOtpStatus: baseResult.sendOtpStatus,
				verifyEmailCount: baseResult.verifyEmailCount,
				wrongOtpStatus: wrongResetRes.status,
				otpStatus: resetRes.status,
				signInStatus: signInRes.status,
				hasToken: Boolean(signInPayload.token)
			}
		})
	})
})

async function signupVerifyAndSignIn(tag: string, password: string): Promise<{
	signupStatus: number
	sendOtpStatus: number
	verifyEmailCount: number
	wrongOtpStatus: number
	otpStatus: number
	signInStatus: number
	hasToken: boolean
}> {
	const email = buildScenarioEmail(tag)
	const signupStartedAt = Date.now() - 1000
	const signupRes = await postJson('/api/auth/sign-up/email', {
		name: 'e2e-user',
		email,
		password
	})
	if (!signupRes.ok) {
		return {
			signupStatus: signupRes.status,
			sendOtpStatus: 0,
			verifyEmailCount: 0,
			wrongOtpStatus: 0,
			otpStatus: 0,
			signInStatus: 0,
			hasToken: false
		}
	}

	const sendOtpRes = await postJson('/api/auth/email-otp/send-verification-otp', {
		email,
		type: 'email-verification'
	})
	if (!sendOtpRes.ok) {
		return {
			signupStatus: signupRes.status,
			sendOtpStatus: sendOtpRes.status,
			verifyEmailCount: 0,
			wrongOtpStatus: 0,
			otpStatus: 0,
			signInStatus: 0,
			hasToken: false
		}
	}

	const otp = await readEmailOtp(email, 'Verify your email', signupStartedAt)
	const verifyEmailCount = await countEmails(email, 'Verify your email', signupStartedAt)
	const wrongOtp = otp === '000000' ? '999999' : '000000'
	const wrongOtpRes = await postJson('/api/auth/email-otp/verify-email', {
		email,
		otp: wrongOtp
	})
	const verifyRes = await postJson('/api/auth/email-otp/verify-email', {
		email,
		otp
	})
	const signInRes = await postJson('/api/auth/sign-in/email', {
		email,
		password
	})
	const signInPayload = (await signInRes.json()) as { token?: string }
	return {
		signupStatus: signupRes.status,
		sendOtpStatus: sendOtpRes.status,
		verifyEmailCount,
		wrongOtpStatus: wrongOtpRes.status,
		otpStatus: verifyRes.status,
		signInStatus: signInRes.status,
		hasToken: Boolean(signInPayload.token)
	}
}

async function countEmails(email: string, subject: string, startedAt: number): Promise<number> {
	const resend = new Resend(emailResendApiKey)
	const listRes = await resend.emails.list({ limit: 100 })
	const lowerEmail = email.toLowerCase()
	return (
		listRes.data?.data.filter((candidate) => {
			const createdAt = Date.parse(candidate.created_at)
			if (!Number.isFinite(createdAt) || createdAt < startedAt) {
				return false
			}
			if (!candidate.subject.includes(subject)) {
				return false
			}
			return candidate.to.some((to) => {
				return to.toLowerCase() === lowerEmail
			})
		}).length ?? 0
	)
}

async function readEmailOtp(
	email: string,
	subject: string,
	startedAt: number
): Promise<string> {
	const resend = new Resend(emailResendApiKey)
	for (let attempt = 0; attempt < 30; attempt += 1) {
		const otp = await findEmailOtp(resend, email, subject, startedAt)
		if (otp) {
			return otp
		}
		await sleep(1000)
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
	const lowerEmail = email.toLowerCase()
	const item = listRes.data?.data.find((candidate) => {
		const createdAt = Date.parse(candidate.created_at)
		if (!Number.isFinite(createdAt) || createdAt < startedAt) {
			return false
		}
		if (!candidate.subject.includes(subject)) {
			return false
		}
		return candidate.to.some((to) => {
			return to.toLowerCase() === lowerEmail
		})
	})
	if (!item) {
		return ''
	}

	const detailRes = await resend.emails.get(item.id)
	const body = detailRes.data?.html ?? detailRes.data?.text ?? ''
	const htmlMatch = body.match(/>(\d{6})<\/div>/)
	if (htmlMatch?.[1]) {
		return htmlMatch[1]
	}
	const textMatch = body.match(/\b\d{6}\b/)
	return textMatch?.[0] ?? ''
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms)
	})
}

function buildScenarioEmail(tag: string): string {
	const domain = extractEmailDomain(emailFrom) || 'example.com'
	const cleanTag = tag.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
	return `e2e-${cleanTag}@${domain}`
}

function extractEmailDomain(value: string): string {
	const email = extractEmailAddress(value)
	const at = email.lastIndexOf('@')
	if (at < 0) {
		return ''
	}
	return email.slice(at + 1)
}

function extractEmailAddress(value: string): string {
	const match = value.match(/<([^>]+)>/)
	if (match?.[1]) {
		return match[1].trim()
	}
	return value.trim()
}

function buildHeaders(extra?: Record<string, string>): Headers {
	const headers = new Headers({
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
