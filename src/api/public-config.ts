export interface PublicConfig {
	beta_code_enabled: boolean
	google_auth_enabled: boolean
	email_enabled: boolean
	email_signup_enabled: boolean
	email_require_verification: boolean
	email_user_action_cooldown_seconds: number
	credits_signup_enabled: boolean
	credits_signup_amount: number
	credits_daily_checkin_enabled: boolean
	credits_daily_checkin_amount: number
	credits_referral_enabled: boolean
	payment_enabled: boolean
}

export function readPublicConfig(env: Env): PublicConfig {
	const envMap = env as unknown as Record<string, string | undefined>
	return {
		beta_code_enabled: String(env.BETA_CODE_ENABLED) === 'true',
		google_auth_enabled: String(env.GOOGLE_AUTH_ENABLED) === 'true',
		email_enabled: String(env.EMAIL_ENABLED) === 'true',
		email_signup_enabled: String(env.EMAIL_SIGNUP_ENABLED) === 'true',
		email_require_verification: String(env.EMAIL_REQUIRE_VERIFICATION) === 'true',
		email_user_action_cooldown_seconds: Number(env.EMAIL_USER_ACTION_COOLDOWN_SECONDS),
		credits_signup_enabled: envMap['CREDITS_SIGNUP_ENABLED'] === 'true',
		credits_signup_amount: Number(envMap['CREDITS_SIGNUP_AMOUNT'] ?? '0'),
		credits_daily_checkin_enabled: envMap['CREDITS_DAILY_CHECKIN_ENABLED'] === 'true',
		credits_daily_checkin_amount: Number(envMap['CREDITS_DAILY_CHECKIN_AMOUNT'] ?? '0'),
		credits_referral_enabled: envMap['CREDITS_REFERRAL_ENABLED'] === 'true',
		payment_enabled: envMap['PAYMENT_ENABLED'] === 'true'
	}
}
