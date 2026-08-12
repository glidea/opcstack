import type { MiddlewareHandler } from 'hono'
import type { ApiEnv } from '..'
import { getRequestAuthRuntimeConfig } from './auth'

type EmailActionScene = 'signup' | 'request_password_reset' | 'send_verification_email'

type EmailActionRoute = {
	path: string
	scene: EmailActionScene
}

type AuthEmailBody = {
	email?: string
	type?: string
}

const localCooldownStore: Map<string, number> = new Map<string, number>()

const emailOtpSignInRoute = '/api/auth/sign-in/email-otp'

const emailActionRoutes: EmailActionRoute[] = [
	{ path: '/api/auth/sign-up/email', scene: 'signup' },
	{ path: '/api/auth/email-otp/request-password-reset', scene: 'request_password_reset' },
	{ path: '/api/auth/email-otp/send-verification-otp', scene: 'send_verification_email' }
]

export const emailAuthMiddleware: MiddlewareHandler<ApiEnv> = async (
	ctx,
	next
): Promise<Response | void> => {
	if (ctx.req.path === emailOtpSignInRoute) {
		return ctx.json({ code: 'EMAIL_OTP_SIGN_IN_DISABLED', message: 'Email OTP sign-in is disabled' }, 400)
	}

	const scene = resolveEmailActionScene(ctx.req.path)
	if (!scene) {
		return next()
	}

	const body = await parseAuthEmailBody(ctx.req.raw)
	if (scene === 'send_verification_email' && body.type === 'sign-in') {
		return ctx.json({ code: 'EMAIL_OTP_SIGN_IN_DISABLED', message: 'Email OTP sign-in is disabled' }, 400)
	}

	const config = await getRequestAuthRuntimeConfig(ctx)
	if (!config.email.enabled) {
		return ctx.json({ code: 'EMAIL_DISABLED', message: 'Email is disabled' }, 400)
	}
	const emailSignupEnabled: boolean = config.authentication.emailSignupEnabled
	if (scene === 'signup' && !emailSignupEnabled) {
		return ctx.json({ code: 'EMAIL_SIGNUP_DISABLED', message: 'Email signup is disabled' }, 400)
	}

	const signupDomainAllowlist: string[] = config.authentication.emailSignupDomainAllowlist
	const userActionCooldownSeconds: number =
		config.authentication.emailUserActionCooldownSeconds

	const email = normalizeEmail(body.email)

	if (
		scene === 'signup' &&
		email &&
		!isEmailDomainAllowed(email, signupDomainAllowlist)
	) {
		return ctx.json({ code: 'EMAIL_DOMAIN_NOT_ALLOWED', message: 'Email domain is not allowed' }, 400)
	}

	if (!email) {
		return next()
	}

	const key = await buildCooldownKey(scene, email)
	const now = Date.now()
	const localExpiresAt = localCooldownStore.get(key) ?? 0
	if (localExpiresAt > now) {
		return ctx.json({ code: 'EMAIL_ACTION_RATE_LIMITED', message: 'Email action is rate limited' }, 429)
	}

	const existing = await ctx.env.KV.get(key)
	if (isCooldownActive(existing)) {
		localCooldownStore.set(key, now + userActionCooldownSeconds * 1000)
		return ctx.json({ code: 'EMAIL_ACTION_RATE_LIMITED', message: 'Email action is rate limited' }, 429)
	}

	const cooldownExpiresAt = now + userActionCooldownSeconds * 1000
	localCooldownStore.set(key, cooldownExpiresAt)

	await ctx.env.KV.put(key, String(cooldownExpiresAt), {
		expirationTtl: normalizeKvExpirationTtl(userActionCooldownSeconds)
	})

	return next()
}

function normalizeKvExpirationTtl(cooldownSeconds: number): number {
	if (cooldownSeconds < 60) {
		return 60
	}
	return cooldownSeconds
}

function isCooldownActive(rawValue: string | null): boolean {
	if (!rawValue) {
		return false
	}
	const expiresAt = Number(rawValue)
	if (!Number.isFinite(expiresAt)) {
		return true
	}
	return expiresAt > Date.now()
}

function resolveEmailActionScene(pathname: string): EmailActionScene | undefined {
	for (const route of emailActionRoutes) {
		if (route.path === pathname) {
			return route.scene
		}
	}
	return undefined
}

async function parseAuthEmailBody(request: Request): Promise<AuthEmailBody> {
	try {
		const payload = await request.clone().json<unknown>()
		if (!payload || typeof payload !== 'object') {
			return {}
		}
		const body = payload as Record<string, unknown>
		const email = body['email']
		const type = body['type']
		return {
			email: typeof email === 'string' ? email : undefined,
			type: typeof type === 'string' ? type : undefined
		}
	} catch {
		return {}
	}
}

function normalizeEmail(email: string | undefined): string {
	if (!email) {
		return ''
	}
	return email.trim().toLowerCase()
}

function isEmailDomainAllowed(email: string, allowlist: string[]): boolean {
	if (allowlist.length === 0) {
		return true
	}
	const index = email.lastIndexOf('@')
	if (index < 0) {
		return false
	}
	const domain = email.slice(index + 1)
	return allowlist.includes(domain)
}

async function buildCooldownKey(scene: EmailActionScene, email: string): Promise<string> {
	const hash = await sha256Hex(email)
	return `email:cooldown:${scene}:${hash}`
}

async function sha256Hex(value: string): Promise<string> {
	const data = new TextEncoder().encode(value)
	const digest = await crypto.subtle.digest('SHA-256', data)
	const bytes = new Uint8Array(digest)
	let output = ''
	for (const item of bytes) {
		output += item.toString(16).padStart(2, '0')
	}
	return output
}
