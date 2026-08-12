import type { AIEndpoint } from '../../endpoint'
import { AIError } from '../../error'
import type { TenantShardDb } from '../../../db'
import { resolveVideoReferences, type AIResolvedVideoReference } from '../reference'
import { createAIVideoTask, getAIVideoTask } from '../task'
import type {
	AISimpleVideoClient,
	AISimpleVideoClientOptions,
	AIVideoGenerateInput,
	AIVideoProviderTaskResult,
	AIVideoTask
} from '..'

type SeedDanceCreateTaskResponse = {
	id?: string
	task_id?: string
}

type SeedDanceGetTaskResponse = {
	status: string
	content?: {
		video_url?: string
		videoUrl?: string
	}
	error?: {
		code?: string
		message?: string
	}
}

type SeedDanceContentItem =
	| {
			type: 'text'
			text: string
	  }
	| {
			type: 'image_url'
			image_url: {
				url: string
			}
			role: 'reference_image'
	  }
	| {
			type: 'video_url'
			video_url: {
				url: string
			}
			role: 'reference_video'
	  }
	| {
			type: 'audio_url'
			audio_url: {
				url: string
			}
			role: 'reference_audio'
	  }

type SeedDanceCreateTaskRequest = {
	model: string
	content: SeedDanceContentItem[]
	ratio: string
	resolution?: string
	duration: number
	generate_audio: true
	watermark: false
}

export function createSeedDanceSimpleVideoClient(
	env: Env,
	userId: string,
	tenantDb: TenantShardDb,
	options: AISimpleVideoClientOptions
): AISimpleVideoClient {
	return new seedDanceSimpleVideoClient(env, userId, tenantDb, options)
}

class seedDanceSimpleVideoClient implements AISimpleVideoClient {
	private readonly env: Env
	private readonly userId: string
	private readonly tenantDb: TenantShardDb
	private readonly model: string

	constructor(
		env: Env,
		userId: string,
		tenantDb: TenantShardDb,
		options: AISimpleVideoClientOptions
	) {
		this.env = env
		this.userId = userId
		this.tenantDb = tenantDb
		this.model = options.model
	}

	async generate(input: AIVideoGenerateInput): Promise<AIVideoTask> {
		return createAIVideoTask(this.env, this.tenantDb, 'seedance', this.model, this.userId, input)
	}

	async getTask(id: string): Promise<AIVideoTask | undefined> {
		return getAIVideoTask(this.tenantDb, id)
	}
}

export async function createSeedDanceProviderTask(
	env: Env,
	userId: string,
	model: string,
	input: AIVideoGenerateInput,
	endpoint: AIEndpoint
): Promise<string> {
	const references: AIResolvedVideoReference[] = await resolveVideoReferences(
		env,
		userId,
		input.references
	)
	const response: Response = await fetch(`${trimRightSlash(endpoint.baseURL)}/contents/generations/tasks`, {
		method: 'POST',
		headers: {
			authorization: `Bearer ${endpoint.apiKey}`,
			'content-type': 'application/json'
		},
		body: JSON.stringify(toCreateTaskRequest(model, input, references))
	})
	if (!response.ok) {
		throw new AIError('SEEDDANCE_CREATE_TASK_FAILED')
	}

	const body: SeedDanceCreateTaskResponse = await response.json()
	const providerTaskId: string | undefined = body.id ?? body.task_id
	if (!providerTaskId) {
		throw new AIError('SEEDDANCE_CREATE_TASK_ID_MISSING')
	}
	return providerTaskId
}

export async function getSeedDanceProviderTask(
	providerTaskId: string,
	endpoint: AIEndpoint
): Promise<AIVideoProviderTaskResult> {
	const response: Response = await fetch(`${trimRightSlash(endpoint.baseURL)}/contents/generations/tasks/${providerTaskId}`, {
		method: 'GET',
		headers: {
			authorization: `Bearer ${endpoint.apiKey}`
		}
	})
	if (!response.ok) {
		throw new AIError('SEEDDANCE_GET_TASK_FAILED')
	}

	const body: SeedDanceGetTaskResponse = await response.json()
	switch (body.status) {
		case 'failed':
			return {
				status: 'failed',
				errorMessage: body.error?.message ?? body.error?.code ?? 'SEEDDANCE_VIDEO_GENERATION_FAILED'
			}
		case 'succeeded': {
			const videoUrl: string | undefined = body.content?.video_url ?? body.content?.videoUrl
			if (!videoUrl) {
				throw new AIError('SEEDDANCE_VIDEO_URL_MISSING')
			}
			return {
				status: 'completed',
				videoUrl
			}
		}
		default:
			return {
				status: 'running'
			}
	}
}

function toCreateTaskRequest(
	model: string,
	input: AIVideoGenerateInput,
	references: AIResolvedVideoReference[]
): SeedDanceCreateTaskRequest {
	return {
		model,
		content: toSeedDanceContent(input.prompt, references),
		ratio: input.ratio ?? 'adaptive',
		resolution: input.resolution,
		duration: input.duration,
		generate_audio: true,
		watermark: false
	}
}

function toSeedDanceContent(
	prompt: string,
	references: AIResolvedVideoReference[]
): SeedDanceContentItem[] {
	const content: SeedDanceContentItem[] = [{ type: 'text', text: prompt }]
	for (const reference of references) {
		switch (reference.type) {
			case 'image':
				content.push({
					type: 'image_url',
					image_url: { url: reference.url },
					role: 'reference_image'
				})
				break
			case 'video':
				content.push({
					type: 'video_url',
					video_url: { url: reference.url },
					role: 'reference_video'
				})
				break
			case 'audio':
				content.push({
					type: 'audio_url',
					audio_url: { url: reference.url },
					role: 'reference_audio'
				})
				break
		}
	}
	return content
}

function trimRightSlash(rawUrl: string): string {
	if (rawUrl.endsWith('/')) {
		return rawUrl.slice(0, -1)
	}
	return rawUrl
}
