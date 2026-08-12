import { describe, expect, it } from 'vitest'
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import type { TenantShardDb } from '../db'
import type { AIRuntimeConfig } from './config'
import { AIError } from './error'
import {
	createAIChannelMetricQuery,
	rankAIChannels,
	resolveAIChannel,
	type AIChannelRouteInput,
	type AIChannelMetricInput
} from './channel-routing'

const minuteMs = 60_000

describe('rankAIChannels', () => {
	it('ranks channels by weighted error, latency, and price score', async () => {
		const config = createConfig()
		const nowMs = 10 * minuteMs + 12_345
		const db = createMetricDb([
			{
				channel: 'IMAGE_OPENAI_OFFICIAL',
				model: 'gpt-image-2',
				bucketStart: 10 * minuteMs,
				successCount: 99,
				errorCount: 1,
				successLatencyMsTotal: 792_000
			},
			{
				channel: 'IMAGE_OPENAI_RESELLER_A',
				model: 'gpt-image-2',
				bucketStart: 10 * minuteMs,
				successCount: 97,
				errorCount: 3,
				successLatencyMsTotal: 485_000
			}
		])

		const ranked = await rankAIChannels(db, config, {
			target: { taskType: 'image', provider: 'openai' },
			model: 'gpt-image-2',
			excludedChannels: [],
			nowMs
		})

		expect(ranked.map((item) => ({ channel: item.channel.channel, score: item.score }))).toEqual([
			{ channel: 'IMAGE_OPENAI_OFFICIAL', score: 33.3 },
			{ channel: 'IMAGE_OPENAI_RESELLER_A', score: 17 }
		])
	})

	it('uses neutral cold-start metrics and price to rank an empty pool', async () => {
		const ranked = await rankAIChannels(createMetricDb([]), createConfig(), {
			target: { taskType: 'image', provider: 'openai' },
			model: 'gpt-image-2',
			excludedChannels: [],
			nowMs: 10 * minuteMs
		})

		expect(ranked.map((item) => ({ channel: item.channel.channel, score: item.score }))).toEqual([
			{ channel: 'IMAGE_OPENAI_RESELLER_A', score: 47 },
			{ channel: 'IMAGE_OPENAI_OFFICIAL', score: 45 }
		])
	})

	it('fills a missing latency value with the candidate median', async () => {
		const ranked = await rankAIChannels(createMetricDb([
			{
				channel: 'IMAGE_OPENAI_OFFICIAL',
				model: 'gpt-image-2',
				bucketStart: 10 * minuteMs,
				successCount: 99,
				errorCount: 1,
				successLatencyMsTotal: 792_000
			},
			{
				channel: 'IMAGE_OPENAI_RESELLER_A',
				model: 'gpt-image-2',
				bucketStart: 10 * minuteMs,
				successCount: 0,
				errorCount: 3,
				successLatencyMsTotal: 0
			}
		]), createConfig(), {
			target: { taskType: 'image', provider: 'openai' },
			model: 'gpt-image-2',
			excludedChannels: [],
			nowMs: 10 * minuteMs
		})

		expect(ranked[0]).toMatchObject({
			channel: { channel: 'IMAGE_OPENAI_OFFICIAL' },
			score: 49.5
		})
	})

	it('returns no channels after exclusions and throws when the pool is empty', async () => {
		const config = createConfig()
		const db = createMetricDb([])
		const input: Omit<AIChannelRouteInput, 'excludedChannels'> = {
			target: { taskType: 'image', provider: 'openai' as const },
			model: 'gpt-image-2',
			nowMs: 10 * minuteMs
		}

		await expect(
			rankAIChannels(db, config, {
				...input,
				excludedChannels: ['IMAGE_OPENAI_OFFICIAL', 'IMAGE_OPENAI_RESELLER_A']
			})
		).resolves.toEqual([])

		await expect(
			rankAIChannels(db, config, {
			...input,
			model: 'gpt-image-1',
			excludedChannels: []
		})
		).rejects.toMatchObject({ code: 'AI_CHANNEL_NOT_FOUND' })
	})
})

describe('resolveAIChannel', () => {
	it('resolves a configured channel for the requested target and model', () => {
		const channel = resolveAIChannel(
			createConfig(),
			'IMAGE_OPENAI_OFFICIAL',
			{ taskType: 'image', provider: 'openai' },
			'gpt-image-2'
		)

		expect({
			channel: channel.channel,
			models: channel.models,
			priceMultiplier: channel.priceMultiplier,
			endpoint: channel.endpoint
		}).toEqual({
			channel: 'IMAGE_OPENAI_OFFICIAL',
			models: ['gpt-image-2'],
			priceMultiplier: 1,
			endpoint: {
				baseURL: 'https://official.example.com/v1',
				apiKey: 'official-key'
			}
		})
	})

	it('throws a typed error for a channel outside the requested target', () => {
		expect(() => {
			resolveAIChannel(
				createConfig(),
				'IMAGE_OPENAI_OFFICIAL',
				{ taskType: 'tts', provider: 'seed' },
				'gpt-image-2'
			)
		}).toThrowError(new AIError('AI_CHANNEL_CONFIG_INVALID'))
	})
})

describe('createAIChannelMetricQuery', () => {
	it('creates a success bucket upsert with upstream latency', () => {
		const input: AIChannelMetricInput = {
			channel: 'IMAGE_OPENAI_OFFICIAL',
			model: 'gpt-image-2',
			startedAtMs: 120_001,
			finishedAtMs: 125_501,
			result: 'success'
		}
		const query = createAIChannelMetricQuery(createMetricDb([]), input)
		const built = query.getQuery()

		expect({ sql: built.sql, params: built.params }).toEqual({
			sql: expect.stringContaining('INSERT INTO ai_channel_metric_buckets'),
			params: ['IMAGE_OPENAI_OFFICIAL', 'gpt-image-2', 120_000, 1, 0, 5_500]
		})
	})

	it('creates an error bucket upsert without latency', () => {
		const input: AIChannelMetricInput = {
			channel: 'IMAGE_OPENAI_OFFICIAL',
			model: 'gpt-image-2',
			startedAtMs: 120_001,
			finishedAtMs: 125_501,
			result: 'error'
		}
		const query = createAIChannelMetricQuery(createMetricDb([]), input)

		expect(query.getQuery().params).toEqual([
			'IMAGE_OPENAI_OFFICIAL',
			'gpt-image-2',
			120_000,
			0,
			1,
			0
		])
	})
})

function createConfig(): AIRuntimeConfig {
	return {
		routing: { errorWeight: 1, latencyWeight: 0.8, priceWeight: 0.2 },
		taskRetentionDays: 30,
		providers: {},
		channels: [
			{
				id: 'IMAGE_OPENAI_OFFICIAL',
				area: 'image',
				provider: 'openai',
				name: 'Official',
				models: ['gpt-image-2'],
				priceMultiplier: 1,
				endpoint: { baseURL: 'https://official.example.com/v1', apiKey: 'official-key' },
				enabled: true
			},
			{
				id: 'IMAGE_OPENAI_RESELLER_A',
				area: 'image',
				provider: 'openai',
				name: 'Reseller A',
				models: ['gpt-image-2'],
				priceMultiplier: 0.8,
				endpoint: { baseURL: 'https://reseller.example.com/v1', apiKey: 'reseller-key' },
				enabled: true
			}
		],
		version: 1
	}
}

interface MetricRow {
	channel: string
	model: string
	bucketStart: number
	successCount: number
	errorCount: number
	successLatencyMsTotal: number
}

function createMetricDb(rows: MetricRow[]): TenantShardDb {
	return {
		select: () => ({
			from: () => ({
				where: async (): Promise<MetricRow[]> => rows
			})
		}),
		run: (query: unknown): unknown => ({
		getQuery: (): { sql: string; params: unknown[] } => {
			return new SQLiteSyncDialect().sqlToQuery(query as never)
		}
	})
	} as unknown as TenantShardDb
}
