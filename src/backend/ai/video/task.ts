import { eq } from 'drizzle-orm'
import { aiVideoTask, type AIVideoTaskRow } from '../../db/schema.shard'
import type { TenantShardDb } from '../../db'
import type {
	AIVideoGenerateInput,
	AIVideoReference,
	AIVideoResult,
	AIVideoTask,
	AIVideoTaskStatus
} from '.'
import type { AIVideoProviderType } from '../config'

export const AI_VIDEO_QUEUE_NAME = 'video-generate'

export interface AIVideoGenerateQueueMessage {
	taskId: string
	userId: string
}

export async function createAIVideoTask(
	env: Env,
	db: TenantShardDb,
	providerType: AIVideoProviderType,
	model: string,
	userId: string,
	input: AIVideoGenerateInput
): Promise<AIVideoTask> {
	const now: number = Date.now()
	const id: string = crypto.randomUUID()
	const r2UploadIsPublic: boolean = input.r2UploadIsPublic ?? false
	await db.insert(aiVideoTask).values({
		id,
		userId,
		status: 'processing',
		providerType,
		model,
		prompt: input.prompt,
		ratio: input.ratio,
		resolution: input.resolution,
		duration: input.duration,
		r2UploadDir: input.r2UploadDir,
		r2UploadIsPublic: r2UploadIsPublic ? 1 : 0,
		referencesJson: JSON.stringify(input.references ?? []),
		createdAt: now,
		updatedAt: now
	})

	await env.Q_VIDEO_GENERATE.send({
		taskId: id,
		userId
	})

	return {
		id,
		userId,
		status: 'processing',
		providerType,
		model,
		prompt: input.prompt,
		ratio: input.ratio,
		resolution: input.resolution,
		duration: input.duration,
		r2UploadDir: input.r2UploadDir,
		r2UploadIsPublic,
		references: input.references ?? [],
		attemptCount: 0,
		createdAt: now,
		updatedAt: now
	}
}

export async function getAIVideoTask(
	db: TenantShardDb,
	id: string
): Promise<AIVideoTask | undefined> {
	const row: AIVideoTaskRow | undefined = await db.query.aiVideoTask.findFirst({
		where: eq(aiVideoTask.id, id)
	})
	if (!row) {
		return undefined
	}

	return toAIVideoTask(row)
}

export function toAIVideoTask(row: AIVideoTaskRow): AIVideoTask {
	return {
		id: row.id,
		userId: row.userId,
		status: row.status as AIVideoTaskStatus,
		providerType: row.providerType as AIVideoProviderType,
		providerId: row.providerId ?? undefined,
		model: row.model ?? undefined,
		prompt: row.prompt,
		ratio: row.ratio as AIVideoTask['ratio'],
		resolution: row.resolution as AIVideoTask['resolution'],
		duration: row.duration,
		r2UploadDir: row.r2UploadDir ?? undefined,
		r2UploadIsPublic: row.r2UploadIsPublic === 1,
		references: JSON.parse(row.referencesJson) as AIVideoReference[],
		result: row.resultJson ? (JSON.parse(row.resultJson) as { video: AIVideoResult }) : undefined,
		attemptCount: row.attemptCount,
		lastErrorMessage: row.lastErrorMessage ?? undefined,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		completedAt: row.completedAt ?? undefined
	}
}
