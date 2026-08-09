import { describe } from 'vitest'
import { runCases, type TestCase } from '../testing/bdd'
import { jwks, user } from './schema.auth'
import {
	checkoutOrder,
	creditRedemptionCode,
	d1Shard,
	agentAuthorizationRequest,
	agentGrant,
	paymentTransaction,
	userSubscription
} from './schema.meta'

describe('schema.meta', () => {
	type GivenDetail = {
		schema: string
	}

	type WhenDetail = {
		check: string
	}

	type ThenExpected = {
		result: boolean
	}

	const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
		{
			scenario: 'global payment ownership',
			given: 'meta schema',
			when: 'checking payment tables',
			then: 'checkout order payment transaction and subscription stay in meta',
			givenDetail: { schema: 'meta' },
			whenDetail: { check: 'payment-tables' },
			thenExpected: { result: true }
		},
		{
			scenario: 'redemption code ownership',
			given: 'meta schema',
			when: 'checking claim state fields',
			then: 'redemption code keeps claim state in meta',
			givenDetail: { schema: 'meta' },
			whenDetail: { check: 'redemption-claim-state' },
			thenExpected: { result: true }
		},
		{
			scenario: 'tenant credit ledger ownership',
			given: 'meta and auth schema',
			when: 'checking tenant ledger tables',
			then: 'tenant credit ledger state is not in meta',
			givenDetail: { schema: 'meta-auth' },
			whenDetail: { check: 'no-tenant-credit-ledger' },
			thenExpected: { result: true }
		},
		{
			scenario: 'tenant shard region metadata',
			given: 'meta schema',
			when: 'checking d1 shard fields',
			then: 'd1 shard records own region',
			givenDetail: { schema: 'meta' },
			whenDetail: { check: 'd1-shard-region' },
			thenExpected: { result: true }
		},
		{
			scenario: 'agent authorization ownership',
			given: 'meta schema',
			when: 'checking agent authorization tables',
			then: 'relay and grant state stay in meta',
			givenDetail: { schema: 'meta' },
			whenDetail: { check: 'agent-authorization-tables' },
			thenExpected: { result: true }
		},
		{
			scenario: 'agent jwt key ownership',
			given: 'auth schema',
			when: 'checking jwt key table',
			then: 'jwt signing keys stay in meta',
			givenDetail: { schema: 'auth' },
			whenDetail: { check: 'jwt-keys' },
			thenExpected: { result: true }
		}
	]

	runCases(cases, async (_given: GivenDetail, when: WhenDetail): Promise<ThenExpected> => {
		switch (when.check) {
			case 'payment-tables':
				return {
					result:
						checkoutOrder !== undefined &&
						paymentTransaction !== undefined &&
						userSubscription !== undefined
				}
			case 'redemption-claim-state':
				return {
					result:
						creditRedemptionCode.status !== undefined &&
						creditRedemptionCode.claimedBy !== undefined &&
						creditRedemptionCode.claimedAt !== undefined &&
						creditRedemptionCode.grantedAt !== undefined
				}
			case 'no-tenant-credit-ledger': {
				const metaSchema: typeof import('./schema.meta') = await import('./schema.meta')
				const userColumns: string[] = Object.keys(user)
				const metaExports: string[] = Object.keys(metaSchema)

				return {
					result:
						!userColumns.includes('creditBalance') &&
						!metaExports.includes('creditEntry') &&
						!metaExports.includes('creditTransaction')
				}
			}
			case 'd1-shard-region':
				return {
					result: d1Shard.region !== undefined
				}
			case 'agent-authorization-tables':
				return {
					result:
						agentAuthorizationRequest !== undefined && agentGrant !== undefined
				}
			case 'jwt-keys':
				return {
					result:
						jwks.publicKey !== undefined &&
						jwks.privateKey !== undefined &&
						jwks.createdAt !== undefined
				}
			default:
				return { result: false }
		}
	})
})
