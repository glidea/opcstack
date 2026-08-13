import { sql } from 'drizzle-orm'
import { check, index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { oauthClient, user } from './schema.auth'

export type PaymentProviderCountryOverride = {
	country: string
	provider: 'dodo' | 'creem'
}

export type EncryptedConfigValue = {
	ciphertext: string
	iv: string
}

export type GeneralSettingsDocument = {
	designSystem: 'apple-saas' | 'brutalism'
	docsEnabled: boolean
}

export type AuthenticationProviderSettings = {
	enabled: boolean
	clientId: string | null
	clientSecret: EncryptedConfigValue | null
}

export type AuthenticationSettingsDocument = {
	betaCodeEnabled: boolean
	emailSignupEnabled: boolean
	emailSignupDomainAllowlist: string[]
	emailRequireVerification: boolean
	emailUserActionCooldownSeconds: number
	turnstile: {
		enabled: boolean
		siteKey: string | null
		secretKey: EncryptedConfigValue | null
	}
	providers: {
		google: AuthenticationProviderSettings
		github: AuthenticationProviderSettings
		linuxdo: AuthenticationProviderSettings
	}
}

export type EmailSettingsDocument = {
	enabled: boolean
	provider: 'cloudflare' | 'resend' | null
	resendApiKey: EncryptedConfigValue | null
}

export type StorageSettingsDocument = {
	allowedContentTypes: string[]
	maxUploadBytes: number
}

export type CreditsSettingsDocument = {
	signupEnabled: boolean
	signupAmount: number
	dailyCheckinEnabled: boolean
	dailyCheckinAmount: number
	historyRetentionDays: number
}

export type AffiliateSettingsDocument = {
	enabled: boolean
	inviterCreditAmount: number
	inviteeCreditAmount: number
}

export type PaymentProviderSettings = {
	testMode: boolean
	apiKey: EncryptedConfigValue | null
	webhookSecret: EncryptedConfigValue | null
}

export type PaymentSettingsDocument = {
	enabled: boolean
	defaultProvider: 'dodo' | 'creem' | null
	providerCountryOverrides: PaymentProviderCountryOverride[]
	providers: {
		dodo: PaymentProviderSettings
		creem: PaymentProviderSettings
	}
}

export type AISettingsDocument = {
	routing: {
		errorWeight: number
		latencyWeight: number
		priceWeight: number
	}
	taskRetentionDays: number
}

export const systemSettings = sqliteTable(
	'system_settings',
	{
		id: integer('id').primaryKey(),
		generalConfig: text('general_config', { mode: 'json' })
			.$type<GeneralSettingsDocument>()
			.notNull(),
		generalVersion: integer('general_version').notNull(),
		generalUpdatedAt: integer('general_updated_at').notNull(),
		authenticationConfig: text('authentication_config', { mode: 'json' })
			.$type<AuthenticationSettingsDocument>()
			.notNull(),
		authenticationVersion: integer('authentication_version').notNull(),
		authenticationUpdatedAt: integer('authentication_updated_at').notNull(),
		emailConfig: text('email_config', { mode: 'json' }).$type<EmailSettingsDocument>().notNull(),
		emailVersion: integer('email_version').notNull(),
		emailUpdatedAt: integer('email_updated_at').notNull(),
		storageConfig: text('storage_config', { mode: 'json' })
			.$type<StorageSettingsDocument>()
			.notNull(),
		storageVersion: integer('storage_version').notNull(),
		storageUpdatedAt: integer('storage_updated_at').notNull(),
		creditsConfig: text('credits_config', { mode: 'json' })
			.$type<CreditsSettingsDocument>()
			.notNull(),
		creditsVersion: integer('credits_version').notNull(),
		creditsUpdatedAt: integer('credits_updated_at').notNull(),
		affiliateConfig: text('affiliate_config', { mode: 'json' })
			.$type<AffiliateSettingsDocument>()
			.notNull(),
		affiliateVersion: integer('affiliate_version').notNull(),
		affiliateUpdatedAt: integer('affiliate_updated_at').notNull(),
		paymentConfig: text('payment_config', { mode: 'json' })
			.$type<PaymentSettingsDocument>()
			.notNull(),
		paymentVersion: integer('payment_version').notNull(),
		paymentUpdatedAt: integer('payment_updated_at').notNull(),
		aiConfig: text('ai_config', { mode: 'json' }).$type<AISettingsDocument>().notNull(),
		aiVersion: integer('ai_version').notNull(),
		aiUpdatedAt: integer('ai_updated_at').notNull(),
		createdAt: integer('created_at').notNull()
	},
	(table) => [
		check('system_settings_singleton_check', sql`${table.id} = 1`),
		check(
			'system_settings_versions_check',
			sql`${table.generalVersion} >= 1 and ${table.authenticationVersion} >= 1 and ${table.emailVersion} >= 1 and ${table.storageVersion} >= 1 and ${table.creditsVersion} >= 1 and ${table.affiliateVersion} >= 1 and ${table.paymentVersion} >= 1 and ${table.aiVersion} >= 1`
		),
		check(
			'system_settings_json_check',
			sql`json_valid(${table.generalConfig}) and json_type(${table.generalConfig}) = 'object' and json_valid(${table.authenticationConfig}) and json_type(${table.authenticationConfig}) = 'object' and json_valid(${table.emailConfig}) and json_type(${table.emailConfig}) = 'object' and json_valid(${table.storageConfig}) and json_type(${table.storageConfig}) = 'object' and json_valid(${table.creditsConfig}) and json_type(${table.creditsConfig}) = 'object' and json_valid(${table.affiliateConfig}) and json_type(${table.affiliateConfig}) = 'object' and json_valid(${table.paymentConfig}) and json_type(${table.paymentConfig}) = 'object' and json_valid(${table.aiConfig}) and json_type(${table.aiConfig}) = 'object'`
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

export const aiProvider = sqliteTable(
	'ai_providers',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		type: text('type').notNull(),
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
		index('ai_providers_enabled_type_idx').on(table.enabled, table.type),
		check(
			'ai_providers_type_check',
			sql`${table.type} in ('chat_openai', 'image_gemini', 'image_openai', 'image_seedream', 'image_aliyun', 'tts_gemini', 'tts_seed', 'realtime_doubao', 'video_seedance')`
		),
		check('ai_providers_name_check', sql`length(${table.name}) > 0`),
		check('ai_providers_price_multiplier_check', sql`${table.priceMultiplier} > 0`),
		check('ai_providers_version_check', sql`${table.version} >= 1`)
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

export type BetaCode = typeof betaCode.$inferSelect
export type NewBetaCode = typeof betaCode.$inferInsert
export type SystemSettings = typeof systemSettings.$inferSelect
export type NewSystemSettings = typeof systemSettings.$inferInsert
export type PaymentProduct = typeof paymentProduct.$inferSelect
export type NewPaymentProduct = typeof paymentProduct.$inferInsert
export type AIProvider = typeof aiProvider.$inferSelect
export type NewAIProvider = typeof aiProvider.$inferInsert
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
