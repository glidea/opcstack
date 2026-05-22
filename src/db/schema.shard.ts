import { sql } from 'drizzle-orm'
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const creditBalance = sqliteTable('credit_balances', {
	userId: text('user_id').primaryKey(),
	balance: integer('balance').notNull().default(0),
	updatedAt: integer('updated_at').notNull()
})

export const creditEntry = sqliteTable(
	'credit_entries',
	{
		id: text('id').primaryKey(),
		userId: text('user_id').notNull(),
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
		userId: text('user_id').notNull(),
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

export const feedback = sqliteTable(
	'feedbacks',
	{
		id: text('id').primaryKey(),
		userId: text('user_id').notNull(),
		type: text('type').notNull(),
		content: text('content').notNull(),
		createdAt: integer('created_at').notNull()
	},
	(table) => [
		index('feedbacks_user_id_idx').on(table.userId),
		index('feedbacks_created_at_idx').on(table.createdAt)
	]
)

export const notificationRead = sqliteTable(
	'notification_reads',
	{
		notificationId: text('notification_id').notNull(),
		userId: text('user_id').notNull(),
		readAt: integer('read_at').notNull()
	},
	(table) => [
		primaryKey({ columns: [table.notificationId, table.userId] }),
		index('notification_reads_user_id_idx').on(table.userId)
	]
)

export type CreditBalance = typeof creditBalance.$inferSelect
export type NewCreditBalance = typeof creditBalance.$inferInsert
export type CreditEntry = typeof creditEntry.$inferSelect
export type NewCreditEntry = typeof creditEntry.$inferInsert
export type CreditTransaction = typeof creditTransaction.$inferSelect
export type NewCreditTransaction = typeof creditTransaction.$inferInsert
export type Feedback = typeof feedback.$inferSelect
export type NewFeedback = typeof feedback.$inferInsert
export type NotificationRead = typeof notificationRead.$inferSelect
export type NewNotificationRead = typeof notificationRead.$inferInsert
