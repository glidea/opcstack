import { and, desc, eq, gte, lte, type SQL } from 'drizzle-orm'
import type { Context } from 'hono'
import type { ApiEnv } from '..'
import {
	GetAdminAiTaskApi,
	type AdminAiImageTask,
	type AdminAiTaskSummary,
	type AdminAiTaskType,
	type AdminAiTtsTask,
	type AdminAiVideoTask,
	type GetAdminAiTaskResponse,
	ListAdminAiTasksApi,
	type ListAdminAiTasksRequest,
	type ListAdminAiTasksResponse
} from '../../../api-contract/admin-ai-tasks'
import { createTenantShardAccess, type TenantShardClient } from '../../db/shard-router'
import {
	aiImageTask,
	aiTtsTask,
	aiVideoTask,
	type AIImageTaskRow,
	type AITTSTaskRow,
	type AIVideoTaskRow
} from '../../db/schema.shard'
import { parseRequest } from '../../lib/request'

type CommonTaskRow = {
	id: string
	userId: string
	status: string
	providerType: string
	providerId: string | null
	model: string | null
	attemptCount: number
	lastErrorMessage: string | null
	createdAt: number
	updatedAt: number
	completedAt: number | null
}

export async function listAdminAiTasksHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, ListAdminAiTasksApi.request)
	if (!request.success) {
		const error = ListAdminAiTasksApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	const req: ListAdminAiTasksRequest = request.data
	const shards: TenantShardClient[] = await createTenantShardAccess(
		ctx.get('metaDb'),
		ctx.env
	).listShardDbs()
	const items: AdminAiTaskSummary[] = []

	for (const shard of shards) {
		if (req.task_type === undefined || req.task_type === 'image') {
			const rows: AIImageTaskRow[] = await shard.db.query.aiImageTask.findMany({
				where: buildImageConditions(req),
				orderBy: [desc(aiImageTask.createdAt)]
			})
			items.push(...rows.map((row: AIImageTaskRow): AdminAiTaskSummary => {
				return toTaskSummary('image', shard.shardId, row)
			}))
		}
		if (req.task_type === undefined || req.task_type === 'tts') {
			const rows: AITTSTaskRow[] = await shard.db.query.aiTtsTask.findMany({
				where: buildTtsConditions(req),
				orderBy: [desc(aiTtsTask.createdAt)]
			})
			items.push(...rows.map((row: AITTSTaskRow): AdminAiTaskSummary => {
				return toTaskSummary('tts', shard.shardId, row)
			}))
		}
		if (req.task_type === undefined || req.task_type === 'video') {
			const rows: AIVideoTaskRow[] = await shard.db.query.aiVideoTask.findMany({
				where: buildVideoConditions(req),
				orderBy: [desc(aiVideoTask.createdAt)]
			})
			items.push(...rows.map((row: AIVideoTaskRow): AdminAiTaskSummary => {
				return toTaskSummary('video', shard.shardId, row)
			}))
		}
	}

	items.sort((left: AdminAiTaskSummary, right: AdminAiTaskSummary): number => {
		return right.created_at - left.created_at
	})
	const offset: number = (req.page - 1) * req.page_size
	return ctx.json({
		items: items.slice(offset, offset + req.page_size),
		total: items.length
	} as ListAdminAiTasksResponse)
}

export async function getAdminAiTaskHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, GetAdminAiTaskApi.request)
	if (!request.success) {
		const error = GetAdminAiTaskApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}

	const shards: TenantShardClient[] = await createTenantShardAccess(
		ctx.get('metaDb'),
		ctx.env
	).listShardDbs()
	const shard: TenantShardClient | undefined = shards.find((item: TenantShardClient): boolean => {
		return item.shardId === request.data.shard_id
	})
	if (shard === undefined) {
		const error = GetAdminAiTaskApi.errors.AI_TASK_NOT_FOUND()
		return ctx.json(error.body, error.status)
	}

	switch (request.data.task_type) {
		case 'image': {
			const row: AIImageTaskRow | undefined = await shard.db.query.aiImageTask.findFirst({
				where: eq(aiImageTask.id, request.data.id)
			})
			if (row !== undefined) {
				return ctx.json({ task: toImageTask(shard.shardId, row) } as GetAdminAiTaskResponse)
			}
			break
		}
		case 'tts': {
			const row: AITTSTaskRow | undefined = await shard.db.query.aiTtsTask.findFirst({
				where: eq(aiTtsTask.id, request.data.id)
			})
			if (row !== undefined) {
				return ctx.json({ task: toTtsTask(shard.shardId, row) } as GetAdminAiTaskResponse)
			}
			break
		}
		case 'video': {
			const row: AIVideoTaskRow | undefined = await shard.db.query.aiVideoTask.findFirst({
				where: eq(aiVideoTask.id, request.data.id)
			})
			if (row !== undefined) {
				return ctx.json({ task: toVideoTask(shard.shardId, row) } as GetAdminAiTaskResponse)
			}
			break
		}
	}

	const error = GetAdminAiTaskApi.errors.AI_TASK_NOT_FOUND()
	return ctx.json(error.body, error.status)
}

function buildImageConditions(req: ListAdminAiTasksRequest): SQL | undefined {
	const conditions: SQL[] = []
	if (req.id !== undefined) {
		conditions.push(eq(aiImageTask.id, req.id))
	}
	if (req.user_id !== undefined) {
		conditions.push(eq(aiImageTask.userId, req.user_id))
	}
	if (req.status !== undefined) {
		conditions.push(eq(aiImageTask.status, req.status))
	}
	if (req.provider_type !== undefined) {
		conditions.push(eq(aiImageTask.providerType, req.provider_type))
	}
	if (req.provider_id !== undefined) {
		conditions.push(eq(aiImageTask.providerId, req.provider_id))
	}
	if (req.model !== undefined) {
		conditions.push(eq(aiImageTask.model, req.model))
	}
	if (req.created_at_start !== undefined) {
		conditions.push(gte(aiImageTask.createdAt, req.created_at_start))
	}
	if (req.created_at_end !== undefined) {
		conditions.push(lte(aiImageTask.createdAt, req.created_at_end))
	}
	return conditions.length === 0 ? undefined : and(...conditions)
}

function buildTtsConditions(req: ListAdminAiTasksRequest): SQL | undefined {
	const conditions: SQL[] = []
	if (req.id !== undefined) {
		conditions.push(eq(aiTtsTask.id, req.id))
	}
	if (req.user_id !== undefined) {
		conditions.push(eq(aiTtsTask.userId, req.user_id))
	}
	if (req.status !== undefined) {
		conditions.push(eq(aiTtsTask.status, req.status))
	}
	if (req.provider_type !== undefined) {
		conditions.push(eq(aiTtsTask.providerType, req.provider_type))
	}
	if (req.provider_id !== undefined) {
		conditions.push(eq(aiTtsTask.providerId, req.provider_id))
	}
	if (req.model !== undefined) {
		conditions.push(eq(aiTtsTask.model, req.model))
	}
	if (req.created_at_start !== undefined) {
		conditions.push(gte(aiTtsTask.createdAt, req.created_at_start))
	}
	if (req.created_at_end !== undefined) {
		conditions.push(lte(aiTtsTask.createdAt, req.created_at_end))
	}
	return conditions.length === 0 ? undefined : and(...conditions)
}

function buildVideoConditions(req: ListAdminAiTasksRequest): SQL | undefined {
	const conditions: SQL[] = []
	if (req.id !== undefined) {
		conditions.push(eq(aiVideoTask.id, req.id))
	}
	if (req.user_id !== undefined) {
		conditions.push(eq(aiVideoTask.userId, req.user_id))
	}
	if (req.status !== undefined) {
		conditions.push(eq(aiVideoTask.status, req.status))
	}
	if (req.provider_type !== undefined) {
		conditions.push(eq(aiVideoTask.providerType, req.provider_type))
	}
	if (req.provider_id !== undefined) {
		conditions.push(eq(aiVideoTask.providerId, req.provider_id))
	}
	if (req.model !== undefined) {
		conditions.push(eq(aiVideoTask.model, req.model))
	}
	if (req.created_at_start !== undefined) {
		conditions.push(gte(aiVideoTask.createdAt, req.created_at_start))
	}
	if (req.created_at_end !== undefined) {
		conditions.push(lte(aiVideoTask.createdAt, req.created_at_end))
	}
	return conditions.length === 0 ? undefined : and(...conditions)
}

function toTaskSummary(
	taskType: AdminAiTaskType,
	shardId: string,
	row: CommonTaskRow
): AdminAiTaskSummary {
	return {
		task_type: taskType,
		shard_id: shardId,
		id: row.id,
		user_id: row.userId,
		status: row.status,
		provider_type: row.providerType,
		provider_id: row.providerId,
		model: row.model,
		attempt_count: row.attemptCount,
		last_error_message: row.lastErrorMessage,
		created_at: row.createdAt,
		updated_at: row.updatedAt,
		completed_at: row.completedAt
	}
}

function toImageTask(shardId: string, row: AIImageTaskRow): AdminAiImageTask {
	return {
		...toTaskSummary('image', shardId, row),
		task_type: 'image',
		prompt: row.prompt,
		number_of_images: row.numberOfImages,
		aspect_ratio: row.aspectRatio,
		image_size: row.imageSize,
		low_censorship: row.lowCensorship === 1,
		upload_to_r2: row.uploadToR2 === 1,
		r2_upload_dir: row.r2UploadDir,
		r2_upload_is_public: row.r2UploadIsPublic === 1,
		references_json: row.referencesJson,
		result_json: row.resultJson
	}
}

function toTtsTask(shardId: string, row: AITTSTaskRow): AdminAiTtsTask {
	return {
		...toTaskSummary('tts', shardId, row),
		task_type: 'tts',
		source_json: row.sourceJson,
		instruction: row.instruction,
		speakers_json: row.speakersJson,
		lines_json: row.linesJson,
		upload_to_r2: row.uploadToR2 === 1,
		result_json: row.resultJson
	}
}

function toVideoTask(shardId: string, row: AIVideoTaskRow): AdminAiVideoTask {
	return {
		...toTaskSummary('video', shardId, row),
		task_type: 'video',
		prompt: row.prompt,
		ratio: row.ratio,
		resolution: row.resolution,
		duration: row.duration,
		r2_upload_dir: row.r2UploadDir,
		r2_upload_is_public: row.r2UploadIsPublic === 1,
		references_json: row.referencesJson,
		provider_task_id: row.providerTaskId,
		result_json: row.resultJson
	}
}
