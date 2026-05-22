export type ShardDescriptor = {
	id: string
	bindingName: string
	databaseName: string
}

export function parseShardCount(raw: string | undefined): number

export function buildShardDescriptors(appName: string, count: number): ShardDescriptor[]

export type D1DatabaseBinding = {
	binding: string
	database_name: string
	database_id: string
	migrations_dir: string
}

export function buildD1DatabaseBindings(
	appName: string,
	metaDatabaseId: string,
	shards: ShardDescriptor[],
	shardDatabaseIds?: Record<string, string>
): D1DatabaseBinding[]

export function tenantBindingName(index: number): string

export function tenantDatabaseName(appName: string, index: number): string
