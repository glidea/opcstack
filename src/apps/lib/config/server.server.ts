import wranglerConfigText from '../../../../wrangler.jsonc?raw'
import type { PublicConfig } from './client'
import { formatDecimal, parseDecimal } from '$backend/lib/decimal'

type StringConfigKeys = {
	[K in keyof Env]: Env[K] extends string ? K : never
}[keyof Env]

type ServerConfig = {
	readonly [K in StringConfigKeys]: Env[K]
}

type WranglerConfig = {
	vars: ServerConfig
}

const wranglerConfig = JSON.parse(wranglerConfigText) as WranglerConfig

export const serverConfig: ServerConfig = wranglerConfig.vars

export function getServerPublicConfig(): PublicConfig {
	return {
		design_system: serverConfig.DESIGN_SYSTEM || 'apple-saas',
		beta_code_enabled: String(serverConfig.BETA_CODE_ENABLED) === 'true',
		turnstile_enabled: String(serverConfig.TURNSTILE_ENABLED) === 'true',
		turnstile_site_key: serverConfig.TURNSTILE_SITE_KEY,
		google_auth_enabled: String(serverConfig.GOOGLE_AUTH_ENABLED) === 'true',
		github_auth_enabled: String(serverConfig.GITHUB_AUTH_ENABLED) === 'true',
		linuxdo_auth_enabled: String(serverConfig.LINUXDO_AUTH_ENABLED) === 'true',
		email_enabled: String(serverConfig.EMAIL_ENABLED) === 'true',
		email_signup_enabled: String(serverConfig.EMAIL_SIGNUP_ENABLED) === 'true',
		email_require_verification: String(serverConfig.EMAIL_REQUIRE_VERIFICATION) === 'true',
		email_user_action_cooldown_seconds: Number(serverConfig.EMAIL_USER_ACTION_COOLDOWN_SECONDS),
		credits_signup_enabled: String(serverConfig.CREDITS_SIGNUP_ENABLED) === 'true',
		credits_signup_amount: formatDecimal(parseDecimal(serverConfig.CREDITS_SIGNUP_AMOUNT)),
		credits_daily_checkin_enabled: String(serverConfig.CREDITS_DAILY_CHECKIN_ENABLED) === 'true',
		credits_daily_checkin_amount: formatDecimal(
			parseDecimal(serverConfig.CREDITS_DAILY_CHECKIN_AMOUNT)
		),
		aff_enabled: String(serverConfig.AFF_ENABLED) === 'true',
		payment_enabled: String(serverConfig.PAYMENT_ENABLED) === 'true'
	}
}
