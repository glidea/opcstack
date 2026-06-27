import { describe } from 'vitest'
import { runCases, type TestCase } from '../testing/bdd'
import { dbSchema } from './index'
import { betaCode } from './schema.meta'
import { user } from './schema.auth'

describe('dbSchema', () => {
	type GivenDetail = Record<string, never>
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		hasMetaTables: boolean
		hasAuthTables: boolean
		hasShardRoutingTables: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'meta database schema ownership',
			given: 'combined meta schema',
			when: 'checking exported tables',
			then: 'contains auth meta and shard routing tables',
			givenDetail: {},
			whenDetail: {},
			thenExpected: {
				hasMetaTables: true,
				hasAuthTables: true,
				hasShardRoutingTables: true
			}
		}
	]

	runCases(cases, (): ThenExpected => {
		const schemaKeys: string[] = Object.keys(dbSchema)
		return {
			hasMetaTables: dbSchema.betaCode === betaCode,
			hasAuthTables: dbSchema.user === user,
			hasShardRoutingTables: schemaKeys.includes('d1Shard') && schemaKeys.includes('userShard')
		}
	})
})
