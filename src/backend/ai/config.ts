import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { MetaDb } from '../db'
import {
	aiChannel,
	type AIChannel as AIChannelRow,
	type AIProviderSettings,
	type AISettingsDocument
} from '../db/schema.meta'
import { readSystemSettingsSnapshot, updateSystemSettingsDomain } from '../config'
import {
	decryptConfigSecret,
	encryptConfigSecret,
	mutateConfigSecret,
	type SecretMutation
} from '../config/crypto'
import type { AIEndpoint } from './endpoint'

export type AIArea = 'chat' | 'image' | 'tts' | 'realtime' | 'video'
export type AIChannelArea = 'image' | 'tts' | 'video'
export type AIProviderId =
	| 'chatOpenai'
	| 'imageGemini'
	| 'imageOpenai'
	| 'imageSeedream'
	| 'imageAliyun'
	| 'ttsGemini'
	| 'ttsSeed'
	| 'realtimeDoubao'
	| 'videoSeedance'

export interface AIProviderIdentity {
	id: AIProviderId
	area: AIArea
	provider: string
}

export interface AIConfigView extends AISettingsDocument {
	channels: AIChannelRow[]
	version: number
}

export interface AIProviderUpdate {
	enabled: boolean
	baseUrl: string | null
	defaultModel: string | null
	apiKey: SecretMutation
}

export interface UpdateAIConfigInput {
	routing: AISettingsDocument['routing']
	taskRetentionDays: number
	providers: Record<AIProviderId, AIProviderUpdate>
	expectedVersion: number
	nowMs: number
}

export interface WriteAIChannelInput {
	id: string
	area: AIChannelArea
	provider: string
	name: string
	baseUrl: string
	models: string[]
	priceMultiplier: number
	enabled: boolean
	nowMs: number
}

export interface CreateAIChannelInput extends WriteAIChannelInput {
	apiKey: string
}

export interface UpdateAIChannelInput extends WriteAIChannelInput {
	apiKey: Exclude<SecretMutation, { action: 'remove' }>
	expectedVersion: number
}

export interface AIProviderRuntimeConfig {
	identity: AIProviderIdentity
	endpoint: AIEndpoint
	defaultModel: string
}

export interface AIChannelRuntimeConfig {
	id: string
	area: AIChannelArea
	provider: string
	name: string
	models: string[]
	priceMultiplier: number
	endpoint: AIEndpoint
	enabled: boolean
}

export interface AIRuntimeConfig {
	routing: AISettingsDocument['routing']
	taskRetentionDays: number
	providers: Partial<Record<AIProviderId, AIProviderRuntimeConfig>>
	channels: AIChannelRuntimeConfig[]
	version: number
}

export type AIConfigErrorCode =
	| 'AI_PROVIDER_CONFIG_INVALID'
	| 'AI_CHANNEL_CONFIG_INVALID'
	| 'AI_CHANNEL_NOT_FOUND'
	| 'AI_CHANNEL_CONFLICT'

export class AIConfigError extends Error {
	public readonly code: AIConfigErrorCode

	constructor(code: AIConfigErrorCode, message?: string) {
		super(message ?? aiConfigErrorMessage(code))
		this.name = 'AIConfigError'
		this.code = code
	}
}

export const AI_PROVIDER_IDENTITIES: readonly AIProviderIdentity[] = [
	{ id: 'chatOpenai', area: 'chat', provider: 'openai' },
	{ id: 'imageGemini', area: 'image', provider: 'gemini' },
	{ id: 'imageOpenai', area: 'image', provider: 'openai' },
	{ id: 'imageSeedream', area: 'image', provider: 'seedream' },
	{ id: 'imageAliyun', area: 'image', provider: 'aliyun' },
	{ id: 'ttsGemini', area: 'tts', provider: 'gemini' },
	{ id: 'ttsSeed', area: 'tts', provider: 'seed' },
	{ id: 'realtimeDoubao', area: 'realtime', provider: 'doubao' },
	{ id: 'videoSeedance', area: 'video', provider: 'seedance' }
]

export async function getAIConfig(db: MetaDb): Promise<AIConfigView> {
	const settings = await readSystemSettingsSnapshot(db)
	const values: AISettingsDocument = parseAISettings(settings.aiConfig)
	const channels: AIChannelRow[] = await db.query.aiChannel.findMany()
	return { ...values, channels, version: settings.aiVersion }
}

export async function updateAIConfig(
	db: MetaDb,
	encryptionKey: string,
	input: UpdateAIConfigInput
): Promise<AIConfigView> {
	const current: AIConfigView = await getAIConfig(db)
	const providers = {} as Record<AIProviderId, AIProviderSettings>
	for (const identity of AI_PROVIDER_IDENTITIES) {
		const providerInput: AIProviderUpdate = input.providers[identity.id]
		providers[identity.id] = {
			enabled: providerInput.enabled,
			baseUrl: providerInput.baseUrl,
			defaultModel: providerInput.defaultModel,
			apiKey: await mutateConfigSecret(
				encryptionKey,
				current.providers[identity.id].apiKey,
				providerInput.apiKey
			)
		}
	}
	const values: AISettingsDocument = parseAISettings({
		routing: input.routing,
		taskRetentionDays: input.taskRetentionDays,
		providers
	})
	validateAISettings(values)
	const settings = await updateSystemSettingsDomain(db, {
		domain: 'ai',
		expectedVersion: input.expectedVersion,
		values,
		nowMs: input.nowMs
	})
	return {
		...parseAISettings(settings.aiConfig),
		channels: current.channels,
		version: settings.aiVersion
	}
}

export async function getAIRuntimeConfig(
	db: MetaDb,
	encryptionKey: string
): Promise<AIRuntimeConfig> {
	const view: AIConfigView = await getAIConfig(db)
	validateAISettings(view)
	const providers: Partial<Record<AIProviderId, AIProviderRuntimeConfig>> = {}
	for (const identity of AI_PROVIDER_IDENTITIES) {
		const provider: AIProviderSettings = view.providers[identity.id]
		if (!provider.enabled) {
			continue
		}
		if (provider.baseUrl === null || provider.defaultModel === null || provider.apiKey === null) {
			throw new AIConfigError('AI_PROVIDER_CONFIG_INVALID')
		}
		providers[identity.id] = {
			identity,
			endpoint: {
				baseURL: provider.baseUrl,
				apiKey: await decryptConfigSecret(encryptionKey, provider.apiKey)
			},
			defaultModel: provider.defaultModel
		}
	}
	const channels: AIChannelRuntimeConfig[] = []
	for (const channel of view.channels) {
		validateAIChannelFields(channel)
		channels.push({
			id: channel.id,
			area: channel.area as AIChannelArea,
			provider: channel.provider,
			name: channel.name,
			models: channel.models,
			priceMultiplier: channel.priceMultiplier,
			endpoint: {
				baseURL: channel.baseUrl,
				apiKey: await decryptConfigSecret(encryptionKey, {
					ciphertext: channel.apiKeyCiphertext,
					iv: channel.apiKeyIv
				})
			},
			enabled: channel.enabled
		})
	}
	return {
		routing: view.routing,
		taskRetentionDays: view.taskRetentionDays,
		providers,
		channels,
		version: view.version
	}
}

export function getAIProviderRuntimeConfig(
	config: AIRuntimeConfig,
	area: AIArea,
	provider: string
): AIProviderRuntimeConfig {
	const identity: AIProviderIdentity | undefined = AI_PROVIDER_IDENTITIES.find(
		(item: AIProviderIdentity): boolean => item.area === area && item.provider === provider
	)
	const resolved: AIProviderRuntimeConfig | undefined = identity
		? config.providers[identity.id]
		: undefined
	if (!resolved) {
		throw new AIConfigError('AI_PROVIDER_CONFIG_INVALID')
	}
	return resolved
}

export function validateAISettings(settings: AISettingsDocument): void {
	parseAISettings(settings)
	for (const identity of AI_PROVIDER_IDENTITIES) {
		const provider: AIProviderSettings = settings.providers[identity.id]
		const hasEndpoint: boolean = provider.baseUrl !== null
		const hasModel: boolean = provider.defaultModel !== null
		const hasKey: boolean = provider.apiKey !== null
		const complete: boolean = hasEndpoint && hasModel && hasKey
		const empty: boolean = !hasEndpoint && !hasModel && !hasKey
		if ((!complete && !empty) || (provider.enabled && !complete)) {
			throw new AIConfigError('AI_PROVIDER_CONFIG_INVALID')
		}
	}
}

export async function createAIChannel(
	db: MetaDb,
	encryptionKey: string,
	input: CreateAIChannelInput
): Promise<AIChannelRow> {
	validateAIChannelFields(input)
	const encrypted = await encryptConfigSecret(encryptionKey, input.apiKey)
	const rows: AIChannelRow[] = await db
		.insert(aiChannel)
		.values({
			id: input.id,
			area: input.area,
			provider: input.provider,
			name: input.name,
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
	const row: AIChannelRow | undefined = rows[0]
	if (!row) {
		throw new AIConfigError('AI_CHANNEL_CONFLICT')
	}
	return row
}

export async function updateAIChannel(
	db: MetaDb,
	encryptionKey: string,
	input: UpdateAIChannelInput
): Promise<AIChannelRow> {
	validateAIChannelFields(input)
	const current: AIChannelRow | undefined = await db.query.aiChannel.findFirst({
		where: eq(aiChannel.id, input.id)
	})
	if (!current) {
		throw new AIConfigError('AI_CHANNEL_NOT_FOUND')
	}
	if (current.version !== input.expectedVersion) {
		throw new AIConfigError('AI_CHANNEL_CONFLICT')
	}
	const encrypted =
		input.apiKey.action === 'keep'
			? { ciphertext: current.apiKeyCiphertext, iv: current.apiKeyIv }
			: await encryptConfigSecret(encryptionKey, input.apiKey.value)
	const rows: AIChannelRow[] = await db
		.update(aiChannel)
		.set({
			area: input.area,
			provider: input.provider,
			name: input.name,
			baseUrl: input.baseUrl,
			models: input.models,
			priceMultiplier: input.priceMultiplier,
			apiKeyCiphertext: encrypted.ciphertext,
			apiKeyIv: encrypted.iv,
			enabled: input.enabled,
			version: sql`${aiChannel.version} + 1`,
			updatedAt: input.nowMs
		})
		.where(and(eq(aiChannel.id, input.id), eq(aiChannel.version, input.expectedVersion)))
		.returning()
	const row: AIChannelRow | undefined = rows[0]
	if (!row) {
		throw new AIConfigError('AI_CHANNEL_CONFLICT')
	}
	return row
}

export async function deleteAIChannel(
	db: MetaDb,
	input: { id: string; expectedVersion: number }
): Promise<void> {
	const current: AIChannelRow | undefined = await db.query.aiChannel.findFirst({
		where: eq(aiChannel.id, input.id)
	})
	if (!current) {
		throw new AIConfigError('AI_CHANNEL_NOT_FOUND')
	}
	if (current.version !== input.expectedVersion) {
		throw new AIConfigError('AI_CHANNEL_CONFLICT')
	}
	const rows: AIChannelRow[] = await db
		.delete(aiChannel)
		.where(and(eq(aiChannel.id, input.id), eq(aiChannel.version, input.expectedVersion)))
		.returning()
	if (rows.length === 0) {
		throw new AIConfigError('AI_CHANNEL_CONFLICT')
	}
}

function validateAIChannelFields(input: {
	id: string
	area: string
	provider: string
	name: string
	baseUrl: string
	models: string[]
	priceMultiplier: number
}): void {
	const result = AIChannelFieldsSchema.safeParse(input)
	if (!result.success) {
		throw new AIConfigError('AI_CHANNEL_CONFIG_INVALID')
	}
	const supported: boolean = AI_PROVIDER_IDENTITIES.some(
		(identity: AIProviderIdentity): boolean =>
			identity.area === input.area && identity.provider === input.provider
	)
	if (!supported || new Set(input.models).size !== input.models.length) {
		throw new AIConfigError('AI_CHANNEL_CONFIG_INVALID')
	}
}

function parseAISettings(value: unknown): AISettingsDocument {
	const result: z.ZodSafeParseResult<AISettingsDocument> = AISettingsSchema.safeParse(value)
	if (!result.success) {
		throw new AIConfigError('AI_PROVIDER_CONFIG_INVALID')
	}
	return result.data
}

function aiConfigErrorMessage(code: AIConfigErrorCode): string {
	switch (code) {
		case 'AI_PROVIDER_CONFIG_INVALID':
			return 'AI provider configuration is invalid'
		case 'AI_CHANNEL_CONFIG_INVALID':
			return 'AI channel configuration is invalid'
		case 'AI_CHANNEL_NOT_FOUND':
			return 'AI channel was not found'
		case 'AI_CHANNEL_CONFLICT':
			return 'AI channel has changed'
	}
}

const EncryptedSecretSchema = z.object({ ciphertext: z.string().min(1), iv: z.string().min(1) })
const AIProviderSchema = z.object({
	enabled: z.boolean(),
	baseUrl: z.string().url().nullable(),
	defaultModel: z.string().trim().min(1).nullable(),
	apiKey: EncryptedSecretSchema.nullable()
})
const AISettingsSchema = z.object({
	routing: z
		.object({
			errorWeight: z.number().nonnegative().finite(),
			latencyWeight: z.number().nonnegative().finite(),
			priceWeight: z.number().nonnegative().finite()
		})
		.refine(
			(value: AISettingsDocument['routing']): boolean =>
				value.errorWeight + value.latencyWeight + value.priceWeight > 0
		),
	taskRetentionDays: z.number().int().positive(),
	providers: z.object({
		chatOpenai: AIProviderSchema,
		imageGemini: AIProviderSchema,
		imageOpenai: AIProviderSchema,
		imageSeedream: AIProviderSchema,
		imageAliyun: AIProviderSchema,
		ttsGemini: AIProviderSchema,
		ttsSeed: AIProviderSchema,
		realtimeDoubao: AIProviderSchema,
		videoSeedance: AIProviderSchema
	})
})
const AIChannelFieldsSchema = z.object({
	id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
	area: z.enum(['image', 'tts', 'video']),
	provider: z.string().trim().min(1),
	name: z.string().trim().min(1),
	baseUrl: z.string().url(),
	models: z.array(z.string().trim().min(1)).min(1),
	priceMultiplier: z.number().positive().finite()
})
