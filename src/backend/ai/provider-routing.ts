import { and, eq, gte, lte, sql } from 'drizzle-orm'
import type { D1RawRunQuery, TenantShardDb } from '../db'
import type { AISettingsDocument } from '../db/schema.meta'
import { aiProviderMetricBucket } from '../db/schema.shard'
import type { AIProviderRuntimeConfig } from './config'
import { AIError } from './error'

const minuteMs = 60_000

export interface AIProviderRouteInput {
	model: string
	excludedProviderIds: readonly string[]
	nowMs: number
}

export interface AIRankedProvider {
	provider: AIProviderRuntimeConfig
	score: number
}

export interface AIProviderMetricInput {
	providerId: string
	model: string
	startedAtMs: number
	finishedAtMs: number
	result: 'success' | 'error'
}

interface AIProviderMetricRow {
	providerId: string
	model: string
	bucketStart: number
	successCount: number
	errorCount: number
	successLatencyMsTotal: number
}

interface WindowMetric {
	errorRate?: number
	latencyMs?: number
}

interface ProviderMetric {
	errorRate?: number
	latencyMs?: number
}

export async function rankAIProviders(
	db: TenantShardDb,
	candidates: readonly AIProviderRuntimeConfig[],
	weights: AISettingsDocument['routing'],
	input: AIProviderRouteInput
): Promise<AIRankedProvider[]> {
	if (candidates.length === 0) {
		throw new AIError('AI_PROVIDER_NOT_FOUND')
	}
	const excludedProviderIds: Set<string> = new Set(input.excludedProviderIds)
	const available: AIProviderRuntimeConfig[] = candidates.filter(
		(provider: AIProviderRuntimeConfig): boolean => !excludedProviderIds.has(provider.id)
	)
	if (available.length === 0) {
		return []
	}

	const currentBucketStart: number = Math.floor(input.nowMs / minuteMs) * minuteMs
	const hourStart: number = currentBucketStart - 59 * minuteMs
	const rows: AIProviderMetricRow[] = await db
		.select({
			providerId: aiProviderMetricBucket.providerId,
			model: aiProviderMetricBucket.model,
			bucketStart: aiProviderMetricBucket.bucketStart,
			successCount: aiProviderMetricBucket.successCount,
			errorCount: aiProviderMetricBucket.errorCount,
			successLatencyMsTotal: aiProviderMetricBucket.successLatencyMsTotal
		})
		.from(aiProviderMetricBucket)
		.where(
			and(
				eq(aiProviderMetricBucket.model, input.model),
				gte(aiProviderMetricBucket.bucketStart, hourStart),
				lte(aiProviderMetricBucket.bucketStart, currentBucketStart)
			)
		)

	const metrics: Map<string, ProviderMetric> = new Map<string, ProviderMetric>()
	for (const provider of available) {
		const providerRows: AIProviderMetricRow[] = rows.filter(
			(row: AIProviderMetricRow): boolean => row.providerId === provider.id
		)
		const recent: WindowMetric = aggregateWindow(
			providerRows,
			currentBucketStart - 4 * minuteMs,
			currentBucketStart
		)
		const hourly: WindowMetric = aggregateWindow(providerRows, hourStart, currentBucketStart)
		metrics.set(provider.id, {
			errorRate: combineMetric(recent.errorRate, hourly.errorRate),
			latencyMs: combineMetric(recent.latencyMs, hourly.latencyMs)
		})
	}

	const errorValues: number[] = [...metrics.values()]
		.map((metric: ProviderMetric): number | undefined => metric.errorRate)
		.filter((value: number | undefined): value is number => value !== undefined)
	const latencyValues: number[] = [...metrics.values()]
		.map((metric: ProviderMetric): number | undefined => metric.latencyMs)
		.filter((value: number | undefined): value is number => value !== undefined)
	const errorMedian: number | undefined = median(errorValues)
	const latencyMedian: number | undefined = median(latencyValues)
	const errorMax: number = max(errorValues)
	const latencyMax: number = max(latencyValues)
	const priceMax: number = Math.max(
		...available.map((provider: AIProviderRuntimeConfig): number => provider.priceMultiplier)
	)
	const totalWeight: number =
		weights.errorWeight + weights.latencyWeight + weights.priceWeight

	const ranked: AIRankedProvider[] = available.map(
		(provider: AIProviderRuntimeConfig): AIRankedProvider => {
			const metric: ProviderMetric | undefined = metrics.get(provider.id)
			const errorPenalty: number = normalizeMetric(metric?.errorRate, errorMedian, errorMax)
			const latencyPenalty: number = normalizeMetric(
				metric?.latencyMs,
				latencyMedian,
				latencyMax
			)
			const pricePenalty: number = provider.priceMultiplier / priceMax
			const penalty: number =
				(errorPenalty * weights.errorWeight +
					latencyPenalty * weights.latencyWeight +
					pricePenalty * weights.priceWeight) /
				totalWeight
			return { provider, score: Math.round((1 - penalty) * 1000) / 10 }
		}
	)

	ranked.sort((left: AIRankedProvider, right: AIRankedProvider): number => {
		if (right.score !== left.score) {
			return right.score - left.score
		}
		return left.provider.id.localeCompare(right.provider.id)
	})
	return ranked
}

export function createAIProviderMetricQuery(
	db: TenantShardDb,
	input: AIProviderMetricInput
): D1RawRunQuery {
	const bucketStart: number = Math.floor(input.startedAtMs / minuteMs) * minuteMs
	const isSuccess: boolean = input.result === 'success'
	const successCount: number = isSuccess ? 1 : 0
	const errorCount: number = isSuccess ? 0 : 1
	const latencyMs: number = isSuccess ? input.finishedAtMs - input.startedAtMs : 0
	return db.run(sql`
		INSERT INTO ai_provider_metric_buckets (
			provider_id,
			model,
			bucket_start,
			success_count,
			error_count,
			success_latency_ms_total
		)
		VALUES (${input.providerId}, ${input.model}, ${bucketStart}, ${successCount}, ${errorCount}, ${latencyMs})
		ON CONFLICT(provider_id, model, bucket_start) DO UPDATE SET
			success_count = success_count + excluded.success_count,
			error_count = error_count + excluded.error_count,
			success_latency_ms_total = success_latency_ms_total + excluded.success_latency_ms_total
	`)
}

function aggregateWindow(
	rows: AIProviderMetricRow[],
	startMs: number,
	endMs: number
): WindowMetric {
	let successCount: number = 0
	let errorCount: number = 0
	let successLatencyMsTotal: number = 0
	for (const row of rows) {
		if (row.bucketStart < startMs || row.bucketStart > endMs) {
			continue
		}
		successCount += row.successCount
		errorCount += row.errorCount
		successLatencyMsTotal += row.successLatencyMsTotal
	}
	const sampleCount: number = successCount + errorCount
	return {
		errorRate: sampleCount > 0 ? errorCount / sampleCount : undefined,
		latencyMs: successCount > 0 ? successLatencyMsTotal / successCount : undefined
	}
}

function combineMetric(recent: number | undefined, hourly: number | undefined): number | undefined {
	if (recent !== undefined && hourly !== undefined) {
		return recent * 0.7 + hourly * 0.3
	}
	return recent ?? hourly
}

function median(values: number[]): number | undefined {
	if (values.length === 0) {
		return undefined
	}
	const sorted: number[] = [...values].sort((left: number, right: number): number => left - right)
	const middle: number = Math.floor(sorted.length / 2)
	if (sorted.length % 2 === 1) {
		return sorted[middle] as number
	}
	return ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
}

function max(values: number[]): number {
	return values.length === 0 ? 0 : Math.max(...values)
}

function normalizeMetric(
	value: number | undefined,
	medianValue: number | undefined,
	maxValue: number
): number {
	if (value === undefined && medianValue === undefined) {
		return 0.5
	}
	const resolvedValue: number | undefined = value ?? medianValue
	return maxValue === 0 ? 0 : (resolvedValue as number) / maxValue
}
