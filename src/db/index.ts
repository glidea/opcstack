import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from './schema.meta'
import * as authSchema from './schema.auth'
import * as shardSchema from './schema.shard'

export const dbSchema = { ...schema, ...authSchema }
export const shardDbSchema = { ...shardSchema }

export type MetaDb = DrizzleD1Database<typeof dbSchema> & {
	$client: D1RequestDb
}
export type TenantShardDb = DrizzleD1Database<typeof shardDbSchema> & {
	$client: D1RequestDb
}
export type D1RequestDb = D1Database | D1DatabaseSession
export type D1RawRunQuery = ReturnType<MetaDb['run']> | ReturnType<TenantShardDb['run']>
type D1BatchDb = {
	$client: D1RequestDb
}

export function getMetaDb(db: D1RequestDb): MetaDb {
	return drizzle(db as D1Database, { schema: dbSchema })
}

export function getTenantShardDb(db: D1RequestDb): TenantShardDb {
	return drizzle(db as D1Database, { schema: shardDbSchema })
}

export async function runRawD1Batch(
	db: D1BatchDb,
	queries: [D1RawRunQuery, ...D1RawRunQuery[]]
): Promise<D1Result[]> {
	const statements: D1PreparedStatement[] = queries.map((query): D1PreparedStatement => {
		const d1Query = query.getQuery()
		return db.$client.prepare(d1Query.sql).bind(...d1Query.params)
	})
	return db.$client.batch(statements)
}
