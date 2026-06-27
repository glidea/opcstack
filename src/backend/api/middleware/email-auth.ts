import type { MiddlewareHandler } from 'hono'
import type { ApiEnv } from '..'

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
		return ctx.json({ code: 'EMAIL_OTP_SIGN_IN_DISABLED' }, 400)
	}

	const scene = resolveEmailActionScene(ctx.req.path)
	if (!scene) {
		return next()
	}

	const body = await parseAuthEmailBody(ctx.req.raw)
	if (scene === 'send_verification_email' && body.type === 'sign-in') {
		return ctx.json({ code: 'EMAIL_OTP_SIGN_IN_DISABLED' }, 400)
	}

	const emailEnabled = ctx.env.EMAIL_ENABLED === 'true'
	if (!emailEnabled) {
		return ctx.json({ code: 'EMAIL_DISABLED' }, 400)
	}

	const emailSignupEnabled = ctx.env.EMAIL_SIGNUP_ENABLED === 'true'
	if (scene === 'signup' && !emailSignupEnabled) {
		return ctx.json({ code: 'EMAIL_SIGNUP_DISABLED' }, 400)
	}

	const signupDomainAllowlist = ctx.env.EMAIL_SIGNUP_DOMAIN_ALLOWLIST
		.split(';')
		.map((item: string) => item.trim().toLowerCase())
		.filter((item: string) => item !== '')

	const userActionCooldownSeconds = Number(ctx.env.EMAIL_USER_ACTION_COOLDOWN_SECONDS)

	const email = normalizeEmail(body.email)

	if (
		scene === 'signup' &&
		email &&
		!isEmailDomainAllowed(email, signupDomainAllowlist)
	) {
		return ctx.json({ code: 'EMAIL_DOMAIN_NOT_ALLOWED' }, 400)
	}

	if (!email) {
		return next()
	}

	const key = await buildCooldownKey(scene, email)
	const now = Date.now()
	const localExpiresAt = localCooldownStore.get(key) ?? 0
	if (localExpiresAt > now) {
		return ctx.json({ code: 'EMAIL_ACTION_RATE_LIMITED' }, 429)
	}

	const existing = await ctx.env.KV.get(key)
	if (isCooldownActive(existing)) {
		localCooldownStore.set(key, now + userActionCooldownSeconds * 1000)
		return ctx.json({ code: 'EMAIL_ACTION_RATE_LIMITED' }, 429)
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
