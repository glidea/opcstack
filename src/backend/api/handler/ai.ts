import { and, desc, eq, gte, lte, type SQL } from 'drizzle-orm'
import type { Context } from 'hono'
import type { ApiEnv } from '..'
import {
	createAIRealtimeClient,
	type AIRealtimeClient,
	type AIRealtimeEvent,
	type AIRealtimeSession
} from '../../ai/realtime'
import {
	getAIProviderCandidates,
	getAIRuntimeConfig,
	type AIRuntimeConfig
} from '../../ai/config'
import { rankAIProviders, type AIRankedProvider } from '../../ai/provider-routing'
import type { TenantShardDb } from '../../db'
import {
	GetAITaskApi,
	type AIImageTask,
	type AITaskSummary,
	type AITaskType,
	type AITTSTask,
	type AIVideoTask,
	type GetAITaskResponse,
	ListAITasksApi,
	type ListAITasksRequest,
	type ListAITasksResponse
} from '../../../api-contract/ai'
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

export async function listAITasksHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, ListAITasksApi.request)
	if (!request.success) {
		const error = ListAITasksApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	const req: ListAITasksRequest = request.data
	const shards: TenantShardClient[] = await createTenantShardAccess(
		ctx.get('metaDb'),
		ctx.env
	).listShardDbs()
	const items: AITaskSummary[] = []

	for (const shard of shards) {
		if (req.task_type === undefined || req.task_type === 'image') {
			const rows: AIImageTaskRow[] = await shard.db.query.aiImageTask.findMany({
				where: buildImageConditions(req),
				orderBy: [desc(aiImageTask.createdAt)]
			})
			items.push(...rows.map((row: AIImageTaskRow): AITaskSummary => {
				return toTaskSummary('image', shard.shardId, row)
			}))
		}
		if (req.task_type === undefined || req.task_type === 'tts') {
			const rows: AITTSTaskRow[] = await shard.db.query.aiTtsTask.findMany({
				where: buildTtsConditions(req),
				orderBy: [desc(aiTtsTask.createdAt)]
			})
			items.push(...rows.map((row: AITTSTaskRow): AITaskSummary => {
				return toTaskSummary('tts', shard.shardId, row)
			}))
		}
		if (req.task_type === undefined || req.task_type === 'video') {
			const rows: AIVideoTaskRow[] = await shard.db.query.aiVideoTask.findMany({
				where: buildVideoConditions(req),
				orderBy: [desc(aiVideoTask.createdAt)]
			})
			items.push(...rows.map((row: AIVideoTaskRow): AITaskSummary => {
				return toTaskSummary('video', shard.shardId, row)
			}))
		}
	}

	items.sort((left: AITaskSummary, right: AITaskSummary): number => {
		return right.created_at - left.created_at
	})
	const offset: number = (req.page - 1) * req.page_size
	return ctx.json({
		items: items.slice(offset, offset + req.page_size),
		total: items.length
	} as ListAITasksResponse)
}

export async function getAITaskHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, GetAITaskApi.request)
	if (!request.success) {
		const error = GetAITaskApi.errors.INVALID_REQUEST(request.message)
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
		const error = GetAITaskApi.errors.AI_TASK_NOT_FOUND()
		return ctx.json(error.body, error.status)
	}

	switch (request.data.task_type) {
		case 'image': {
			const row: AIImageTaskRow | undefined = await shard.db.query.aiImageTask.findFirst({
				where: eq(aiImageTask.id, request.data.id)
			})
			if (row !== undefined) {
				return ctx.json({ task: toImageTask(shard.shardId, row) } as GetAITaskResponse)
			}
			break
		}
		case 'tts': {
			const row: AITTSTaskRow | undefined = await shard.db.query.aiTtsTask.findFirst({
				where: eq(aiTtsTask.id, request.data.id)
			})
			if (row !== undefined) {
				return ctx.json({ task: toTtsTask(shard.shardId, row) } as GetAITaskResponse)
			}
			break
		}
		case 'video': {
			const row: AIVideoTaskRow | undefined = await shard.db.query.aiVideoTask.findFirst({
				where: eq(aiVideoTask.id, request.data.id)
			})
			if (row !== undefined) {
				return ctx.json({ task: toVideoTask(shard.shardId, row) } as GetAITaskResponse)
			}
			break
		}
	}

	const error = GetAITaskApi.errors.AI_TASK_NOT_FOUND()
	return ctx.json(error.body, error.status)
}

function buildImageConditions(req: ListAITasksRequest): SQL | undefined {
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

function buildTtsConditions(req: ListAITasksRequest): SQL | undefined {
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

function buildVideoConditions(req: ListAITasksRequest): SQL | undefined {
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
	taskType: AITaskType,
	shardId: string,
	row: CommonTaskRow
): AITaskSummary {
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

function toImageTask(shardId: string, row: AIImageTaskRow): AIImageTask {
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

function toTtsTask(shardId: string, row: AITTSTaskRow): AITTSTask {
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

function toVideoTask(shardId: string, row: AIVideoTaskRow): AIVideoTask {
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

export interface AIRealtimeWebSocket {
	accept(): void
	send(message: string | ArrayBuffer | ArrayBufferView): void
	addEventListener(type: string, handler: (event: MessageEvent) => void): void
}

export type AIRealtimeWebSocketClientJsonMessage =
	| AIRealtimeWebSocketStartSessionMessage
	| AIRealtimeWebSocketInputTextMessage
	| AIRealtimeWebSocketInterruptMessage
	| AIRealtimeWebSocketFinishSessionMessage

export interface AIRealtimeWebSocketStartSessionMessage {
	type: 'start_session'
	model: string
	speaker: string
	prompt?: string
}

export interface AIRealtimeWebSocketInputTextMessage {
	type: 'input_text'
	text: string
}

export interface AIRealtimeWebSocketInterruptMessage {
	type: 'interrupt'
}

export interface AIRealtimeWebSocketFinishSessionMessage {
	type: 'finish_session'
}

export async function aiRealtimeConnectHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const config: AIRuntimeConfig = await getAIRuntimeConfig(
		ctx.get('metaDb'),
		ctx.env.CONFIG_ENCRYPTION_KEY
	)
	const pair = new WebSocketPair()
	const clientSocket: WebSocket = pair[0]
	const serverSocket: WebSocket = pair[1]
	const tenant = await createTenantShardAccess(ctx.get('metaDb'), ctx.env).openUserDb(
		ctx.get('userId')
	)
	bindAIRealtimeWebSocket(serverSocket, ctx.get('userId'), config, tenant.db)

	return new Response(null, {
		status: 101,
		webSocket: clientSocket
	})
}

export function bindAIRealtimeWebSocket(
	socket: AIRealtimeWebSocket,
	userId: string,
	config: AIRuntimeConfig,
	tenantDb: TenantShardDb
): void {
	let session: AIRealtimeSession | undefined = undefined
	let pendingMessage: Promise<void> = Promise.resolve()
	socket.accept()
	socket.addEventListener('message', (event: MessageEvent): void => {
		pendingMessage = pendingMessage.then(async (): Promise<void> => {
			await handleAIRealtimeWebSocketMessage(
				socket,
				config,
				tenantDb,
				userId,
				event.data,
				(value: AIRealtimeSession): void => {
					session = value
				},
				(): AIRealtimeSession => {
					return session!
				}
			)
		})
	})
}

async function handleAIRealtimeWebSocketMessage(
	socket: AIRealtimeWebSocket,
	config: AIRuntimeConfig,
	tenantDb: TenantShardDb,
	userId: string,
	data: string | ArrayBuffer | ArrayBufferView,
	setSession: (session: AIRealtimeSession) => void,
	getSession: () => AIRealtimeSession
): Promise<void> {
	if (typeof data !== 'string') {
		await getSession().sendAudio(toBytes(data))
		return
	}

	const message: AIRealtimeWebSocketClientJsonMessage = JSON.parse(data) as AIRealtimeWebSocketClientJsonMessage
	switch (message.type) {
		case 'start_session': {
			const candidates = getAIProviderCandidates(config, 'realtime_doubao', message.model)
			const ranked: AIRankedProvider[] = await rankAIProviders(
				tenantDb,
				candidates,
				config.routing,
				{ model: message.model, excludedProviderIds: [], nowMs: Date.now() }
			)
			const provider = ranked[0]!.provider
			const client: AIRealtimeClient = createAIRealtimeClient(userId, {
				type: 'realtime_doubao',
				model: message.model,
				endpoint: provider.endpoint
			})
			const session: AIRealtimeSession = await client.startSession({
				speaker: message.speaker,
				prompt: message.prompt
			})

			setSession(session)
			void forwardAIRealtimeEvents(socket, session.events)
			return
		}
		case 'input_text':
			await getSession().sendText(message.text)
			return
		case 'interrupt':
			await getSession().interrupt()
			return
		case 'finish_session':
			await getSession().finish()
			return
	}
}

async function forwardAIRealtimeEvents(
	socket: AIRealtimeWebSocket,
	events: ReadableStream<AIRealtimeEvent>
): Promise<void> {
	const reader: ReadableStreamDefaultReader<AIRealtimeEvent> = events.getReader()
	while (true) {
		const result: ReadableStreamReadResult<AIRealtimeEvent> = await reader.read()
		if (result.done) {
			break
		}

		sendAIRealtimeEvent(socket, result.value)
	}
}

function sendAIRealtimeEvent(socket: AIRealtimeWebSocket, event: AIRealtimeEvent): void {
	switch (event.type) {
		case 'session_started':
			socket.send(JSON.stringify({ type: 'session_started' }))
			return
		case 'user_transcript':
			socket.send(JSON.stringify({ type: 'user_transcript', text: event.text }))
			return
		case 'assistant_text':
			socket.send(JSON.stringify({ type: 'assistant_text', text: event.text }))
			return
		case 'assistant_audio':
			socket.send(event.audio)
			return
		case 'assistant_audio_ended':
			socket.send(JSON.stringify({ type: 'assistant_audio_ended' }))
			return
		case 'interrupted':
			socket.send(JSON.stringify({ type: 'interrupted' }))
			return
		case 'finished':
			socket.send(JSON.stringify({ type: 'finished' }))
			return
		case 'error':
			socket.send(JSON.stringify({ type: 'error', code: event.code, message: event.message }))
			return
	}
}

function toBytes(data: ArrayBuffer | ArrayBufferView): Uint8Array {
	if (data instanceof ArrayBuffer) {
		return new Uint8Array(data)
	}
	return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
}
