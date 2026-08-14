import { describe, expect, test } from 'vitest'
import {
	createCloudflareDatabaseUrl,
	createCloudflareQueuesUrl,
	createCloudflareWorkerUrl
} from './cloudflare'

const accountId: string = '1234567890abcdef1234567890abcdef'

describe('admin Cloudflare links', (): void => {
	test('links operators to the exact Worker observability view', (): void => {
		expect({ url: createCloudflareWorkerUrl(accountId, 'opcstack') }).toEqual({
			url: 'https://dash.cloudflare.com/1234567890abcdef1234567890abcdef/workers/services/view/opcstack/production/observability'
		})
	})

	test('links AI operations to the queues dashboard', (): void => {
		expect({ url: createCloudflareQueuesUrl(accountId) }).toEqual({
			url: 'https://dash.cloudflare.com/1234567890abcdef1234567890abcdef/workers/queues'
		})
	})

	test('links a tenant shard to its exact D1 database', (): void => {
		expect({
			url: createCloudflareDatabaseUrl(
				accountId,
				'11111111-2222-3333-4444-555555555555'
			)
		}).toEqual({
			url: 'https://dash.cloudflare.com/1234567890abcdef1234567890abcdef/workers/d1/11111111-2222-3333-4444-555555555555'
		})
	})

	test('does not expose broken links for local resources', (): void => {
		expect({
			worker: createCloudflareWorkerUrl('local', 'opcstack'),
			queues: createCloudflareQueuesUrl('local'),
			database: createCloudflareDatabaseUrl(
				'local',
				'00000000-0000-0000-0000-000000000001'
			)
		}).toEqual({ worker: null, queues: null, database: null })
	})
})
