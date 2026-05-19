export type PublicConfig = {
	design_system: string
	beta_code_enabled: boolean
	google_auth_enabled: boolean
	email_enabled: boolean
	email_signup_enabled: boolean
	email_require_verification: boolean
	email_user_action_cooldown_seconds: number
	credits_signup_enabled: boolean
	credits_signup_amount: string
	credits_daily_checkin_enabled: boolean
	credits_daily_checkin_amount: string
	credits_referral_enabled: boolean
	payment_enabled: boolean
}

export async function getPublicConfig(fetchApi: typeof fetch): Promise<PublicConfig> {
	const res = await fetchApi('/api/get_public_config', { method: 'POST' })
	return (await res.json()) as PublicConfig
}
