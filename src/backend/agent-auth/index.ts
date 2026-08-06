import { and, eq, sql } from 'drizzle-orm'
import type { MetaDb } from '../db'
import { agentAuthorizationRequest, agentGrant } from '../db/schema'
import { runRawD1Batch } from '../db'

export const AGENT_CLIENT_ID = 'opcstack-agent'
export const AGENT_REDIRECT_PATH = '/api/agent/authorization_callback'
export const POLL_INTERVAL_SECONDS = 5
export const RELAY_EXPIRES_SECONDS = 10 * 60
export const AUTHORIZATION_CODE_EXPIRES_SECONDS = 60

const SCOPE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/
const MAX_SCOPE_COUNT = 20

export type AgentAuthErrorCode =
	| 'INVALID_SCOPE'
	| 'INVALID_DEVICE_CODE'
	| 'INVALID_STATE'
	| 'RELAY_EXPIRED'
	| 'RELAY_CONSUMED'
	| 'RELAY_DENIED'
	| 'RELAY_NOT_PENDING'
	| 'GRANT_NOT_FOUND'
	| 'GRANT_REVOKED'

export class AgentAuthError extends Error {
	readonly code: AgentAuthErrorCode

	constructor(code: AgentAuthErrorCode, message: string) {
		super(message)
		this.name = 'AgentAuthError'
		this.code = code
	}
}

export type ProtocolSecret = {
	value: string
	hash: string
}

export type CreatedRelayRequest = {
	id: string
	deviceCode: string
	userCode: string
	state: string
	scopes: string
	expiresAt: number
	interval: number
}

export type RelayPollResult =
	| { status: 'pending'; interval: number }
	| { status: 'slow_down'; interval: number }
	| { status: 'authorized'; code: string; redirectUri: string }
	| { status: 'expired' }
	| { status: 'denied' }
	| { status: 'consumed' }

export type RelayCompletion = {
	status: 'authorized'
}

export type AgentGrantRecord = {
	id: string
	userId: string
	clientId: string
	scopes: string
	status: 'active' | 'revoked'
	createdAt: number
	approvedAt: number
	revokedAt: number | null
}

export type RelayAuthorizationParams = {
	state: string
	codeChallenge: string
	scopes: string
}

export type RelayAuthorizationDetails = {
	clientId: string
	scopes: string
	expiresAt: number
}

export function canonicalizeScopes(scopes: string[]): string {
	if (scopes.length > MAX_SCOPE_COUNT) {
		throw new AgentAuthError('INVALID_SCOPE', 'Invalid scope')
	}

	const uniqueScopes = new Set<string>()
	for (const scope of scopes) {
		if (!SCOPE_PATTERN.test(scope)) {
			throw new AgentAuthError('INVALID_SCOPE', 'Invalid scope')
		}
		uniqueScopes.add(scope)
	}

	return Array.from(uniqueScopes).sort().join(' ')
}

export function parseCanonicalScopes(scopes: string): string[] {
	if (scopes === '') {
		return []
	}
	return scopes.split(' ')
}

export async function createProtocolSecret(): Promise<ProtocolSecret> {
	const bytes = new Uint8Array(32)
	crypto.getRandomValues(bytes)
	const value = encodeBase64Url(bytes)
	return {
		value,
		hash: await hashProtocolSecret(value)
	}
}

export async function hashProtocolSecret(value: string): Promise<string> {
	const bytes = new TextEncoder().encode(value)
	const digest = await crypto.subtle.digest('SHA-256', bytes)
	return encodeBase64Url(new Uint8Array(digest))
}

export function getRelayStatus(
	status: 'pending' | 'authorized' | 'denied' | 'expired' | 'consumed',
	expiresAt: number,
	nowMs: number
): 'pending' | 'authorized' | 'denied' | 'expired' | 'consumed' {
	if (status === 'pending' && nowMs > expiresAt) {
		return 'expired'
	}
	return status
}

export async function createRelayRequest(
	db: MetaDb,
	input: { codeChallenge: string; codeChallengeMethod: 'S256'; scopes: string[] },
	nowMs: number = Date.now()
): Promise<CreatedRelayRequest> {
	const scopes = canonicalizeScopes(input.scopes)
	const deviceCode = await createProtocolSecret()
	const userCode = await createUserCode()
	const stateValue = await deriveRelayState(userCode.value)
	const state = {
		value: stateValue,
		hash: await hashProtocolSecret(stateValue)
	}
	const id = crypto.randomUUID()
	const expiresAt = nowMs + RELAY_EXPIRES_SECONDS * 1000

	await db.insert(agentAuthorizationRequest).values({
		id,
		deviceCodeHash: deviceCode.hash,
		userCodeHash: userCode.hash,
		stateHash: state.hash,
		codeChallenge: input.codeChallenge,
		codeChallengeMethod: input.codeChallengeMethod,
		scopes,
		status: 'pending',
		expiresAt,
		createdAt: nowMs
	}).run()

	return {
		id,
		deviceCode: deviceCode.value,
		userCode: userCode.value,
		state: state.value,
		scopes,
		expiresAt,
		interval: POLL_INTERVAL_SECONDS
	}
}

export async function resolveRelayByUserCode(
	db: MetaDb,
	userCode: string,
	nowMs: number = Date.now()
): Promise<RelayAuthorizationParams> {
	const userCodeHash = await hashProtocolSecret(userCode)
	const relay = await db.query.agentAuthorizationRequest.findFirst({
		where: eq(agentAuthorizationRequest.userCodeHash, userCodeHash)
	})
	if (!relay) {
		throw new AgentAuthError('INVALID_DEVICE_CODE', 'Invalid user code')
	}
	if (relay.status === 'pending' && nowMs > relay.expiresAt) {
		await db
			.update(agentAuthorizationRequest)
			.set({ status: 'expired' })
			.where(and(eq(agentAuthorizationRequest.id, relay.id), eq(agentAuthorizationRequest.status, 'pending')))
		throw new AgentAuthError('RELAY_EXPIRED', 'Authorization request expired')
	}
	if (relay.status !== 'pending') {
		throw new AgentAuthError('RELAY_NOT_PENDING', 'Authorization request is not pending')
	}
	return {
		state: await deriveRelayState(userCode),
		codeChallenge: relay.codeChallenge,
		scopes: relay.scopes
	}
}

export async function resolveRelayByState(
	db: MetaDb,
	state: string
): Promise<RelayAuthorizationParams> {
	const stateHash = await hashProtocolSecret(state)
	const relay = await db.query.agentAuthorizationRequest.findFirst({
		where: eq(agentAuthorizationRequest.stateHash, stateHash)
	})
	if (!relay) {
		throw new AgentAuthError('INVALID_STATE', 'Invalid state')
	}
	return {
		state,
		codeChallenge: relay.codeChallenge,
		scopes: relay.scopes
	}
}

export async function getRelayDetailsByState(
	db: MetaDb,
	state: string,
	nowMs: number = Date.now()
): Promise<RelayAuthorizationDetails> {
	const stateHash = await hashProtocolSecret(state)
	const relay = await db.query.agentAuthorizationRequest.findFirst({
		where: eq(agentAuthorizationRequest.stateHash, stateHash)
	})
	if (!relay) {
		throw new AgentAuthError('INVALID_STATE', 'Invalid state')
	}
	if (relay.status === 'pending' && nowMs > relay.expiresAt) {
		await db
			.update(agentAuthorizationRequest)
			.set({ status: 'expired' })
			.where(and(eq(agentAuthorizationRequest.id, relay.id), eq(agentAuthorizationRequest.status, 'pending')))
			.run()
		throw new AgentAuthError('RELAY_EXPIRED', 'Authorization request expired')
	}
	if (relay.status !== 'pending') {
		throw new AgentAuthError('RELAY_NOT_PENDING', 'Authorization request is not pending')
	}
	return {
		clientId: AGENT_CLIENT_ID,
		scopes: relay.scopes,
		expiresAt: relay.expiresAt
	}
}

export async function pollRelay(
	db: MetaDb,
	deviceCode: string,
	nowMs: number = Date.now()
): Promise<RelayPollResult> {
	const deviceCodeHash = await hashProtocolSecret(deviceCode)
	const relay = await db.query.agentAuthorizationRequest.findFirst({
		where: eq(agentAuthorizationRequest.deviceCodeHash, deviceCodeHash)
	})
	if (!relay) {
		throw new AgentAuthError('INVALID_DEVICE_CODE', 'Invalid device code')
	}

	const status = getRelayStatus(
		relay.status as 'pending' | 'authorized' | 'denied' | 'expired' | 'consumed',
		relay.expiresAt,
		nowMs
	)
	if (status === 'expired' && relay.status === 'pending') {
		await db
			.update(agentAuthorizationRequest)
			.set({ status: 'expired' })
			.where(and(eq(agentAuthorizationRequest.id, relay.id), eq(agentAuthorizationRequest.status, 'pending')))
			.run()
		return { status: 'expired' }
	}
	if (status === 'denied') {
		return { status: 'denied' }
	}
	if (status === 'expired') {
		return { status: 'expired' }
	}
	if (status === 'consumed') {
		return { status: 'consumed' }
	}
	if (status === 'authorized') {
		if (relay.codeExpiresAt !== null && nowMs > relay.codeExpiresAt) {
			await db
				.update(agentAuthorizationRequest)
				.set({ status: 'expired' })
				.where(and(eq(agentAuthorizationRequest.id, relay.id), eq(agentAuthorizationRequest.status, 'authorized')))
			return { status: 'expired' }
		}
		const consumed = await db
			.update(agentAuthorizationRequest)
			.set({ status: 'consumed', consumedAt: nowMs })
			.where(and(eq(agentAuthorizationRequest.id, relay.id), eq(agentAuthorizationRequest.status, 'authorized')))
			.returning({ authorizationCode: agentAuthorizationRequest.authorizationCode })
		if (!consumed[0]?.authorizationCode) {
			return { status: 'consumed' }
		}
		return {
			status: 'authorized',
			code: consumed[0].authorizationCode,
			redirectUri: AGENT_REDIRECT_PATH
		}
	}

	const lastPolledAt = relay.lastPolledAt ?? 0
	const isTooSoon = lastPolledAt > 0 && nowMs - lastPolledAt < POLL_INTERVAL_SECONDS * 1000
	await db
		.update(agentAuthorizationRequest)
		.set({ lastPolledAt: nowMs })
		.where(and(eq(agentAuthorizationRequest.id, relay.id), eq(agentAuthorizationRequest.status, 'pending')))
		.run()
	if (isTooSoon) {
		return { status: 'slow_down', interval: POLL_INTERVAL_SECONDS * 2 }
	}
	return { status: 'pending', interval: POLL_INTERVAL_SECONDS }
}

export async function completeRelay(
	db: MetaDb,
	input: { state: string; authorizationCode: string },
	nowMs: number = Date.now()
): Promise<RelayCompletion> {
	const stateHash = await hashProtocolSecret(input.state)
	const relay = await db.query.agentAuthorizationRequest.findFirst({
		where: eq(agentAuthorizationRequest.stateHash, stateHash)
	})
	if (!relay) {
		throw new AgentAuthError('INVALID_STATE', 'Invalid state')
	}
	if (relay.status === 'pending' && nowMs > relay.expiresAt) {
		await db
			.update(agentAuthorizationRequest)
			.set({ status: 'expired' })
			.where(and(eq(agentAuthorizationRequest.id, relay.id), eq(agentAuthorizationRequest.status, 'pending')))
		throw new AgentAuthError('RELAY_EXPIRED', 'Authorization request expired')
	}
	if (relay.status !== 'pending') {
		throw new AgentAuthError('RELAY_NOT_PENDING', 'Authorization request is not pending')
	}

	await db
		.update(agentAuthorizationRequest)
		.set({
			status: 'authorized',
			authorizationCode: input.authorizationCode,
			codeExpiresAt: nowMs + AUTHORIZATION_CODE_EXPIRES_SECONDS * 1000
		})
		.where(and(eq(agentAuthorizationRequest.id, relay.id), eq(agentAuthorizationRequest.status, 'pending')))
		.run()
	return { status: 'authorized' }
}

export async function denyRelay(
	db: MetaDb,
	state: string,
	nowMs: number = Date.now()
): Promise<void> {
	const stateHash = await hashProtocolSecret(state)
	await db
		.update(agentAuthorizationRequest)
		.set({ status: 'denied', consumedAt: nowMs })
		.where(and(eq(agentAuthorizationRequest.stateHash, stateHash), eq(agentAuthorizationRequest.status, 'pending')))
		.run()
}

export async function getOrCreateActiveGrant(
	db: MetaDb,
	input: { userId: string; clientId: string; scopes: string[] },
	nowMs: number = Date.now()
): Promise<AgentGrantRecord> {
	const scopes = canonicalizeScopes(input.scopes)
	const id = crypto.randomUUID()
	await db.run(sql`
		INSERT INTO agent_grants (id, user_id, client_id, scopes, status, created_at, approved_at)
		SELECT ${id}, ${input.userId}, ${input.clientId}, ${scopes}, 'active', ${nowMs}, ${nowMs}
		WHERE NOT EXISTS (
			SELECT 1 FROM agent_grants
			WHERE user_id = ${input.userId} AND client_id = ${input.clientId} AND status = 'active'
		)
	`)
	const grant = await db.query.agentGrant.findFirst({
		where: and(
			eq(agentGrant.userId, input.userId),
			eq(agentGrant.clientId, input.clientId),
			eq(agentGrant.status, 'active')
		)
	})
	if (!grant) {
		throw new AgentAuthError('GRANT_NOT_FOUND', 'Agent grant not found')
	}
	return toAgentGrantRecord(grant)
}

export async function getAgentGrant(db: MetaDb, grantId: string): Promise<AgentGrantRecord> {
	const grant = await db.query.agentGrant.findFirst({ where: eq(agentGrant.id, grantId) })
	if (!grant) {
		throw new AgentAuthError('GRANT_NOT_FOUND', 'Agent grant not found')
	}
	return toAgentGrantRecord(grant)
}

export async function updateActiveGrantScopes(
	db: MetaDb,
	input: { userId: string; clientId: string; scopes: string[] }
): Promise<AgentGrantRecord> {
	const scopes = canonicalizeScopes(input.scopes)
	await db.run(sql`
		UPDATE agent_grants
		SET scopes = ${scopes}
		WHERE user_id = ${input.userId}
		  AND client_id = ${input.clientId}
		  AND status = 'active'
	`)
	return getOrCreateActiveGrant(db, input)
}

export async function revokeAgentGrant(
	db: MetaDb,
	input: { grantId: string; userId: string },
	nowMs: number = Date.now()
): Promise<void> {
	const grant = await db.query.agentGrant.findFirst({
		where: and(eq(agentGrant.id, input.grantId), eq(agentGrant.userId, input.userId))
	})
	if (!grant) {
		throw new AgentAuthError('GRANT_NOT_FOUND', 'Agent grant not found')
	}
	if (grant.status === 'revoked') {
		return
	}

	await runRawD1Batch(db, [
		db.run(sql`
			UPDATE agent_grants
			SET status = 'revoked', revoked_at = ${nowMs}
			WHERE id = ${input.grantId} AND status = 'active'
		`),
		db.run(sql`
			DELETE FROM oauth_refresh_token
			WHERE reference_id = ${input.grantId}
		`)
	])
}

function toAgentGrantRecord(row: typeof agentGrant.$inferSelect): AgentGrantRecord {
	return {
		id: row.id,
		userId: row.userId,
		clientId: row.clientId,
		scopes: row.scopes,
		status: row.status as 'active' | 'revoked',
		createdAt: row.createdAt,
		approvedAt: row.approvedAt,
		revokedAt: row.revokedAt ?? null
	}
}

async function createUserCode(): Promise<ProtocolSecret> {
	const bytes = new Uint8Array(8)
	crypto.getRandomValues(bytes)
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
	let value = ''
	for (const byte of bytes) {
		value += alphabet[byte % alphabet.length]
	}
	const formatted = `${value.slice(0, 4)}-${value.slice(4)}`
	return {
		value: formatted,
		hash: await hashProtocolSecret(formatted)
	}
}

async function deriveRelayState(userCode: string): Promise<string> {
	return hashProtocolSecret(`opcstack-agent-state:${userCode}`)
}

function encodeBase64Url(bytes: Uint8Array): string {
	let binary = ''
	for (const byte of bytes) {
		binary += String.fromCharCode(byte)
	}
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}
