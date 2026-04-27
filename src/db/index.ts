import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from './schema'
import * as authSchema from './schema.auth'

const dbSchema = { ...schema, ...authSchema }

export type AppDb = DrizzleD1Database<typeof dbSchema>
export type D1RequestDb = D1Database | D1DatabaseSession

export function getDb(db: D1RequestDb): AppDb {
	return drizzle(db as D1Database, { schema: dbSchema })
}
