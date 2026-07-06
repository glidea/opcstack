import { eq } from 'drizzle-orm'
import { aiImageTask, type AIImageTaskRow } from '../../db/schema.shard'
import { AIError } from '../error'
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
	const r2UploadConfig = resolveR2UploadConfig(input)
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
		r2UploadDir: r2UploadConfig?.dir,
		r2UploadIsPublic: r2UploadConfig?.isPublic ? 1 : 0,
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
		r2UploadDir: r2UploadConfig?.dir,
		r2UploadIsPublic: r2UploadConfig?.isPublic ?? false,
		references: input.references ?? [],
		attemptCount: 0,
		createdAt: now,
		updatedAt: now
	}
}

function resolveR2UploadConfig(
	input: AISimpleImageClientGenerateInput
): { dir: string; isPublic: boolean } | undefined {
	if (!input.uploadToR2) {
		return undefined
	}
	if (!input.r2UploadDir) {
		throw new AIError('AI_IMAGE_R2_UPLOAD_DIR_REQUIRED')
	}
	if (input.r2UploadIsPublic === undefined) {
		throw new AIError('AI_IMAGE_R2_UPLOAD_IS_PUBLIC_REQUIRED')
	}
	return {
		dir: input.r2UploadDir,
		isPublic: input.r2UploadIsPublic
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
