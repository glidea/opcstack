import { createHash } from 'node:crypto'
import { describe, expect } from 'vitest'
import { runCases, type TestCase } from './testing/bdd'

type PreBuildModule = {
	hashAdminPassword: (password: string) => string
	buildAdminUserUpsertSql: (input: AdminUserUpsertInput) => string
	buildAdminCredentialAccountUpsertSql: (input: AdminCredentialAccountUpsertInput) => string
	buildAdminUserShardEnsureSql: (input: AdminUserShardEnsureInput) => string
	buildAdminCreditBalanceEnsureSql: (input: AdminCreditBalanceEnsureInput) => string
}

type AdminUserUpsertInput = {
	email: string
	userId: string
	affCode: string
	nowMs: number
}

type AdminCredentialAccountUpsertInput = {
	email: string
	passwordHash: string
	nowMs: number
}

type AdminUserShardEnsureInput = {
	email: string
	nowMs: number
}

type AdminCreditBalanceEnsureInput = {
	userId: string
	nowMs: number
}

type SqlBuilderName = 'user' | 'account' | 'user_shard' | 'credit_balance'

const modulePath: string = '../pre-build.mjs'
const preBuild: PreBuildModule = (await import(modulePath)) as PreBuildModule

describe('pre-build admin sync builders', () => {
	type HashGiven = {
		password: string
	}
	type HashWhen = Record<string, never>
	type HashThen = {
		matchesFormat: boolean
		digestMatches: boolean
	}

	const hashCases: TestCase<HashGiven, HashWhen, HashThen>[] = [
		{
			scenario: 'hash admin password',
			given: 'a plain password',
			when: 'hashing for Better Auth credential account',
			then: 'returns salt hex and sha1 digest',
			givenDetail: {
				password: 'Pwd123456'
			},
			whenDetail: {},
			thenExpected: {
				matchesFormat: true,
				digestMatches: true
			}
		}
	]

	runCases(hashCases, (given) => {
		const hash: string = preBuild.hashAdminPassword(given.password)
		const parts: string[] = hash.split(':')
		const saltHex: string = parts[0] ?? ''
		const digestHex: string = parts[1] ?? ''
		const expectedDigest: string = createHash('sha1')
			.update(`${given.password}:${saltHex}`)
			.digest('hex')

		return {
			matchesFormat: /^[0-9a-f]{16}:[0-9a-f]{40}$/.test(hash),
			digestMatches: digestHex === expectedDigest
		}
	})

	type SqlGiven = Record<string, never>
	type SqlWhen = {
		builder: SqlBuilderName
		requiredParts: string[]
		forbiddenParts: string[]
	}
	type SqlThen = {
		ok: boolean
	}

	const sqlCases: TestCase<SqlGiven, SqlWhen, SqlThen>[] = [
		{
			scenario: 'build admin user upsert sql',
			given: 'a configured super admin email',
			when: 'building user sql',
			then: 'inserts missing user without updating existing profile',
			givenDetail: {},
			whenDetail: {
				builder: 'user',
				requiredParts: [
					'INSERT INTO "user"',
					"'admin@example.com'",
					"'u_admin'",
					"'AFFADMIN'",
					'email_verified',
					'ON CONFLICT(email) DO NOTHING'
				],
				forbiddenParts: ['DO UPDATE']
			},
			thenExpected: {
				ok: true
			}
		},
		{
			scenario: 'build admin credential account upsert sql',
			given: 'a configured super admin email and password hash',
			when: 'building credential account sql',
			then: 'updates existing credential password and inserts missing credential account',
			givenDetail: {},
			whenDetail: {
				builder: 'account',
				requiredParts: [
					'UPDATE account SET',
					"provider_id = 'credential'",
					'INSERT INTO account',
					'NOT EXISTS',
					"'hash''value'",
					'password'
				],
				forbiddenParts: ['UPDATE "user"']
			},
			thenExpected: {
				ok: true
			}
		},
		{
			scenario: 'build admin user shard ensure sql',
			given: 'a configured super admin email',
			when: 'building user shard sql',
			then: 'assigns least loaded active shard only when missing',
			givenDetail: {},
			whenDetail: {
				builder: 'user_shard',
				requiredParts: [
					'INSERT INTO user_shards',
					"status = 'active'",
					'ORDER BY assigned_count ASC, id ASC',
					'LIMIT 1',
					'assigned_count = assigned_count + 1',
					'created_at = 123456'
				],
				forbiddenParts: ['ON CONFLICT']
			},
			thenExpected: {
				ok: true
			}
		},
		{
			scenario: 'build admin credit balance ensure sql',
			given: 'a super admin user id',
			when: 'building tenant credit balance sql',
			then: 'creates missing zero balance without resetting existing balance',
			givenDetail: {},
			whenDetail: {
				builder: 'credit_balance',
				requiredParts: [
					'INSERT INTO credit_balances',
					"'u_admin'",
					'0',
					'ON CONFLICT(user_id) DO NOTHING'
				],
				forbiddenParts: ['DO UPDATE']
			},
			thenExpected: {
				ok: true
			}
		}
	]

	runCases(sqlCases, (_given, when) => {
		const sql: string = buildSql(when.builder)
		for (const part of when.requiredParts) {
			expect(sql).toContain(part)
		}
		for (const part of when.forbiddenParts) {
			expect(sql).not.toContain(part)
		}
		return {
			ok: true
		}
	})
})

function buildSql(builder: SqlBuilderName): string {
	switch (builder) {
		case 'user':
			return preBuild.buildAdminUserUpsertSql({
				email: 'admin@example.com',
				userId: 'u_admin',
				affCode: 'AFFADMIN',
				nowMs: 123456
			})
		case 'account':
			return preBuild.buildAdminCredentialAccountUpsertSql({
				email: 'admin@example.com',
				passwordHash: "hash'value",
				nowMs: 123456
			})
		case 'user_shard':
			return preBuild.buildAdminUserShardEnsureSql({
				email: 'admin@example.com',
				nowMs: 123456
			})
		case 'credit_balance':
			return preBuild.buildAdminCreditBalanceEnsureSql({
				userId: 'u_admin',
				nowMs: 123456
			})
	}
}
