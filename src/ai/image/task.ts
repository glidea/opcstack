import { eq } from 'drizzle-orm'
import { aiImageTask, type AIImageTaskRow } from '../../db/schema.shard'
import type { TenantShardDb } from '../../db'
import type {
	AIImageReference,
	AIImageResult,
	AIImageTask,
	AIImageProvider,
	AIImageTaskStatus,
	AISimpleImageClientGenerateInput
} from '.'

export const AI_IMAGE_QUEUE_NAME = 'image-generate'

export interface AIImageGenerateQueueMessage {
	taskId: string
	userId: string
}

export async function createAIImageTask(
	env: Env,
	db: TenantShardDb,
	provider: AIImageProvider,
	model: string,
	userId: string,
	input: AISimpleImageClientGenerateInput
): Promise<AIImageTask> {
	const now = Date.now()
	const id = crypto.randomUUID()
	const r2UploadIsPublic = input.r2UploadIsPublic ?? false
	await db.insert(aiImageTask).values({
		id,
		userId,
		status: 'processing',
		provider,
		model,
		prompt: input.prompt,
		numberOfImages: input.numberOfImages,
		aspectRatio: input.aspectRatio,
		imageSize: input.imageSize,
		lowCensorship: input.lowCensorship ? 1 : 0,
		uploadToR2: input.uploadToR2 ? 1 : 0,
		r2UploadDir: input.r2UploadDir,
		r2UploadIsPublic: r2UploadIsPublic ? 1 : 0,
		referencesJson: JSON.stringify(input.references ?? []),
		createdAt: now,
		updatedAt: now
	})

	await env.Q_IMAGE_GENERATE.send({
		taskId: id,
		userId
	})

	return {
		id,
		userId,
		status: 'processing',
		provider,
		model,
		prompt: input.prompt,
		numberOfImages: input.numberOfImages,
		aspectRatio: input.aspectRatio,
		imageSize: input.imageSize,
		lowCensorship: input.lowCensorship ?? false,
		uploadToR2: input.uploadToR2 ?? false,
		r2UploadDir: input.r2UploadDir,
		r2UploadIsPublic,
		references: input.references ?? [],
		attemptCount: 0,
		createdAt: now,
		updatedAt: now
	}
}

export async function getAIImageTask(
	db: TenantShardDb,
	id: string
): Promise<AIImageTask | undefined> {
	const row = await db.query.aiImageTask.findFirst({
		where: eq(aiImageTask.id, id)
	})
	if (!row) {
		return undefined
	}

	return toAIImageTask(row)
}

export function toAIImageTask(row: AIImageTaskRow): AIImageTask {
	return {
		id: row.id,
		userId: row.userId,
		status: row.status as AIImageTaskStatus,
		provider: row.provider as AIImageProvider,
		model: row.model ?? undefined,
		prompt: row.prompt,
		numberOfImages: row.numberOfImages ?? undefined,
		aspectRatio: row.aspectRatio as AIImageTask['aspectRatio'],
		imageSize: row.imageSize as AIImageTask['imageSize'],
		lowCensorship: row.lowCensorship === 1,
		uploadToR2: row.uploadToR2 === 1,
		r2UploadDir: row.r2UploadDir ?? undefined,
		r2UploadIsPublic: row.r2UploadIsPublic === 1,
		references: JSON.parse(row.referencesJson) as AIImageReference[],
		result: row.resultJson ? (JSON.parse(row.resultJson) as { images: AIImageResult[] }) : undefined,
		attemptCount: row.attemptCount,
		lastErrorMessage: row.lastErrorMessage ?? undefined,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		completedAt: row.completedAt ?? undefined
	}
}
