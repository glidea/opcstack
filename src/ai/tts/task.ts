import { eq } from 'drizzle-orm'
import { aiTtsTask, type AITTSTaskRow } from '../../db/schema.shard'
import type { TenantShardDb } from '../../db'
import type {
	AITTSLine,
	AITTSResult,
	AITTSSpeaker,
	AITTSSpeechInput,
	AITTSTask,
	AITTSTaskStatus
} from '.'

export const AI_TTS_QUEUE_NAME = 'tts-generate'

export interface AITTSGenerateQueueMessage {
	taskId: string
	userId: string
}

export async function createAITTSTask(
	env: Env,
	db: TenantShardDb,
	provider: 'gemini',
	model: string,
	userId: string,
	input: AITTSSpeechInput
): Promise<AITTSTask> {
	const now: number = Date.now()
	const id: string = crypto.randomUUID()
	await db.insert(aiTtsTask).values({
		id,
		userId,
		status: 'processing',
		provider,
		model,
		instruction: input.instruction,
		speakersJson: JSON.stringify(input.speakers),
		linesJson: JSON.stringify(input.lines),
		uploadToR2: input.uploadToR2 ? 1 : 0,
		createdAt: now,
		updatedAt: now
	})

	await env.Q_TTS_GENERATE.send({
		taskId: id,
		userId
	})

	return {
		id,
		userId,
		status: 'processing',
		provider,
		model,
		instruction: input.instruction,
		speakers: input.speakers,
		lines: input.lines,
		uploadToR2: input.uploadToR2 ?? false,
		attemptCount: 0,
		createdAt: now,
		updatedAt: now
	}
}

export async function getAITTSTask(
	db: TenantShardDb,
	id: string
): Promise<AITTSTask | undefined> {
	const row: AITTSTaskRow | undefined = await db.query.aiTtsTask.findFirst({
		where: eq(aiTtsTask.id, id)
	})
	if (!row) {
		return undefined
	}

	return toAITTSTask(row)
}

export function toAITTSTask(row: AITTSTaskRow): AITTSTask {
	return {
		id: row.id,
		userId: row.userId,
		status: row.status as AITTSTaskStatus,
		provider: row.provider as 'gemini',
		model: row.model ?? undefined,
		instruction: row.instruction ?? undefined,
		speakers: JSON.parse(row.speakersJson) as AITTSSpeaker[],
		lines: JSON.parse(row.linesJson) as AITTSLine[],
		uploadToR2: row.uploadToR2 === 1,
		result: row.resultJson ? (JSON.parse(row.resultJson) as { audio: AITTSResult }) : undefined,
		attemptCount: row.attemptCount,
		lastErrorMessage: row.lastErrorMessage ?? undefined,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		completedAt: row.completedAt ?? undefined
	}
}
