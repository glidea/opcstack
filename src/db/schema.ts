import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const betaCode = sqliteTable('beta_code', {
	id: text('id').primaryKey(),
	code: text('code').notNull().unique(),
	usedBy: text('used_by'),
	usedAt: integer('used_at'),
	createdAt: integer('created_at').notNull()
})

export type BetaCode = typeof betaCode.$inferSelect
export type NewBetaCode = typeof betaCode.$inferInsert
