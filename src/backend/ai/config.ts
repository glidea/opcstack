import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { MetaDb } from '../db'
import {
	aiProvider,
	type AIProvider as AIProviderRow,
	type AISettingsDocument
} from '../db/schema.meta'
import { readSystemSettingsSnapshot, updateSystemSettingsDomain } from '../config'
import {
	decryptConfigSecret,
	encryptConfigSecret,
	type SecretMutation
} from '../config/crypto'
import type { AIEndpoint } from './endpoint'

export type AIProviderType =
	| 'chat_openai'
	| 'image_gemini'
	| 'image_openai'
	| 'image_seedream'
	| 'image_aliyun'
	| 'tts_gemini'
	| 'tts_seed'
	| 'realtime_doubao'
	| 'video_seedance'

export type AIImageProviderType =
	| 'image_gemini'
	| 'image_openai'
	| 'image_seedream'
	| 'image_aliyun'
export type AITTSProviderType = 'tts_gemini' | 'tts_seed'
export type AIRealtimeProviderType = 'realtime_doubao'
export type AIVideoProviderType = 'video_seedance'

export const AI_PROVIDER_TYPES: readonly [
	AIProviderType,
	AIProviderType,
	AIProviderType,
	AIProviderType,
	AIProviderType,
	AIProviderType,
	AIProviderType,
	AIProviderType,
	AIProviderType
] = [
	'chat_openai',
	'image_gemini',
	'image_openai',
	'image_seedream',
	'image_aliyun',
	'tts_gemini',
	'tts_seed',
	'realtime_doubao',
	'video_seedance'
]

export interface AIConfigView extends AISettingsDocument {
	providers: AIProviderRow[]
	version: number
}

export interface UpdateAIConfigInput {
	routing: AISettingsDocument['routing']
	taskRetentionDays: number
	expectedVersion: number
	nowMs: number
}

export interface WriteAIProviderInput {
	id: string
	name: string
	type: AIProviderType
	baseUrl: string
	models: string[]
	priceMultiplier: number
	enabled: boolean
	nowMs: number
}

export interface CreateAIProviderInput extends WriteAIProviderInput {
	apiKey: string
}

export interface UpdateAIProviderInput extends WriteAIProviderInput {
	apiKey: Exclude<SecretMutation, { action: 'remove' }>
	expectedVersion: number
}

export interface AIProviderRuntimeConfig {
	id: string
	name: string
	type: AIProviderType
	models: string[]
	priceMultiplier: number
	endpoint: AIEndpoint
	enabled: boolean
}

export interface AIRuntimeConfig extends AISettingsDocument {
	providers: AIProviderRuntimeConfig[]
	version: number
}

export type AIConfigErrorCode =
	| 'AI_CONFIG_INVALID'
	| 'AI_PROVIDER_CONFIG_INVALID'
	| 'AI_PROVIDER_NOT_FOUND'
	| 'AI_PROVIDER_CONFLICT'

export class AIConfigError extends Error {
	public readonly code: AIConfigErrorCode

	constructor(code: AIConfigErrorCode, message?: string) {
		super(message ?? aiConfigErrorMessage(code))
		this.name = 'AIConfigError'
		this.code = code
	}
}

export async function getAIConfig(db: MetaDb): Promise<AIConfigView> {
	const settings = await readSystemSettingsSnapshot(db)
	const values: AISettingsDocument = parseAISettings(settings.aiConfig)
	const providers: AIProviderRow[] = await db.query.aiProvider.findMany()
	return { ...values, providers, version: settings.aiVersion }
}

export async function updateAIConfig(
	db: MetaDb,
	input: UpdateAIConfigInput
): Promise<AIConfigView> {
	const values: AISettingsDocument = parseAISettings({
		routing: input.routing,
		taskRetentionDays: input.taskRetentionDays
	})
	const settings = await updateSystemSettingsDomain(db, {
		domain: 'ai',
		expectedVersion: input.expectedVersion,
		values,
		nowMs: input.nowMs
	})
	const providers: AIProviderRow[] = await db.query.aiProvider.findMany()
	return {
		...parseAISettings(settings.aiConfig),
		providers,
		version: settings.aiVersion
	}
}

export async function getAIRuntimeConfig(
	db: MetaDb,
	encryptionKey: string
): Promise<AIRuntimeConfig> {
	const view: AIConfigView = await getAIConfig(db)
	const providers: AIProviderRuntimeConfig[] = []
	for (const provider of view.providers) {
		const type: AIProviderType = parseAIProviderFields(provider).type
		providers.push({
			id: provider.id,
			name: provider.name,
			type,
			models: provider.models,
			priceMultiplier: provider.priceMultiplier,
			endpoint: {
				baseURL: provider.baseUrl,
				apiKey: await decryptConfigSecret(encryptionKey, {
					ciphertext: provider.apiKeyCiphertext,
					iv: provider.apiKeyIv
				})
			},
			enabled: provider.enabled
		})
	}
	return {
		routing: view.routing,
		taskRetentionDays: view.taskRetentionDays,
		providers,
		version: view.version
	}
}

export function getAIProviderCandidates(
	config: AIRuntimeConfig,
	type: AIProviderType,
	model: string
): AIProviderRuntimeConfig[] {
	return config.providers.filter((provider: AIProviderRuntimeConfig): boolean => {
		return provider.enabled && provider.type === type && provider.models.includes(model)
	})
}

export function getAIProviderRuntimeConfig(
	config: AIRuntimeConfig,
	providerId: string,
	type: AIProviderType,
	model: string
): AIProviderRuntimeConfig {
	const provider: AIProviderRuntimeConfig | undefined = config.providers.find(
		(item: AIProviderRuntimeConfig): boolean => {
			return item.id === providerId && item.type === type && item.models.includes(model)
		}
	)
	if (!provider) {
		throw new AIConfigError('AI_PROVIDER_CONFIG_INVALID')
	}
	return provider
}

export function validateAISettings(settings: AISettingsDocument): void {
	parseAISettings(settings)
}

export async function createAIProvider(
	db: MetaDb,
	encryptionKey: string,
	input: CreateAIProviderInput
): Promise<AIProviderRow> {
	parseAIProviderFields(input)
	const encrypted = await encryptConfigSecret(encryptionKey, input.apiKey)
	const rows: AIProviderRow[] = await db
		.insert(aiProvider)
		.values({
			id: input.id,
			name: input.name,
			type: input.type,
			baseUrl: input.baseUrl,
			models: input.models,
			priceMultiplier: input.priceMultiplier,
			apiKeyCiphertext: encrypted.ciphertext,
			apiKeyIv: encrypted.iv,
			enabled: input.enabled,
			version: 1,
			createdAt: input.nowMs,
			updatedAt: input.nowMs
		})
		.onConflictDoNothing()
		.returning()
	const row: AIProviderRow | undefined = rows[0]
	if (!row) {
		throw new AIConfigError('AI_PROVIDER_CONFLICT')
	}
	return row
}

export async function updateAIProvider(
	db: MetaDb,
	encryptionKey: string,
	input: UpdateAIProviderInput
): Promise<AIProviderRow> {
	parseAIProviderFields(input)
	const current: AIProviderRow | undefined = await db.query.aiProvider.findFirst({
		where: eq(aiProvider.id, input.id)
	})
	if (!current) {
		throw new AIConfigError('AI_PROVIDER_NOT_FOUND')
	}
	if (current.version !== input.expectedVersion) {
		throw new AIConfigError('AI_PROVIDER_CONFLICT')
	}
	const encrypted: { ciphertext: string; iv: string } =
		input.apiKey.action === 'keep'
			? { ciphertext: current.apiKeyCiphertext, iv: current.apiKeyIv }
			: await encryptConfigSecret(encryptionKey, input.apiKey.value)
	const rows: AIProviderRow[] = await db
		.update(aiProvider)
		.set({
			name: input.name,
			type: input.type,
			baseUrl: input.baseUrl,
			models: input.models,
			priceMultiplier: input.priceMultiplier,
			apiKeyCiphertext: encrypted.ciphertext,
			apiKeyIv: encrypted.iv,
			enabled: input.enabled,
			version: sql`${aiProvider.version} + 1`,
			updatedAt: input.nowMs
		})
		.where(and(eq(aiProvider.id, input.id), eq(aiProvider.version, input.expectedVersion)))
		.returning()
	const row: AIProviderRow | undefined = rows[0]
	if (!row) {
		throw new AIConfigError('AI_PROVIDER_CONFLICT')
	}
	return row
}

export async function deleteAIProvider(
	db: MetaDb,
	input: { id: string; expectedVersion: number }
): Promise<void> {
	const current: AIProviderRow | undefined = await db.query.aiProvider.findFirst({
		where: eq(aiProvider.id, input.id)
	})
	if (!current) {
		throw new AIConfigError('AI_PROVIDER_NOT_FOUND')
	}
	if (current.version !== input.expectedVersion) {
		throw new AIConfigError('AI_PROVIDER_CONFLICT')
	}
	const rows: AIProviderRow[] = await db
		.delete(aiProvider)
		.where(and(eq(aiProvider.id, input.id), eq(aiProvider.version, input.expectedVersion)))
		.returning()
	if (rows.length === 0) {
		throw new AIConfigError('AI_PROVIDER_CONFLICT')
	}
}

function parseAISettings(value: unknown): AISettingsDocument {
	const result: z.ZodSafeParseResult<AISettingsDocument> = AISettingsSchema.safeParse(value)
	if (!result.success) {
		throw new AIConfigError('AI_CONFIG_INVALID')
	}
	return result.data
}

function parseAIProviderFields(value: unknown): z.infer<typeof AIProviderFieldsSchema> {
	const result: z.ZodSafeParseResult<z.infer<typeof AIProviderFieldsSchema>> =
		AIProviderFieldsSchema.safeParse(value)
	if (!result.success || new Set(result.data.models).size !== result.data.models.length) {
		throw new AIConfigError('AI_PROVIDER_CONFIG_INVALID')
	}
	return result.data
}

function aiConfigErrorMessage(code: AIConfigErrorCode): string {
	switch (code) {
		case 'AI_CONFIG_INVALID':
			return 'AI configuration is invalid'
		case 'AI_PROVIDER_CONFIG_INVALID':
			return 'AI provider configuration is invalid'
		case 'AI_PROVIDER_NOT_FOUND':
			return 'AI provider was not found'
		case 'AI_PROVIDER_CONFLICT':
			return 'AI provider has changed'
	}
}

const AIProviderTypeSchema = z.enum(AI_PROVIDER_TYPES)
const AISettingsSchema = z
	.object({
		routing: z
			.object({
				errorWeight: z.number().nonnegative().finite(),
				latencyWeight: z.number().nonnegative().finite(),
				priceWeight: z.number().nonnegative().finite()
			})
			.strict()
			.refine(
				(value: AISettingsDocument['routing']): boolean =>
					value.errorWeight + value.latencyWeight + value.priceWeight > 0
			),
		taskRetentionDays: z.number().int().positive()
	})
	.strict()
const AIProviderFieldsSchema = z.object({
	id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
	name: z.string().trim().min(1),
	type: AIProviderTypeSchema,
	baseUrl: z.string().url(),
	models: z.array(z.string().trim().min(1)).min(1),
	priceMultiplier: z.number().positive().finite()
})
