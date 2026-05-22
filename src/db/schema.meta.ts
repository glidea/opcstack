import { sql } from 'drizzle-orm'
import {
	check,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core'
import { user } from './schema.auth'

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

export const creditEntry = sqliteTable(
	'credit_entries',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		amount: integer('amount').notNull(),
		remainingAmount: integer('remaining_amount').notNull(),
		sourceType: text('source_type').notNull(),
		sourceId: text('source_id').notNull(),
		expiresAt: integer('expires_at'),
		createdAt: integer('created_at').notNull()
	},
	(table) => [
		index('credit_entries_user_id_idx').on(table.userId),
		index('credit_entries_remaining_amount_idx').on(table.remainingAmount),
		index('credit_entries_expires_at_idx').on(table.expiresAt),
		index('credit_entries_created_at_idx').on(table.createdAt),
		uniqueIndex('credit_entries_source_type_source_id_unique').on(table.sourceType, table.sourceId),
		check('credit_entries_amount_gt_zero', sql`${table.amount} > 0`),
		check('credit_entries_remaining_amount_non_negative', sql`${table.remainingAmount} >= 0`),
		check('credit_entries_remaining_amount_lte_amount', sql`${table.remainingAmount} <= ${table.amount}`)
	]
)

export const creditTransaction = sqliteTable(
	'credit_transactions',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		type: text('type').notNull(),
		amount: integer('amount').notNull(),
		balanceAfter: integer('balance_after').notNull(),
		sourceType: text('source_type'),
		sourceId: text('source_id'),
		description: text('description'),
		expiresAt: integer('expires_at'),
		createdAt: integer('created_at').notNull()
	},
	(table) => [
		index('credit_transactions_user_id_idx').on(table.userId),
		index('credit_transactions_type_idx').on(table.type),
		index('credit_transactions_created_at_idx').on(table.createdAt),
		index('credit_transactions_user_id_created_at_idx').on(table.userId, table.createdAt),
		uniqueIndex('credit_transactions_source_type_source_id_unique').on(table.sourceType, table.sourceId),
		check('credit_transactions_amount_not_zero', sql`${table.amount} != 0`)
	]
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
		expiresAt: integer('expires_at'),
		usedBy: text('used_by').references(() => user.id, { onDelete: 'set null' }),
		usedAt: integer('used_at'),
		createdAt: integer('created_at').notNull()
	},
	(table) => [
		index('credit_redemption_codes_expires_at_idx').on(table.expiresAt),
		index('credit_redemption_codes_used_by_idx').on(table.usedBy),
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

export const notificationRead = sqliteTable(
	'notification_reads',
	{
		notificationId: text('notification_id')
			.notNull()
			.references(() => notification.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		readAt: integer('read_at').notNull()
	},
	(table) => [
		primaryKey({ columns: [table.notificationId, table.userId] }),
		index('notification_reads_user_id_idx').on(table.userId)
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
export type D1Shard = typeof d1Shard.$inferSelect
export type NewD1Shard = typeof d1Shard.$inferInsert
export type UserShard = typeof userShard.$inferSelect
export type NewUserShard = typeof userShard.$inferInsert
export type CreditEntry = typeof creditEntry.$inferSelect
export type NewCreditEntry = typeof creditEntry.$inferInsert
export type CreditTransaction = typeof creditTransaction.$inferSelect
export type NewCreditTransaction = typeof creditTransaction.$inferInsert
export type AffReferral = typeof affReferral.$inferSelect
export type NewAffReferral = typeof affReferral.$inferInsert
export type CreditRedemptionCode = typeof creditRedemptionCode.$inferSelect
export type NewCreditRedemptionCode = typeof creditRedemptionCode.$inferInsert
export type Notification = typeof notification.$inferSelect
export type NewNotification = typeof notification.$inferInsert
export type NotificationRead = typeof notificationRead.$inferSelect
export type NewNotificationRead = typeof notificationRead.$inferInsert
export type CheckoutOrder = typeof checkoutOrder.$inferSelect
export type NewCheckoutOrder = typeof checkoutOrder.$inferInsert
export type PaymentTransaction = typeof paymentTransaction.$inferSelect
export type NewPaymentTransaction = typeof paymentTransaction.$inferInsert
export type UserSubscription = typeof userSubscription.$inferSelect
export type NewUserSubscription = typeof userSubscription.$inferInsert
export type PaymentWebhookEvent = typeof paymentWebhookEvent.$inferSelect
export type NewPaymentWebhookEvent = typeof paymentWebhookEvent.$inferInsert
