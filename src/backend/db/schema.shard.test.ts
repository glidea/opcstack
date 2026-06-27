import { describe } from 'vitest'
import { runCases, type TestCase } from '../testing/bdd'
import {
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
})
