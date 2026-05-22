import { describe } from 'vitest'
import { runCases, type TestCase } from '../testing/bdd'
import {
	buildShardDescriptors,
	buildD1DatabaseBindings,
	parseShardCount,
	tenantBindingName,
	tenantDatabaseName,
	type ShardDescriptor
} from './shards.mjs'

describe('parseShardCount', () => {
	type GivenDetail = {
		raw: string | undefined
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		count: number
		error: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'use default shard count',
			given: 'raw value is missing',
			when: 'parsing shard count',
			then: 'returns one',
			givenDetail: {
				raw: undefined
			},
			whenDetail: {},
			thenExpected: {
				count: 1,
				error: ''
			}
		},
		{
			scenario: 'parse explicit shard count',
			given: 'raw value is four',
			when: 'parsing shard count',
			then: 'returns four',
			givenDetail: {
				raw: '4'
			},
			whenDetail: {},
			thenExpected: {
				count: 4,
				error: ''
			}
		},
		{
			scenario: 'reject zero shard count',
			given: 'raw value is zero',
			when: 'parsing shard count',
			then: 'returns invalid count error',
			givenDetail: {
				raw: '0'
			},
			whenDetail: {},
			thenExpected: {
				count: 0,
				error: 'D1_SHARD_COUNT_INVALID'
			}
		},
		{
			scenario: 'reject fractional shard count',
			given: 'raw value is fractional',
			when: 'parsing shard count',
			then: 'returns invalid count error',
			givenDetail: {
				raw: '1.5'
			},
			whenDetail: {},
			thenExpected: {
				count: 0,
				error: 'D1_SHARD_COUNT_INVALID'
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		try {
			return {
				count: parseShardCount(given.raw),
				error: ''
			}
		} catch (error) {
			return {
				count: 0,
				error: error instanceof Error ? error.message : ''
			}
		}
	})
})

describe('buildShardDescriptors', () => {
	type GivenDetail = {
		appName: string
		count: number
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		shards: ShardDescriptor[]
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'build one shard descriptor',
			given: 'count is one',
			when: 'building shard descriptors',
			then: 'returns shard zero',
			givenDetail: {
				appName: 'opcstack',
				count: 1
			},
			whenDetail: {},
			thenExpected: {
				shards: [
					{
						id: 'shard_0000',
						bindingName: 'TENANT_DB_0000',
						databaseName: 'opcstack-shard-0000'
					}
				]
			}
		},
		{
			scenario: 'build four shard descriptors',
			given: 'count is four',
			when: 'building shard descriptors',
			then: 'returns shard zero through three',
			givenDetail: {
				appName: 'opcstack',
				count: 4
			},
			whenDetail: {},
			thenExpected: {
				shards: [
					{
						id: 'shard_0000',
						bindingName: 'TENANT_DB_0000',
						databaseName: 'opcstack-shard-0000'
					},
					{
						id: 'shard_0001',
						bindingName: 'TENANT_DB_0001',
						databaseName: 'opcstack-shard-0001'
					},
					{
						id: 'shard_0002',
						bindingName: 'TENANT_DB_0002',
						databaseName: 'opcstack-shard-0002'
					},
					{
						id: 'shard_0003',
						bindingName: 'TENANT_DB_0003',
						databaseName: 'opcstack-shard-0003'
					}
				]
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		return {
			shards: buildShardDescriptors(given.appName, given.count)
		}
	})
})

describe('tenant shard names', () => {
	type GivenDetail = {
		appName: string
		index: number
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		bindingName: string
		databaseName: string
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'format tenant shard zero',
			given: 'index is zero',
			when: 'building tenant names',
			then: 'uses four digit suffix',
			givenDetail: {
				appName: 'opcstack',
				index: 0
			},
			whenDetail: {},
			thenExpected: {
				bindingName: 'TENANT_DB_0000',
				databaseName: 'opcstack-shard-0000'
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		return {
			bindingName: tenantBindingName(given.index),
			databaseName: tenantDatabaseName(given.appName, given.index)
		}
	})
})

describe('buildD1DatabaseBindings', () => {
	type GivenDetail = {
		appName: string
		metaDatabaseId: string
		shards: ShardDescriptor[]
	}
	type WhenDetail = Record<string, never>
	type ThenExpected = {
		bindings: unknown[]
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'build meta and tenant bindings',
			given: 'one tenant shard exists',
			when: 'building d1 database bindings',
			then: 'returns meta binding followed by tenant binding',
			givenDetail: {
				appName: 'opcstack',
				metaDatabaseId: 'meta-id',
				shards: [
					{
						id: 'shard_0000',
						bindingName: 'TENANT_DB_0000',
						databaseName: 'opcstack-shard-0000'
					}
				]
			},
			whenDetail: {},
			thenExpected: {
				bindings: [
					{
						binding: 'META_DB',
						database_name: 'opcstack-meta',
						database_id: 'meta-id',
						migrations_dir: 'src/db/meta-migrations'
					},
					{
						binding: 'TENANT_DB_0000',
						database_name: 'opcstack-shard-0000',
						database_id: '00000000-0000-0000-0000-000000000000',
						migrations_dir: 'src/db/shard-migrations'
					}
				]
			}
		}
	]

	runCases(cases, async (given: GivenDetail): Promise<ThenExpected> => {
		return {
			bindings: buildD1DatabaseBindings(given.appName, given.metaDatabaseId, given.shards)
		}
	})
})
