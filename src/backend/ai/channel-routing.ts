import { and, eq, gte, lte, sql } from 'drizzle-orm'
import type { D1RawRunQuery, TenantShardDb } from '../db'
import { aiChannelMetricBucket } from '../db/schema.shard'
import type { AIEndpoint } from './endpoint'
import { AIError } from './error'
import type { AIImageProvider } from './image'
import type { AITTSProvider } from './tts'
import type { AIVideoProvider } from './video'
import type { AIRuntimeConfig } from './config'

const minuteMs = 60_000

export type AIChannelTarget =
	| { taskType: 'image'; provider: AIImageProvider }
	| { taskType: 'tts'; provider: AITTSProvider }
	| { taskType: 'video'; provider: AIVideoProvider }

export interface AIChannelRouteInput {
	target: AIChannelTarget
	model: string
	excludedChannels: readonly string[]
	nowMs: number
}

export interface AIChannel {
	channel: string
	target: AIChannelTarget
	models: readonly string[]
	priceMultiplier: number
	endpoint: AIEndpoint
}

export interface AIRankedChannel {
	channel: AIChannel
	score: number
}

export interface AIChannelMetricInput {
	channel: string
	model: string
	startedAtMs: number
	finishedAtMs: number
	result: 'success' | 'error'
}

interface AIChannelMetricRow {
	channel: string
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

interface ChannelMetric {
	errorRate?: number
	latencyMs?: number
}

export async function rankAIChannels(
	db: TenantShardDb,
	config: AIRuntimeConfig,
	input: AIChannelRouteInput
): Promise<AIRankedChannel[]> {
	const candidates: AIChannel[] = collectAIChannels(config, input.target, true).filter((channel) => {
		return channel.models.includes(input.model)
	})
	if (candidates.length === 0) {
		throw new AIError('AI_CHANNEL_NOT_FOUND')
	}

	const excluded = new Set(input.excludedChannels)
	const available = candidates.filter((channel) => {
		return !excluded.has(channel.channel)
	})
	if (available.length === 0) {
		return []
	}

	const currentBucketStart = Math.floor(input.nowMs / minuteMs) * minuteMs
	const hourStart = currentBucketStart - 59 * minuteMs
	const rows: AIChannelMetricRow[] = await db
		.select({
			channel: aiChannelMetricBucket.channel,
			model: aiChannelMetricBucket.model,
			bucketStart: aiChannelMetricBucket.bucketStart,
			successCount: aiChannelMetricBucket.successCount,
			errorCount: aiChannelMetricBucket.errorCount,
			successLatencyMsTotal: aiChannelMetricBucket.successLatencyMsTotal
		})
		.from(aiChannelMetricBucket)
		.where(
			and(
				eq(aiChannelMetricBucket.model, input.model),
				gte(aiChannelMetricBucket.bucketStart, hourStart),
				lte(aiChannelMetricBucket.bucketStart, currentBucketStart)
			)
		)

	const metrics = new Map<string, ChannelMetric>()
	for (const channel of available) {
		const channelRows = rows.filter((row) => {
			return row.channel === channel.channel
		})
		const recent = aggregateWindow(channelRows, currentBucketStart - 4 * minuteMs, currentBucketStart)
		const hourly = aggregateWindow(channelRows, hourStart, currentBucketStart)
		metrics.set(channel.channel, {
			errorRate: combineMetric(recent.errorRate, hourly.errorRate),
			latencyMs: combineMetric(recent.latencyMs, hourly.latencyMs)
		})
	}

	const errorValues = [...metrics.values()]
		.map((metric) => metric.errorRate)
		.filter((value): value is number => value !== undefined)
	const latencyValues = [...metrics.values()]
		.map((metric) => metric.latencyMs)
		.filter((value): value is number => value !== undefined)
	const errorMedian = median(errorValues)
	const latencyMedian = median(latencyValues)
	const errorMax = max(errorValues)
	const latencyMax = max(latencyValues)
	const priceMax = Math.max(...available.map((channel) => channel.priceMultiplier))
	const errorWeight: number = config.routing.errorWeight
	const latencyWeight: number = config.routing.latencyWeight
	const priceWeight: number = config.routing.priceWeight
	const totalWeight = errorWeight + latencyWeight + priceWeight

	const ranked = available.map((channel): AIRankedChannel => {
		const metric = metrics.get(channel.channel)
		const errorPenalty = normalizeMetric(metric?.errorRate, errorMedian, errorMax)
		const latencyPenalty = normalizeMetric(metric?.latencyMs, latencyMedian, latencyMax)
		const pricePenalty = channel.priceMultiplier / priceMax
		const penalty =
			(errorPenalty * errorWeight + latencyPenalty * latencyWeight + pricePenalty * priceWeight) /
			totalWeight
		return {
			channel,
			score: Math.round((1 - penalty) * 1000) / 10
		}
	})

	ranked.sort((left, right) => {
		if (right.score !== left.score) {
			return right.score - left.score
		}
		return left.channel.channel.localeCompare(right.channel.channel)
	})
	return ranked
}

export function resolveAIChannel(
	config: AIRuntimeConfig,
	channel: string,
	target: AIChannelTarget,
	model: string
): AIChannel {
	const resolved = collectAIChannels(config, target, false).find((item) => {
		return item.channel === channel && item.models.includes(model)
	})
	if (!resolved) {
		throw new AIError('AI_CHANNEL_CONFIG_INVALID')
	}
	return resolved
}

export function createAIChannelMetricQuery(
	db: TenantShardDb,
	input: AIChannelMetricInput
): D1RawRunQuery {
	const bucketStart = Math.floor(input.startedAtMs / minuteMs) * minuteMs
	const isSuccess = input.result === 'success'
	const successCount = isSuccess ? 1 : 0
	const errorCount = isSuccess ? 0 : 1
	const latencyMs = isSuccess ? input.finishedAtMs - input.startedAtMs : 0
	return db.run(sql`
		INSERT INTO ai_channel_metric_buckets (
			channel,
			model,
			bucket_start,
			success_count,
			error_count,
			success_latency_ms_total
		)
		VALUES (${input.channel}, ${input.model}, ${bucketStart}, ${successCount}, ${errorCount}, ${latencyMs})
		ON CONFLICT(channel, model, bucket_start) DO UPDATE SET
			success_count = success_count + excluded.success_count,
			error_count = error_count + excluded.error_count,
			success_latency_ms_total = success_latency_ms_total + excluded.success_latency_ms_total
	`)
}

function collectAIChannels(
	config: AIRuntimeConfig,
	target: AIChannelTarget,
	enabledOnly: boolean
): AIChannel[] {
	return config.channels
		.filter((channel): boolean => {
			return (
				channel.area === target.taskType &&
				channel.provider === target.provider &&
				(!enabledOnly || channel.enabled)
			)
		})
		.map((channel): AIChannel => ({
			channel: channel.id,
			target,
			models: channel.models,
			priceMultiplier: channel.priceMultiplier,
			endpoint: channel.endpoint
		}))
}

function aggregateWindow(
	rows: AIChannelMetricRow[],
	startMs: number,
	endMs: number
): WindowMetric {
	let successCount = 0
	let errorCount = 0
	let successLatencyMsTotal = 0
	for (const row of rows) {
		if (row.bucketStart < startMs || row.bucketStart > endMs) {
			continue
		}
		successCount += row.successCount
		errorCount += row.errorCount
		successLatencyMsTotal += row.successLatencyMsTotal
	}
	const sampleCount = successCount + errorCount
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
	const sorted = [...values].sort((left, right) => left - right)
	const middle = Math.floor(sorted.length / 2)
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
	const resolvedValue = value ?? medianValue
	return maxValue === 0 ? 0 : (resolvedValue as number) / maxValue
}
