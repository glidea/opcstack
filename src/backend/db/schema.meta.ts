import { sql } from 'drizzle-orm'
import { check, index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { oauthClient, user } from './schema.auth'

export type PaymentProviderCountryOverride = {
	country: string
	provider: 'dodo' | 'creem'
}

export const systemSettings = sqliteTable(
	'system_settings',
	{
		id: integer('id').primaryKey(),
		generalVersion: integer('general_version').notNull(),
		authenticationVersion: integer('authentication_version').notNull(),
		emailVersion: integer('email_version').notNull(),
		storageVersion: integer('storage_version').notNull(),
		creditsVersion: integer('credits_version').notNull(),
		affiliateVersion: integer('affiliate_version').notNull(),
		paymentVersion: integer('payment_version').notNull(),
		aiVersion: integer('ai_version').notNull(),
		designSystem: text('design_system').notNull(),
		docsEnabled: integer('docs_enabled', { mode: 'boolean' }).notNull(),
		betaCodeEnabled: integer('beta_code_enabled', { mode: 'boolean' }).notNull(),
		emailSignupEnabled: integer('email_signup_enabled', { mode: 'boolean' }).notNull(),
		emailSignupDomainAllowlist: text('email_signup_domain_allowlist', { mode: 'json' })
			.$type<string[]>()
			.notNull(),
		emailRequireVerification: integer('email_require_verification', {
			mode: 'boolean'
		}).notNull(),
		emailUserActionCooldownSeconds: integer('email_user_action_cooldown_seconds').notNull(),
		turnstileEnabled: integer('turnstile_enabled', { mode: 'boolean' }).notNull(),
		turnstileSiteKey: text('turnstile_site_key'),
		turnstileSecretKeyCiphertext: text('turnstile_secret_key_ciphertext'),
		turnstileSecretKeyIv: text('turnstile_secret_key_iv'),
		googleAuthEnabled: integer('google_auth_enabled', { mode: 'boolean' }).notNull(),
		googleClientId: text('google_client_id'),
		googleClientSecretCiphertext: text('google_client_secret_ciphertext'),
		googleClientSecretIv: text('google_client_secret_iv'),
		githubAuthEnabled: integer('github_auth_enabled', { mode: 'boolean' }).notNull(),
		githubClientId: text('github_client_id'),
		githubClientSecretCiphertext: text('github_client_secret_ciphertext'),
		githubClientSecretIv: text('github_client_secret_iv'),
		linuxdoAuthEnabled: integer('linuxdo_auth_enabled', { mode: 'boolean' }).notNull(),
		linuxdoClientId: text('linuxdo_client_id'),
		linuxdoClientSecretCiphertext: text('linuxdo_client_secret_ciphertext'),
		linuxdoClientSecretIv: text('linuxdo_client_secret_iv'),
		emailEnabled: integer('email_enabled', { mode: 'boolean' }).notNull(),
		emailProvider: text('email_provider'),
		emailResendApiKeyCiphertext: text('email_resend_api_key_ciphertext'),
		emailResendApiKeyIv: text('email_resend_api_key_iv'),
		r2UserUploadAllowedContentTypes: text('r2_user_upload_allowed_content_types', {
			mode: 'json'
		})
			.$type<string[]>()
			.notNull(),
		r2UserUploadMaxBytes: integer('r2_user_upload_max_bytes').notNull(),
		creditsSignupEnabled: integer('credits_signup_enabled', { mode: 'boolean' }).notNull(),
		creditsSignupAmount: integer('credits_signup_amount').notNull(),
		creditsDailyCheckinEnabled: integer('credits_daily_checkin_enabled', {
			mode: 'boolean'
		}).notNull(),
		creditsDailyCheckinAmount: integer('credits_daily_checkin_amount').notNull(),
		creditsHistoryRetentionDays: integer('credits_history_retention_days').notNull(),
		affiliateEnabled: integer('affiliate_enabled', { mode: 'boolean' }).notNull(),
		affiliateInviterCreditAmount: integer('affiliate_inviter_credit_amount').notNull(),
		affiliateInviteeCreditAmount: integer('affiliate_invitee_credit_amount').notNull(),
		paymentEnabled: integer('payment_enabled', { mode: 'boolean' }).notNull(),
		paymentDefaultProvider: text('payment_default_provider'),
		paymentProviderCountryOverrides: text('payment_provider_country_overrides', { mode: 'json' })
			.$type<PaymentProviderCountryOverride[]>()
			.notNull(),
		paymentDodoTestMode: integer('payment_dodo_test_mode', { mode: 'boolean' }).notNull(),
		paymentDodoApiKeyCiphertext: text('payment_dodo_api_key_ciphertext'),
		paymentDodoApiKeyIv: text('payment_dodo_api_key_iv'),
		paymentDodoWebhookSecretCiphertext: text('payment_dodo_webhook_secret_ciphertext'),
		paymentDodoWebhookSecretIv: text('payment_dodo_webhook_secret_iv'),
		paymentCreemTestMode: integer('payment_creem_test_mode', { mode: 'boolean' }).notNull(),
		paymentCreemApiKeyCiphertext: text('payment_creem_api_key_ciphertext'),
		paymentCreemApiKeyIv: text('payment_creem_api_key_iv'),
		paymentCreemWebhookSecretCiphertext: text('payment_creem_webhook_secret_ciphertext'),
		paymentCreemWebhookSecretIv: text('payment_creem_webhook_secret_iv'),
		aiRoutingErrorWeight: real('ai_routing_error_weight').notNull(),
		aiRoutingLatencyWeight: real('ai_routing_latency_weight').notNull(),
		aiRoutingPriceWeight: real('ai_routing_price_weight').notNull(),
		aiTaskRetentionDays: integer('ai_task_retention_days').notNull(),
		chatOpenaiEnabled: integer('chat_openai_enabled', { mode: 'boolean' }).notNull(),
		chatOpenaiBaseUrl: text('chat_openai_base_url'),
		chatOpenaiDefaultModel: text('chat_openai_default_model'),
		chatOpenaiApiKeyCiphertext: text('chat_openai_api_key_ciphertext'),
		chatOpenaiApiKeyIv: text('chat_openai_api_key_iv'),
		imageGeminiEnabled: integer('image_gemini_enabled', { mode: 'boolean' }).notNull(),
		imageGeminiBaseUrl: text('image_gemini_base_url'),
		imageGeminiDefaultModel: text('image_gemini_default_model'),
		imageGeminiApiKeyCiphertext: text('image_gemini_api_key_ciphertext'),
		imageGeminiApiKeyIv: text('image_gemini_api_key_iv'),
		imageOpenaiEnabled: integer('image_openai_enabled', { mode: 'boolean' }).notNull(),
		imageOpenaiBaseUrl: text('image_openai_base_url'),
		imageOpenaiDefaultModel: text('image_openai_default_model'),
		imageOpenaiApiKeyCiphertext: text('image_openai_api_key_ciphertext'),
		imageOpenaiApiKeyIv: text('image_openai_api_key_iv'),
		imageSeedreamEnabled: integer('image_seedream_enabled', { mode: 'boolean' }).notNull(),
		imageSeedreamBaseUrl: text('image_seedream_base_url'),
		imageSeedreamDefaultModel: text('image_seedream_default_model'),
		imageSeedreamApiKeyCiphertext: text('image_seedream_api_key_ciphertext'),
		imageSeedreamApiKeyIv: text('image_seedream_api_key_iv'),
		imageAliyunEnabled: integer('image_aliyun_enabled', { mode: 'boolean' }).notNull(),
		imageAliyunBaseUrl: text('image_aliyun_base_url'),
		imageAliyunDefaultModel: text('image_aliyun_default_model'),
		imageAliyunApiKeyCiphertext: text('image_aliyun_api_key_ciphertext'),
		imageAliyunApiKeyIv: text('image_aliyun_api_key_iv'),
		ttsGeminiEnabled: integer('tts_gemini_enabled', { mode: 'boolean' }).notNull(),
		ttsGeminiBaseUrl: text('tts_gemini_base_url'),
		ttsGeminiDefaultModel: text('tts_gemini_default_model'),
		ttsGeminiApiKeyCiphertext: text('tts_gemini_api_key_ciphertext'),
		ttsGeminiApiKeyIv: text('tts_gemini_api_key_iv'),
		ttsSeedEnabled: integer('tts_seed_enabled', { mode: 'boolean' }).notNull(),
		ttsSeedBaseUrl: text('tts_seed_base_url'),
		ttsSeedDefaultModel: text('tts_seed_default_model'),
		ttsSeedApiKeyCiphertext: text('tts_seed_api_key_ciphertext'),
		ttsSeedApiKeyIv: text('tts_seed_api_key_iv'),
		realtimeDoubaoEnabled: integer('realtime_doubao_enabled', { mode: 'boolean' }).notNull(),
		realtimeDoubaoBaseUrl: text('realtime_doubao_base_url'),
		realtimeDoubaoDefaultModel: text('realtime_doubao_default_model'),
		realtimeDoubaoApiKeyCiphertext: text('realtime_doubao_api_key_ciphertext'),
		realtimeDoubaoApiKeyIv: text('realtime_doubao_api_key_iv'),
		videoSeedanceEnabled: integer('video_seedance_enabled', { mode: 'boolean' }).notNull(),
		videoSeedanceBaseUrl: text('video_seedance_base_url'),
		videoSeedanceDefaultModel: text('video_seedance_default_model'),
		videoSeedanceApiKeyCiphertext: text('video_seedance_api_key_ciphertext'),
		videoSeedanceApiKeyIv: text('video_seedance_api_key_iv'),
		createdAt: integer('created_at').notNull(),
		updatedAt: integer('updated_at').notNull()
	},
	(table) => [
		check('system_settings_singleton_check', sql`${table.id} = 1`),
		check(
			'system_settings_versions_check',
			sql`${table.generalVersion} >= 1 and ${table.authenticationVersion} >= 1 and ${table.emailVersion} >= 1 and ${table.storageVersion} >= 1 and ${table.creditsVersion} >= 1 and ${table.affiliateVersion} >= 1 and ${table.paymentVersion} >= 1 and ${table.aiVersion} >= 1`
		),
		check(
			'system_settings_design_system_check',
			sql`${table.designSystem} in ('apple-saas', 'brutalism')`
		),
		check(
			'system_settings_email_provider_check',
			sql`${table.emailProvider} is null or ${table.emailProvider} in ('cloudflare', 'resend')`
		),
		check(
			'system_settings_payment_provider_check',
			sql`${table.paymentDefaultProvider} is null or ${table.paymentDefaultProvider} in ('dodo', 'creem')`
		),
		check(
			'system_settings_positive_values_check',
			sql`${table.emailUserActionCooldownSeconds} > 0 and ${table.r2UserUploadMaxBytes} > 0 and ${table.creditsSignupAmount} >= 0 and ${table.creditsDailyCheckinAmount} >= 0 and ${table.creditsHistoryRetentionDays} > 0 and ${table.affiliateInviterCreditAmount} >= 0 and ${table.affiliateInviteeCreditAmount} >= 0 and ${table.aiRoutingErrorWeight} >= 0 and ${table.aiRoutingLatencyWeight} >= 0 and ${table.aiRoutingPriceWeight} >= 0 and (${table.aiRoutingErrorWeight} + ${table.aiRoutingLatencyWeight} + ${table.aiRoutingPriceWeight}) > 0 and ${table.aiTaskRetentionDays} > 0`
		)
	]
)

export const paymentProduct = sqliteTable(
	'payment_products',
	{
		id: text('id').primaryKey(),
		type: text('type').notNull(),
		creditsAmount: integer('credits_amount'),
		subscriptionPlan: text('subscription_plan'),
		upgradeRank: integer('upgrade_rank'),
		periodCreditsAmount: integer('period_credits_amount'),
		dodoProductId: text('dodo_product_id').unique(),
		creemProductId: text('creem_product_id').unique(),
		version: integer('version').notNull(),
		createdAt: integer('created_at').notNull(),
		updatedAt: integer('updated_at').notNull()
	},
	(table) => [
		check('payment_products_type_check', sql`${table.type} in ('one_time', 'subscription')`),
		check(
			'payment_products_provider_check',
			sql`${table.dodoProductId} is not null or ${table.creemProductId} is not null`
		),
		check(
			'payment_products_fields_check',
			sql`(${table.type} = 'one_time' and ${table.creditsAmount} > 0 and ${table.subscriptionPlan} is null and ${table.upgradeRank} is null and ${table.periodCreditsAmount} is null) or (${table.type} = 'subscription' and ${table.creditsAmount} is null and ${table.subscriptionPlan} is not null and length(${table.subscriptionPlan}) > 0 and ${table.upgradeRank} >= 0 and ${table.periodCreditsAmount} > 0)`
		),
		check('payment_products_version_check', sql`${table.version} >= 1`)
	]
)

export const aiChannel = sqliteTable(
	'ai_channels',
	{
		id: text('id').primaryKey(),
		area: text('area').notNull(),
		provider: text('provider').notNull(),
		name: text('name').notNull(),
		baseUrl: text('base_url').notNull(),
		models: text('models', { mode: 'json' }).$type<string[]>().notNull(),
		priceMultiplier: real('price_multiplier').notNull(),
		apiKeyCiphertext: text('api_key_ciphertext').notNull(),
		apiKeyIv: text('api_key_iv').notNull(),
		enabled: integer('enabled', { mode: 'boolean' }).notNull(),
		version: integer('version').notNull(),
		createdAt: integer('created_at').notNull(),
		updatedAt: integer('updated_at').notNull()
	},
	(table) => [
		index('ai_channels_enabled_area_provider_idx').on(table.enabled, table.area, table.provider),
		check('ai_channels_area_check', sql`${table.area} in ('image', 'tts', 'video')`),
		check('ai_channels_name_check', sql`length(${table.name}) > 0`),
		check('ai_channels_price_multiplier_check', sql`${table.priceMultiplier} > 0`),
		check('ai_channels_version_check', sql`${table.version} >= 1`)
	]
)

export const oauthGrant = sqliteTable(
	'oauth_grants',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		clientId: text('client_id')
			.notNull()
			.references(() => oauthClient.clientId),
		scopes: text('scopes', { mode: 'json' }).$type<string[]>().notNull(),
		status: text('status').notNull(),
		createdAt: integer('created_at').notNull(),
		approvedAt: integer('approved_at'),
		revokedAt: integer('revoked_at')
	},
	(table) => [
		index('oauth_grants_user_id_status_idx').on(table.userId, table.status),
		index('oauth_grants_client_id_status_idx').on(table.clientId, table.status),
		check('oauth_grants_status_check', sql`${table.status} in ('pending', 'active', 'revoked')`)
	]
)

export const oauthAuthorizationRequest = sqliteTable(
	'oauth_authorization_requests',
	{
		id: text('id').primaryKey(),
		clientId: text('client_id')
			.notNull()
			.references(() => oauthClient.clientId),
		deviceCodeHash: text('device_code_hash').notNull().unique(),
		userCodeHash: text('user_code_hash').notNull().unique(),
		stateHash: text('state_hash').notNull().unique(),
		codeChallenge: text('code_challenge').notNull(),
		codeChallengeMethod: text('code_challenge_method').notNull(),
		requestedScopes: text('requested_scopes', { mode: 'json' }).$type<string[]>().notNull(),
		status: text('status').notNull(),
		grantId: text('grant_id').unique().references(() => oauthGrant.id),
		authorizationCode: text('authorization_code'),
		expiresAt: integer('expires_at').notNull(),
		codeExpiresAt: integer('code_expires_at'),
		lastPolledAt: integer('last_polled_at'),
		createdAt: integer('created_at').notNull(),
		consumedAt: integer('consumed_at')
	},
	(table) => [
		index('oauth_authorization_requests_status_expires_at_idx').on(table.status, table.expiresAt),
		check(
			'oauth_authorization_requests_code_challenge_method_check',
			sql`${table.codeChallengeMethod} = 'S256'`
		),
		check(
			'oauth_authorization_requests_status_check',
			sql`${table.status} in ('pending', 'authorized', 'denied', 'expired', 'consumed')`
		),
		check(
			'oauth_authorization_requests_expiry_check',
			sql`${table.expiresAt} > ${table.createdAt}`
		)
	]
)

export const betaCode = sqliteTable('beta_code', {
	id: text('id').primaryKey(),
	code: text('code').notNull().unique(),
	usedBy: text('used_by'),
	usedAt: integer('used_at'),
	createdAt: integer('created_at').notNull()
})

export const d1Shard = sqliteTable('d1_shards', {
	id: text('id').primaryKey(),
	bindingName: text('binding_name').notNull().unique(),
	databaseName: text('database_name').notNull().unique(),
	databaseId: text('database_id').notNull(),
	region: text('region').notNull(),
	status: text('status').notNull(),
	assignedCount: integer('assigned_count').notNull().default(0),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
})

export const userShard = sqliteTable(
	'user_shards',
	{
		userId: text('user_id')
			.primaryKey()
			.references(() => user.id, { onDelete: 'cascade' }),
		shardId: text('shard_id')
			.notNull()
			.references(() => d1Shard.id, { onDelete: 'restrict' }),
		createdAt: integer('created_at').notNull()
	},
	(table) => [index('user_shards_shard_id_idx').on(table.shardId)]
)

export const affReferral = sqliteTable(
	'aff_referrals',
	{
		id: text('id').primaryKey(),
		inviterUserId: text('inviter_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		inviteeUserId: text('invitee_user_id')
			.notNull()
			.unique()
			.references(() => user.id, { onDelete: 'cascade' }),
		inviterGrantedAt: integer('inviter_granted_at'),
		inviteeGrantedAt: integer('invitee_granted_at'),
		createdAt: integer('created_at').notNull()
	},
	(table) => [
		index('aff_referrals_inviter_user_id_idx').on(table.inviterUserId),
		check('aff_referrals_not_self_invite', sql`${table.inviterUserId} != ${table.inviteeUserId}`)
	]
)

export const creditRedemptionCode = sqliteTable(
	'credit_redemption_codes',
	{
		id: text('id').primaryKey(),
		code: text('code').notNull().unique(),
		amount: integer('amount').notNull(),
		status: text('status').notNull().default('unused'),
		expiresAt: integer('expires_at'),
		claimedBy: text('claimed_by').references(() => user.id, { onDelete: 'set null' }),
		claimedAt: integer('claimed_at'),
		grantedAt: integer('granted_at'),
		createdAt: integer('created_at').notNull()
	},
	(table) => [
		index('credit_redemption_codes_status_claimed_at_idx').on(table.status, table.claimedAt),
		index('credit_redemption_codes_expires_at_idx').on(table.expiresAt),
		index('credit_redemption_codes_claimed_by_idx').on(table.claimedBy),
		index('credit_redemption_codes_created_at_idx').on(table.createdAt),
		check('credit_redemption_codes_amount_gt_zero', sql`${table.amount} > 0`)
	]
)

export const notification = sqliteTable(
	'notifications',
	{
		id: text('id').primaryKey(),
		type: text('type').notNull(),
		title: text('title').notNull(),
		content: text('content').notNull(),
		targetUserId: text('target_user_id').references(() => user.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at').notNull()
	},
	(table) => [
		index('notifications_target_user_id_idx').on(table.targetUserId),
		index('notifications_created_at_idx').on(table.createdAt)
	]
)

export const checkoutOrder = sqliteTable(
	'checkout_orders',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		type: text('type').notNull(),
		status: text('status').notNull(),
		productId: text('product_id').notNull(),
		provider: text('provider').notNull(),
		providerProductId: text('provider_product_id').notNull(),
		productName: text('product_name').notNull().default(''),
		productDescription: text('product_description'),
		amount: integer('amount').notNull().default(0),
		currency: text('currency').notNull().default(''),
		creditsAmount: integer('credits_amount'),
		subscriptionPlan: text('subscription_plan'),
		periodCreditsAmount: integer('period_credits_amount'),
		providerCheckoutSessionId: text('provider_checkout_session_id'),
		providerPaymentId: text('provider_payment_id'),
		checkoutUrl: text('checkout_url'),
		createdAt: integer('created_at')
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at')
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(table) => [
		index('checkout_orders_user_id_idx').on(table.userId),
		index('checkout_orders_provider_checkout_session_id_idx').on(
			table.provider,
			table.providerCheckoutSessionId
		),
		index('checkout_orders_provider_payment_id_idx').on(table.provider, table.providerPaymentId)
	]
)

export const paymentTransaction = sqliteTable(
	'payment_transactions',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		checkoutOrderId: text('checkout_order_id'),
		subscriptionId: text('subscription_id'),
		type: text('type').notNull(),
		status: text('status').notNull(),
		productId: text('product_id').notNull(),
		provider: text('provider').notNull(),
		providerPaymentId: text('provider_payment_id'),
		providerRefundId: text('provider_refund_id'),
		providerDisputeId: text('provider_dispute_id'),
		amount: integer('amount').notNull(),
		currency: text('currency').notNull(),
		creditsGranted: integer('credits_granted').notNull().default(0),
		creditsReversedAt: integer('credits_reversed_at'),
		paidAt: integer('paid_at'),
		refundedAt: integer('refunded_at'),
		disputedAt: integer('disputed_at'),
		createdAt: integer('created_at')
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at')
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(table) => [
		index('payment_transactions_user_id_idx').on(table.userId),
		index('payment_transactions_checkout_order_id_idx').on(table.checkoutOrderId),
		index('payment_transactions_subscription_id_idx').on(table.subscriptionId),
		index('payment_transactions_created_at_idx').on(table.createdAt),
		uniqueIndex('payment_transactions_provider_payment_id_unique').on(
			table.provider,
			table.providerPaymentId
		),
		uniqueIndex('payment_transactions_provider_refund_id_unique').on(
			table.provider,
			table.providerRefundId
		),
		uniqueIndex('payment_transactions_provider_dispute_id_unique').on(
			table.provider,
			table.providerDisputeId
		)
	]
)

export const userSubscription = sqliteTable(
	'user_subscriptions',
	{
		userId: text('user_id')
			.primaryKey()
			.references(() => user.id, { onDelete: 'cascade' }),
		provider: text('provider').notNull(),
		providerSubscriptionId: text('provider_subscription_id').notNull(),
		productId: text('product_id').notNull(),
		subscriptionPlan: text('subscription_plan').notNull(),
		periodCreditsAmount: integer('period_credits_amount').notNull(),
		currentPeriodStart: integer('current_period_start').notNull(),
		currentPeriodEnd: integer('current_period_end').notNull(),
		status: text('status').notNull(),
		canceledAt: integer('canceled_at'),
		createdAt: integer('created_at')
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at')
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(table) => [
		uniqueIndex('user_subscriptions_provider_subscription_id_unique').on(
			table.provider,
			table.providerSubscriptionId
		),
		index('user_subscriptions_current_period_end_idx').on(table.currentPeriodEnd)
	]
)

export const paymentWebhookEvent = sqliteTable(
	'payment_webhook_events',
	{
		id: text('id').primaryKey(),
		provider: text('provider').notNull(),
		webhookId: text('webhook_id').notNull(),
		eventType: text('event_type').notNull(),
		processedAt: integer('processed_at').notNull()
	},
	(table) => [
		uniqueIndex('payment_webhook_events_provider_webhook_id_unique').on(
			table.provider,
			table.webhookId
		),
		index('payment_webhook_events_processed_at_idx').on(table.processedAt)
	]
)

export const agentAuthorizationRequest = sqliteTable(
	'agent_authorization_requests',
	{
		id: text('id').primaryKey(),
		deviceCodeHash: text('device_code_hash').notNull().unique(),
		userCodeHash: text('user_code_hash').notNull().unique(),
		stateHash: text('state_hash').notNull().unique(),
		codeChallenge: text('code_challenge').notNull(),
		codeChallengeMethod: text('code_challenge_method').notNull().default('S256'),
		scopes: text('scopes').notNull(),
		status: text('status').notNull().default('pending'),
		authorizationCode: text('authorization_code'),
		expiresAt: integer('expires_at').notNull(),
		codeExpiresAt: integer('code_expires_at'),
		lastPolledAt: integer('last_polled_at'),
		createdAt: integer('created_at').notNull(),
		consumedAt: integer('consumed_at')
	},
	(table) => [
		index('agent_authorization_requests_status_expires_at_idx').on(
			table.status,
			table.expiresAt
		),
		check(
			'agent_authorization_requests_code_challenge_method_check',
			sql`${table.codeChallengeMethod} = 'S256'`
		),
		check(
			'agent_authorization_requests_status_check',
			sql`${table.status} in ('pending', 'authorized', 'denied', 'expired', 'consumed')`
		),
		check(
			'agent_authorization_requests_expiry_check',
			sql`${table.expiresAt} > ${table.createdAt}`
		)
	]
)

export const agentGrant = sqliteTable(
	'agent_grants',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		clientId: text('client_id').notNull(),
		scopes: text('scopes').notNull(),
		status: text('status').notNull().default('active'),
		createdAt: integer('created_at').notNull(),
		approvedAt: integer('approved_at').notNull(),
		revokedAt: integer('revoked_at')
	},
	(table) => [
		index('agent_grants_user_id_status_idx').on(table.userId, table.status),
		index('agent_grants_client_id_status_idx').on(table.clientId, table.status),
		check(
			'agent_grants_status_check',
			sql`${table.status} in ('active', 'revoked')`
		)
	]
)

export type BetaCode = typeof betaCode.$inferSelect
export type NewBetaCode = typeof betaCode.$inferInsert
export type SystemSettings = typeof systemSettings.$inferSelect
export type NewSystemSettings = typeof systemSettings.$inferInsert
export type PaymentProduct = typeof paymentProduct.$inferSelect
export type NewPaymentProduct = typeof paymentProduct.$inferInsert
export type AIChannel = typeof aiChannel.$inferSelect
export type NewAIChannel = typeof aiChannel.$inferInsert
export type OAuthAuthorizationRequest = typeof oauthAuthorizationRequest.$inferSelect
export type NewOAuthAuthorizationRequest = typeof oauthAuthorizationRequest.$inferInsert
export type OAuthGrant = typeof oauthGrant.$inferSelect
export type NewOAuthGrant = typeof oauthGrant.$inferInsert
export type D1Shard = typeof d1Shard.$inferSelect
export type NewD1Shard = typeof d1Shard.$inferInsert
export type UserShard = typeof userShard.$inferSelect
export type NewUserShard = typeof userShard.$inferInsert
export type AffReferral = typeof affReferral.$inferSelect
export type NewAffReferral = typeof affReferral.$inferInsert
export type CreditRedemptionCode = typeof creditRedemptionCode.$inferSelect
export type NewCreditRedemptionCode = typeof creditRedemptionCode.$inferInsert
export type Notification = typeof notification.$inferSelect
export type NewNotification = typeof notification.$inferInsert
export type CheckoutOrder = typeof checkoutOrder.$inferSelect
export type NewCheckoutOrder = typeof checkoutOrder.$inferInsert
export type PaymentTransaction = typeof paymentTransaction.$inferSelect
export type NewPaymentTransaction = typeof paymentTransaction.$inferInsert
export type UserSubscription = typeof userSubscription.$inferSelect
export type NewUserSubscription = typeof userSubscription.$inferInsert
export type PaymentWebhookEvent = typeof paymentWebhookEvent.$inferSelect
export type NewPaymentWebhookEvent = typeof paymentWebhookEvent.$inferInsert
export type AgentAuthorizationRequest = typeof agentAuthorizationRequest.$inferSelect
export type NewAgentAuthorizationRequest = typeof agentAuthorizationRequest.$inferInsert
export type AgentGrant = typeof agentGrant.$inferSelect
export type NewAgentGrant = typeof agentGrant.$inferInsert
