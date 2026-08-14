import type {
	AITaskType,
	ListAITasksRequest
} from '$apiContract/ai'
import {
	createCloudflareBucketUrl,
	createCloudflareDatabaseUrl,
	createCloudflareQueuesUrl,
	createCloudflareWorkerUrl
} from '../cloudflare'

export type AITaskStatusVariant = 'outline' | 'secondary' | 'destructive'

export type CloudflareResourceContext = {
	accountId: string
	workerName: string
	bucketName: string
	queues: Record<AITaskType, string>
}

export type CloudflareTaskLinks = {
	queueName: string
	database: string | null
	queue: string | null
	bucket: string | null
	worker: string | null
}

export type R2TaskResult = {
	key: string
	isPublic: boolean
	openUrl: string | null
}

export function parseAITaskListQuery(url: URL): ListAITasksRequest {
	const taskType: string = url.searchParams.get('task_type')?.trim() ?? ''
	const id: string = url.searchParams.get('id')?.trim() ?? ''
	const userId: string = url.searchParams.get('user_id')?.trim() ?? ''
	const status: string = url.searchParams.get('status')?.trim() ?? ''
	const providerType: string = url.searchParams.get('provider_type')?.trim() ?? ''
	const providerId: string = url.searchParams.get('provider_id')?.trim() ?? ''
	const model: string = url.searchParams.get('model')?.trim() ?? ''
	const rawPage: number = Number(url.searchParams.get('page') ?? '1')
	return {
		...(isAITaskType(taskType) ? { task_type: taskType } : {}),
		...(id === '' ? {} : { id }),
		...(userId === '' ? {} : { user_id: userId }),
		...(status === '' ? {} : { status }),
		...(providerType === '' ? {} : { provider_type: providerType }),
		...(providerId === '' ? {} : { provider_id: providerId }),
		...(model === '' ? {} : { model }),
		...readTimestamp(url.searchParams, 'created_at_start'),
		...readTimestamp(url.searchParams, 'created_at_end'),
		page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
		page_size: 20
	}
}

export function createAITaskSearchParams(input: ListAITasksRequest): URLSearchParams {
	const params: URLSearchParams = new URLSearchParams()
	const entries: [string, string | number | undefined][] = [
		['task_type', input.task_type],
		['id', input.id],
		['user_id', input.user_id],
		['status', input.status],
		['provider_type', input.provider_type],
		['provider_id', input.provider_id],
		['model', input.model],
		['created_at_start', input.created_at_start],
		['created_at_end', input.created_at_end]
	]
	for (const [name, value] of entries) {
		if (value !== undefined && value !== '') {
			params.set(name, String(value))
		}
	}
	if ((input.page ?? 1) > 1) {
		params.set('page', String(input.page))
	}
	return params
}

export function getAITaskStatusVariant(status: string): AITaskStatusVariant {
	switch (status) {
		case 'completed':
			return 'secondary'
		case 'failed':
			return 'destructive'
		default:
			return 'outline'
	}
}

export function createAITaskUserHref(locale: string, userId: string): string {
	return `/${locale}/admin/users?search=${encodeURIComponent(userId)}`
}

export function createCloudflareTaskLinks(
	context: CloudflareResourceContext,
	databaseId: string | null,
	taskType: AITaskType
): CloudflareTaskLinks {
	const queueName: string = context.queues[taskType]
	return {
		queueName,
		database: createCloudflareDatabaseUrl(context.accountId, databaseId),
		queue: createCloudflareQueuesUrl(context.accountId),
		bucket: createCloudflareBucketUrl(context.accountId, context.bucketName),
		worker: createCloudflareWorkerUrl(context.accountId, context.workerName)
	}
}

export function extractR2Results(resultJson: string | null): R2TaskResult[] {
	if (resultJson === null) {
		return []
	}
	const value: unknown = JSON.parse(resultJson)
	const results: R2TaskResult[] = []
	collectR2Results(value, results)
	return results
}

export function formatStoredJson(value: string): string {
	const parsed: unknown = JSON.parse(value)
	return JSON.stringify(parsed, null, 2)
}

function collectR2Results(value: unknown, results: R2TaskResult[]): void {
	if (Array.isArray(value)) {
		for (const item of value) {
			collectR2Results(item, results)
		}
		return
	}
	if (typeof value !== 'object' || value === null) {
		return
	}

	const object: Record<string, unknown> = value as Record<string, unknown>
	const r2Value: unknown = object['r2']
	if (typeof r2Value === 'object' && r2Value !== null) {
		const r2: Record<string, unknown> = r2Value as Record<string, unknown>
		if (typeof r2['key'] === 'string') {
			const key: string = r2['key']
			const isPublic: boolean = key.startsWith('public/') || key.startsWith('tmp/public/')
			const storedUrl: string | null = typeof r2['url'] === 'string' ? r2['url'] : null
			results.push({
				key,
				isPublic,
				openUrl: isPublic ? storedUrl ?? `/api/r2/${key}` : null
			})
		}
	}

	for (const nestedValue of Object.values(object)) {
		collectR2Results(nestedValue, results)
	}
}

function isAITaskType(value: string): value is AITaskType {
	switch (value) {
		case 'image':
		case 'tts':
		case 'video':
			return true
		default:
			return false
	}
}

function readTimestamp(params: URLSearchParams, name: string): Record<string, number> {
	const value: string | null = params.get(name)
	if (value === null || value === '') {
		return {}
	}
	const parsed: number = Number(value)
	return Number.isInteger(parsed) ? { [name]: parsed } : {}
}
