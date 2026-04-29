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
		check('credit_transactions_amount_not_zero', sql`${table.amount} != 0`)
	]
)

export const creditReferral = sqliteTable(
	'credit_referrals',
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
		index('credit_referrals_inviter_user_id_idx').on(table.inviterUserId),
		check('credit_referrals_not_self_invite', sql`${table.inviterUserId} != ${table.inviteeUserId}`)
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

export const feedback = sqliteTable(
	'feedbacks',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		type: text('type').notNull(),
		content: text('content').notNull(),
		createdAt: integer('created_at').notNull()
	},
	(table) => [
		index('feedbacks_user_id_idx').on(table.userId),
		index('feedbacks_created_at_idx').on(table.createdAt)
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

export type BetaCode = typeof betaCode.$inferSelect
export type NewBetaCode = typeof betaCode.$inferInsert
export type CreditEntry = typeof creditEntry.$inferSelect
export type NewCreditEntry = typeof creditEntry.$inferInsert
export type CreditTransaction = typeof creditTransaction.$inferSelect
export type NewCreditTransaction = typeof creditTransaction.$inferInsert
export type CreditReferral = typeof creditReferral.$inferSelect
export type NewCreditReferral = typeof creditReferral.$inferInsert
export type CreditRedemptionCode = typeof creditRedemptionCode.$inferSelect
export type NewCreditRedemptionCode = typeof creditRedemptionCode.$inferInsert
export type Feedback = typeof feedback.$inferSelect
export type NewFeedback = typeof feedback.$inferInsert
export type Notification = typeof notification.$inferSelect
export type NewNotification = typeof notification.$inferInsert
export type NotificationRead = typeof notificationRead.$inferSelect
export type NewNotificationRead = typeof notificationRead.$inferInsert
