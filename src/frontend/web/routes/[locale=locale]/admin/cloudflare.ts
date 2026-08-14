function createCloudflareBaseUrl(accountId: string): string | null {
	const valid: boolean = /^[0-9a-f]{32}$/i.test(accountId) && !/^0+$/.test(accountId)
	return valid ? `https://dash.cloudflare.com/${accountId}` : null
}

export function createCloudflareWorkerUrl(accountId: string, workerName: string): string | null {
	const baseUrl: string | null = createCloudflareBaseUrl(accountId)
	if (baseUrl === null || workerName === '') {
		return null
	}
	return `${baseUrl}/workers/services/view/${encodeURIComponent(workerName)}/production/observability`
}

export function createCloudflareQueuesUrl(accountId: string): string | null {
	const baseUrl: string | null = createCloudflareBaseUrl(accountId)
	return baseUrl === null ? null : `${baseUrl}/workers/queues`
}

export function createCloudflareDatabaseUrl(
	accountId: string,
	databaseId: string | null
): string | null {
	const baseUrl: string | null = createCloudflareBaseUrl(accountId)
	const validDatabaseId: boolean =
		databaseId !== null &&
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(databaseId) &&
		databaseId !== '00000000-0000-0000-0000-000000000000'
	return baseUrl === null || !validDatabaseId ? null : `${baseUrl}/workers/d1/${databaseId}`
}

export function createCloudflareBucketUrl(accountId: string, bucketName: string): string | null {
	const baseUrl: string | null = createCloudflareBaseUrl(accountId)
	if (baseUrl === null || bucketName === '') {
		return null
	}
	return `${baseUrl}/r2/default/buckets/${encodeURIComponent(bucketName)}`
}
