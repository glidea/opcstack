export function parseShardCount(raw) {
	if (raw === undefined || raw === '') {
		return 1
	}

	const count = Number(raw)
	if (!Number.isInteger(count) || count < 1) {
		throw new Error('D1_SHARD_COUNT_INVALID')
	}

	return count
}

export function buildShardDescriptors(appName, count) {
	const shards = []
	let index = 0
	while (index < count) {
		const suffix = shardSuffix(index)
		shards.push({
			id: `shard_${suffix}`,
			bindingName: tenantBindingName(index),
			databaseName: tenantDatabaseName(appName, index)
		})
		index += 1
	}
	return shards
}

export function buildD1DatabaseBindings(appName, metaDatabaseId, shards, shardDatabaseIds = {}) {
	const bindings = [
		{
			binding: 'META_DB',
			database_name: `${appName}-meta`,
			database_id: metaDatabaseId,
			migrations_dir: 'src/db/meta-migrations'
		}
	]

	for (const shard of shards) {
		bindings.push({
			binding: shard.bindingName,
			database_name: shard.databaseName,
			database_id: shardDatabaseIds[shard.id] ?? '00000000-0000-0000-0000-000000000000',
			migrations_dir: 'src/db/shard-migrations'
		})
	}

	return bindings
}

export function tenantBindingName(index) {
	return `TENANT_DB_${shardSuffix(index)}`
}

export function tenantDatabaseName(appName, index) {
	return `${appName}-shard-${shardSuffix(index)}`
}

function shardSuffix(index) {
	return String(index).padStart(4, '0')
}
