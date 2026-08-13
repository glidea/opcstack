import { describe, expect, it } from 'vitest'
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import type { TenantShardDb } from '../db'
import type { AIProviderRuntimeConfig } from './config'
import {
	createAIProviderMetricQuery,
	rankAIProviders,
	type AIProviderMetricInput,
	type AIProviderRouteInput
} from './provider-routing'

const minuteMs = 60_000

describe('rankAIProviders', (): void => {
	it('ranks prefiltered providers by weighted error, latency, and price score', async (): Promise<void> => {
		const nowMs: number = 10 * minuteMs + 12_345
		const db: TenantShardDb = createMetricDb([
			{
				providerId: 'openai-official',
				model: 'gpt-image-2',
				bucketStart: 10 * minuteMs,
				successCount: 99,
				errorCount: 1,
				successLatencyMsTotal: 792_000
			},
			{
				providerId: 'openai-reseller-a',
				model: 'gpt-image-2',
				bucketStart: 10 * minuteMs,
				successCount: 97,
				errorCount: 3,
				successLatencyMsTotal: 485_000
			}
		])

		const ranked = await rankAIProviders(db, createCandidates(), createWeights(), {
			model: 'gpt-image-2',
			excludedProviderIds: [],
			nowMs
		})

		expect(ranked.map((item) => ({ providerId: item.provider.id, score: item.score }))).toEqual([
			{ providerId: 'openai-official', score: 33.3 },
			{ providerId: 'openai-reseller-a', score: 17 }
		])
	})

	it('uses the weights passed for the current selection snapshot', async (): Promise<void> => {
		const db: TenantShardDb = createMetricDb([])
		const candidates: AIProviderRuntimeConfig[] = createCandidates()
		const priceFirst = await rankAIProviders(
			db,
			candidates,
			{ errorWeight: 0, latencyWeight: 0, priceWeight: 1 },
			createRouteInput()
		)
		const errorFirst = await rankAIProviders(
			db,
			candidates,
			{ errorWeight: 1, latencyWeight: 0, priceWeight: 0 },
			createRouteInput()
		)

		expect({ priceFirst: priceFirst[0]?.provider.id, errorFirst: errorFirst[0]?.provider.id }).toEqual({
			priceFirst: 'openai-reseller-a',
			errorFirst: 'openai-official'
		})
	})

	it('returns no providers after exclusions and rejects an empty candidate set', async (): Promise<void> => {
		const db: TenantShardDb = createMetricDb([])
		await expect(
			rankAIProviders(db, createCandidates(), createWeights(), {
				...createRouteInput(),
				excludedProviderIds: ['openai-official', 'openai-reseller-a']
			})
		).resolves.toEqual([])

		await expect(
			rankAIProviders(db, [], createWeights(), createRouteInput())
		).rejects.toMatchObject({ code: 'AI_PROVIDER_NOT_FOUND' })
	})
})

describe('createAIProviderMetricQuery', (): void => {
	it('creates a provider success bucket upsert with upstream latency', (): void => {
		const input: AIProviderMetricInput = {
			providerId: 'openai-official',
			model: 'gpt-image-2',
			startedAtMs: 120_001,
			finishedAtMs: 125_501,
			result: 'success'
		}
		const query = createAIProviderMetricQuery(createMetricDb([]), input)
		const built = query.getQuery()

		expect({ sql: built.sql, params: built.params }).toEqual({
			sql: expect.stringContaining('INSERT INTO ai_provider_metric_buckets'),
			params: ['openai-official', 'gpt-image-2', 120_000, 1, 0, 5_500]
		})
	})
})

function createWeights(): { errorWeight: number; latencyWeight: number; priceWeight: number } {
	return { errorWeight: 1, latencyWeight: 0.8, priceWeight: 0.2 }
}

function createRouteInput(): AIProviderRouteInput {
	return {
		model: 'gpt-image-2',
		excludedProviderIds: [],
		nowMs: 10 * minuteMs
	}
}

function createCandidates(): AIProviderRuntimeConfig[] {
	return [
		{
			id: 'openai-official',
			name: 'Official',
			type: 'image_openai',
			models: ['gpt-image-2'],
			priceMultiplier: 1,
			endpoint: { baseURL: 'https://official.example.com/v1', apiKey: 'official-key' },
			enabled: true
		},
		{
			id: 'openai-reseller-a',
			name: 'Reseller A',
			type: 'image_openai',
			models: ['gpt-image-2'],
			priceMultiplier: 0.8,
			endpoint: { baseURL: 'https://reseller.example.com/v1', apiKey: 'reseller-key' },
			enabled: true
		}
	]
}

interface MetricRow {
	providerId: string
	model: string
	bucketStart: number
	successCount: number
	errorCount: number
	successLatencyMsTotal: number
}

function createMetricDb(rows: MetricRow[]): TenantShardDb {
	return {
		select: (): Record<string, unknown> => ({
			from: (): Record<string, unknown> => ({
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
