import { describe, expect, test } from 'vitest'
import {
	createAITaskSearchParams,
	createAITaskUserHref,
	createCloudflareTaskLinks,
	extractR2Results,
	formatStoredJson,
	getAITaskStatusVariant,
	parseAITaskListQuery,
	type CloudflareResourceContext
} from './ai-tasks-page'

const cloudflare: CloudflareResourceContext = {
	accountId: '1234567890abcdef1234567890abcdef',
	workerName: 'opcstack',
	bucketName: 'opcstack',
	queues: {
		image: 'image-generate',
		tts: 'tts-generate',
		video: 'video-generate'
	}
}

describe('admin AI tasks page', (): void => {
	test('parses all filters and pagination from the URL', (): void => {
		const url = new URL(
			'https://example.com/en/admin/ai-tasks?task_type=video&id=task-1&user_id=user-1&status=failed&provider_type=video_seedance&provider_id=primary-video&model=v1&created_at_start=100&created_at_end=200&page=2'
		)

		expect({ query: parseAITaskListQuery(url) }).toEqual({
			query: {
				task_type: 'video',
				id: 'task-1',
				user_id: 'user-1',
				status: 'failed',
				provider_type: 'video_seedance',
				provider_id: 'primary-video',
				model: 'v1',
				created_at_start: 100,
				created_at_end: 200,
				page: 2,
				page_size: 20
			}
		})
	})

	test('serializes only active filters', (): void => {
		const params = createAITaskSearchParams({
			task_type: 'image',
			status: 'processing',
			page: 1,
			page_size: 20
		})

		expect({ search: params.toString() }).toEqual({
			search: 'task_type=image&status=processing'
		})
	})

	test('distinguishes processing, completed and failed states', (): void => {
		expect({
			processing: getAITaskStatusVariant('processing'),
			completed: getAITaskStatusVariant('completed'),
			failed: getAITaskStatusVariant('failed')
		}).toEqual({ processing: 'outline', completed: 'secondary', failed: 'destructive' })
	})

	test('creates task-specific Cloudflare links from persisted resource identifiers', (): void => {
		const links = createCloudflareTaskLinks(
			cloudflare,
			'11111111-2222-3333-4444-555555555555',
			'video'
		)

		expect(links).toEqual({
			queueName: 'video-generate',
			database:
				'https://dash.cloudflare.com/1234567890abcdef1234567890abcdef/workers/d1/11111111-2222-3333-4444-555555555555',
			queue:
				'https://dash.cloudflare.com/1234567890abcdef1234567890abcdef/workers/queues',
			bucket:
				'https://dash.cloudflare.com/1234567890abcdef1234567890abcdef/r2/default/buckets/opcstack',
			worker:
				'https://dash.cloudflare.com/1234567890abcdef1234567890abcdef/workers/services/view/opcstack/production/observability'
		})
	})

	test('hides Cloudflare links for local resource identifiers', (): void => {
		const links = createCloudflareTaskLinks(
			{ ...cloudflare, accountId: 'local' },
			'00000000-0000-0000-0000-000000000000',
			'image'
		)

		expect(links).toEqual({
			queueName: 'image-generate',
			database: null,
			queue: null,
			bucket: null,
			worker: null
		})
	})

	test('allows opening public R2 results but exposes only the path for private results', (): void => {
		const resultJson = JSON.stringify({
			images: [
				{
					r2: {
						key: 'public/generated/result.png',
						url: 'https://app.example.com/api/r2/public/generated/result.png'
					}
				},
				{
					r2: {
						key: 'private/user-1/generated/result.png',
						url: 'https://app.example.com/api/r2/private/user-1/generated/result.png'
					}
				}
			]
		})

		expect({ results: extractR2Results(resultJson) }).toEqual({
			results: [
				{
					key: 'public/generated/result.png',
					isPublic: true,
					openUrl: 'https://app.example.com/api/r2/public/generated/result.png'
				},
				{
					key: 'private/user-1/generated/result.png',
					isPublic: false,
					openUrl: null
				}
			]
		})
	})

	test('formats persisted JSON without changing its data', (): void => {
		expect({ json: formatStoredJson('{"prompt":"hello","count":1}') }).toEqual({
			json: '{\n  "prompt": "hello",\n  "count": 1\n}'
		})
	})

	test('links a task user to the filtered user directory', (): void => {
		expect({ href: createAITaskUserHref('zh', 'user 1') }).toEqual({
			href: '/zh/admin/users?search=user%201'
		})
	})
})
