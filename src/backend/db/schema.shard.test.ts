import { describe, expect, it } from 'vitest'
import { getTableConfig } from 'drizzle-orm/sqlite-core'
import { runCases, type TestCase } from '../testing/bdd'
import {
	aiProviderMetricBucket,
	aiImageTask,
	aiTtsTask,
	aiVideoTask,
	creditBalance,
	creditEntry,
	creditTransaction,
	feedback,
	notificationRead
} from './schema.shard'

describe('schema.shard', () => {
	type GivenDetail = Record<string, never>
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		hasCreditLedgerTables: boolean
		hasTenantUserTables: boolean
		hasAIImageTaskTable: boolean
		hasAITTSTaskTable: boolean
		hasAIVideoTaskTable: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'tenant shard schema ownership',
			given: 'shard schema',
			when: 'checking exported tables',
			then: 'contains tenant credit ledger and tenant user tables',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				hasCreditLedgerTables: true,
				hasTenantUserTables: true,
				hasAIImageTaskTable: true,
				hasAITTSTaskTable: true,
				hasAIVideoTaskTable: true
			}
		}
	]

	runCases(cases, (): ThenExpected => {
		return {
			hasCreditLedgerTables:
				creditBalance !== undefined &&
				creditEntry !== undefined &&
				creditTransaction !== undefined,
			hasTenantUserTables: feedback !== undefined && notificationRead !== undefined,
			hasAIImageTaskTable: aiImageTask !== undefined,
			hasAITTSTaskTable: aiTtsTask !== undefined,
			hasAIVideoTaskTable: aiVideoTask !== undefined
		}
	})

	it('defines provider routing metrics and task execution fields', () => {
		const metricConfig = getTableConfig(aiProviderMetricBucket)
		const imageConfig = getTableConfig(aiImageTask)
		const ttsConfig = getTableConfig(aiTtsTask)
		const videoConfig = getTableConfig(aiVideoTask)
		const metricColumns = metricConfig.columns.map((column) => column.name)
		const imageColumns = imageConfig.columns.map((column) => column.name)
		const ttsColumns = ttsConfig.columns.map((column) => column.name)
		const videoColumns = videoConfig.columns.map((column) => column.name)

		expect({
			metricColumns,
			metricPrimaryKey: metricConfig.primaryKeys[0]?.columns.map((column) => column.name),
			metricIndexes: metricConfig.indexes.map((index) => index.config.name),
			imageColumns,
			ttsColumns,
			videoColumns,
			imageIndexes: imageConfig.indexes.map((index) => index.config.name),
			ttsIndexes: ttsConfig.indexes.map((index) => index.config.name),
			videoIndexes: videoConfig.indexes.map((index) => index.config.name)
		}).toEqual({
			metricColumns: [
					'provider_id',
				'model',
				'bucket_start',
				'success_count',
				'error_count',
				'success_latency_ms_total'
			],
			metricPrimaryKey: ['provider_id', 'model', 'bucket_start'],
			metricIndexes: ['ai_provider_metric_buckets_bucket_start_idx'],
			imageColumns: expect.arrayContaining(['provider_type', 'provider_id']),
			ttsColumns: expect.arrayContaining(['provider_type', 'provider_id']),
			videoColumns: expect.arrayContaining([
				'provider_type',
				'provider_id',
				'provider_started_at',
				'failed_provider_ids_json'
			]),
			imageIndexes: expect.arrayContaining(['ai_image_tasks_status_updated_at_idx']),
			ttsIndexes: expect.arrayContaining(['ai_tts_tasks_status_updated_at_idx']),
			videoIndexes: expect.arrayContaining(['ai_video_tasks_status_updated_at_idx'])
		})

		const videoFailedProviders = videoConfig.columns.find((column) => {
			return column.name === 'failed_provider_ids_json'
		})
		const imageProvider = imageConfig.columns.find((column) => column.name === 'provider_id')
		const ttsProvider = ttsConfig.columns.find((column) => column.name === 'provider_id')
		const videoProvider = videoConfig.columns.find((column) => column.name === 'provider_id')
		expect(videoFailedProviders?.notNull).toBe(true)
		expect(videoFailedProviders?.hasDefault).toBe(true)
		expect(imageProvider?.notNull).toBe(false)
		expect(ttsProvider?.notNull).toBe(false)
		expect(videoProvider?.notNull).toBe(false)
	})
})
