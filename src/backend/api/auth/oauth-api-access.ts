import { and, eq, sql } from 'drizzle-orm'
import type { MetaDb } from '../../db'
import { runRawD1Batch } from '../../db'
import { oauthAuthorizationRequest, oauthGrant } from '../../db/schema'

export const API_SCOPES = [
	'account:write',
	'credits:read',
	'credits:write',
	'affiliate:read',
	'affiliate:write',
	'feedback:write',
	'notifications:read',
	'notifications:write',
	'payment:read',
	'payment:write',
	'admin:dashboard:read',
	'admin:users:read',
	'admin:beta:read',
	'admin:beta:write',
	'admin:credits:read',
	'admin:credits:write',
	'admin:affiliate:read',
	'admin:feedback:read',
	'admin:notifications:read',
	'admin:notifications:write',
	'admin:payment:read',
	'admin:ai:read',
	'config:general:read',
	'config:general:write',
	'config:authentication:read',
	'config:authentication:write',
	'config:email:read',
	'config:email:write',
	'config:credits:read',
	'config:credits:write',
	'config:affiliate:read',
	'config:affiliate:write',
	'config:payment:read',
	'config:payment:write',
	'config:ai:read',
	'config:ai:write'
] as const

export type ApiScope = (typeof API_SCOPES)[number]

const API_SCOPE_SET: ReadonlySet<string> = new Set<string>(API_SCOPES)

export function isApiScope(value: string): value is ApiScope {
	return API_SCOPE_SET.has(value)
}

export function isAdministratorScope(scope: ApiScope): boolean {
	return scope.startsWith('admin:') || scope.startsWith('config:')
}

export const OAUTH_API_CLIENT_ID = 'opc-cli'
export const OAUTH_API_REDIRECT_PATH = '/api/oauth/authorization_callback'
export const POLL_INTERVAL_SECONDS = 5
export const AUTHORIZATION_EXPIRES_SECONDS = 10 * 60
export const AUTHORIZATION_CODE_EXPIRES_SECONDS = 60

const MAX_SCOPE_COUNT = 20

export type OAuthApiAccessErrorCode =
	| 'INVALID_SCOPE'
	| 'INVALID_CLIENT'
	| 'INVALID_DEVICE_CODE'
	| 'INVALID_STATE'
	| 'AUTHORIZATION_EXPIRED'
	| 'AUTHORIZATION_CONSUMED'
	| 'AUTHORIZATION_DENIED'
	| 'AUTHORIZATION_NOT_PENDING'
	| 'GRANT_NOT_FOUND'
	| 'GRANT_REVOKED'

export class OAuthApiAccessError extends Error {
	readonly code: OAuthApiAccessErrorCode

	constructor(code: OAuthApiAccessErrorCode, message: string) {
		super(message)
		this.name = 'OAuthApiAccessError'
		this.code = code
	}
}

export type ProtocolSecret = {
	value: string
	hash: string
}

export type CreatedAuthorizationRequest = {
	id: string
	deviceCode: string
	userCode: string
	state: string
	scopes: ApiScope[]
	expiresAt: number
	interval: number
}

export type AuthorizationPollResult =
	| { status: 'pending'; interval: number }
	| { status: 'slow_down'; interval: number }
	| { status: 'authorized'; code: string; redirectUri: string }
	| { status: 'expired' }
	| { status: 'denied' }
	| { status: 'consumed' }

export type AuthorizationParams = {
	state: string
	codeChallenge: string
	scopes: ApiScope[]
}

export type AuthorizationDetails = {
	clientId: string
	grantId: string
	scopes: ApiScope[]
	expiresAt: number
}

export type OAuthGrantRecord = {
	id: string
	userId: string
	clientId: string
	scopes: ApiScope[]
	status: 'pending' | 'active' | 'revoked'
	createdAt: number
	approvedAt: number | null
	revokedAt: number | null
}

export function canonicalizeScopes(scopes: string[]): ApiScope[] {
	if (scopes.length === 0 || scopes.length > MAX_SCOPE_COUNT) {
		throw new OAuthApiAccessError('INVALID_SCOPE', 'At least one API scope is required')
	}

	const uniqueScopes: Set<ApiScope> = new Set<ApiScope>()
	for (const scope of scopes) {
		if (!isApiScope(scope)) {
			throw new OAuthApiAccessError('INVALID_SCOPE', `Invalid API scope: ${scope}`)
		}
		uniqueScopes.add(scope)
	}
	return Array.from(uniqueScopes).sort()
}

export async function createProtocolSecret(): Promise<ProtocolSecret> {
	const bytes: Uint8Array = new Uint8Array(32)
	crypto.getRandomValues(bytes)
	const value: string = encodeBase64Url(bytes)
	return {
		value,
		hash: await hashProtocolSecret(value)
	}
}

export async function hashProtocolSecret(value: string): Promise<string> {
	const bytes: Uint8Array = new TextEncoder().encode(value)
	const digest: ArrayBuffer = await crypto.subtle.digest('SHA-256', bytes.buffer as ArrayBuffer)
	return encodeBase64Url(new Uint8Array(digest))
}

export function getAuthorizationStatus(
	status: 'pending' | 'authorized' | 'denied' | 'expired' | 'consumed',
	expiresAt: number,
	nowMs: number
): 'pending' | 'authorized' | 'denied' | 'expired' | 'consumed' {
	if (status === 'pending' && nowMs > expiresAt) {
		return 'expired'
	}
	return status
}

export async function createAuthorizationRequest(
	db: MetaDb,
	input: {
		clientId: string
		codeChallenge: string
		codeChallengeMethod: 'S256'
		scopes: string[]
	},
	nowMs: number = Date.now()
): Promise<CreatedAuthorizationRequest> {
	if (input.clientId !== OAUTH_API_CLIENT_ID) {
		throw new OAuthApiAccessError('INVALID_CLIENT', 'Unknown OAuth client')
	}
	const scopes: ApiScope[] = canonicalizeScopes(input.scopes)
	const deviceCode: ProtocolSecret = await createProtocolSecret()
	const userCode: ProtocolSecret = await createUserCode()
	const stateValue: string = await deriveAuthorizationState(userCode.value)
	const stateHash: string = await hashProtocolSecret(stateValue)
	const id: string = crypto.randomUUID()
	const expiresAt: number = nowMs + AUTHORIZATION_EXPIRES_SECONDS * 1000

	await db
		.insert(oauthAuthorizationRequest)
		.values({
			id,
			clientId: input.clientId,
			deviceCodeHash: deviceCode.hash,
			userCodeHash: userCode.hash,
			stateHash,
			codeChallenge: input.codeChallenge,
			codeChallengeMethod: input.codeChallengeMethod,
			requestedScopes: scopes,
			status: 'pending',
			expiresAt,
			createdAt: nowMs
		})
		.run()

	return {
		id,
		deviceCode: deviceCode.value,
		userCode: userCode.value,
		state: stateValue,
		scopes,
		expiresAt,
		interval: POLL_INTERVAL_SECONDS
	}
}

export async function resolveAuthorizationByUserCode(
	db: MetaDb,
	userCode: string,
	nowMs: number = Date.now()
): Promise<AuthorizationParams> {
	const userCodeHash: string = await hashProtocolSecret(userCode)
	const request = await db.query.oauthAuthorizationRequest.findFirst({
		where: eq(oauthAuthorizationRequest.userCodeHash, userCodeHash)
	})
	assertPendingAuthorization(request, nowMs)
	return {
		state: await deriveAuthorizationState(userCode),
		codeChallenge: request.codeChallenge,
		scopes: canonicalizeScopes(request.requestedScopes)
	}
}

export async function resolveAuthorizationByState(
	db: MetaDb,
	state: string
): Promise<AuthorizationParams> {
	const request = await findAuthorizationByState(db, state)
	return {
		state,
		codeChallenge: request.codeChallenge,
		scopes: canonicalizeScopes(request.requestedScopes)
	}
}

export async function getAuthorizationDetailsByState(
	db: MetaDb,
	state: string,
	userId: string,
	nowMs: number = Date.now()
): Promise<AuthorizationDetails> {
	const request = await findAuthorizationByState(db, state)
	assertPendingAuthorization(request, nowMs)

	let grantId: string | null = request.grantId
	if (!grantId) {
		grantId = crypto.randomUUID()
		await runRawD1Batch(db, [
			db.run(sql`
				UPDATE oauth_grants
				SET status = 'revoked', revoked_at = ${nowMs}
				WHERE user_id = ${userId} AND client_id = ${request.clientId} AND status = 'pending'
			`),
			db.run(sql`
				INSERT INTO oauth_grants (id, user_id, client_id, scopes, status, created_at)
				VALUES (${grantId}, ${userId}, ${request.clientId}, ${JSON.stringify(request.requestedScopes)}, 'pending', ${nowMs})
			`),
			db.run(sql`
				UPDATE oauth_authorization_requests
				SET grant_id = ${grantId}
				WHERE id = ${request.id} AND grant_id IS NULL AND status = 'pending'
			`)
		])
	}

	const grant: OAuthGrantRecord = await getOAuthGrant(db, grantId)
	if (grant.userId !== userId || grant.status !== 'pending') {
		throw new OAuthApiAccessError('AUTHORIZATION_NOT_PENDING', 'Authorization request is not pending')
	}
	return {
		clientId: request.clientId,
		grantId,
		scopes: canonicalizeScopes(request.requestedScopes),
		expiresAt: request.expiresAt
	}
}

export async function pollAuthorization(
	db: MetaDb,
	deviceCode: string,
	nowMs: number = Date.now()
): Promise<AuthorizationPollResult> {
	const deviceCodeHash: string = await hashProtocolSecret(deviceCode)
	const request = await db.query.oauthAuthorizationRequest.findFirst({
		where: eq(oauthAuthorizationRequest.deviceCodeHash, deviceCodeHash)
	})
	if (!request) {
		throw new OAuthApiAccessError('INVALID_DEVICE_CODE', 'Invalid device code')
	}

	const status = getAuthorizationStatus(
		request.status as 'pending' | 'authorized' | 'denied' | 'expired' | 'consumed',
		request.expiresAt,
		nowMs
	)
	if (status === 'expired' && request.status === 'pending') {
		await updateAuthorizationStatus(db, request.id, 'pending', { status: 'expired' })
		return { status: 'expired' }
	}
	if (status === 'denied' || status === 'expired' || status === 'consumed') {
		return { status }
	}
	if (status === 'authorized') {
		if (request.codeExpiresAt !== null && nowMs > request.codeExpiresAt) {
			await updateAuthorizationStatus(db, request.id, 'authorized', { status: 'expired' })
			return { status: 'expired' }
		}
		const consumed = await db
			.update(oauthAuthorizationRequest)
			.set({ status: 'consumed', consumedAt: nowMs })
			.where(
				and(
					eq(oauthAuthorizationRequest.id, request.id),
					eq(oauthAuthorizationRequest.status, 'authorized')
				)
			)
			.returning({ authorizationCode: oauthAuthorizationRequest.authorizationCode })
		if (!consumed[0]?.authorizationCode) {
			return { status: 'consumed' }
		}
		return {
			status: 'authorized',
			code: consumed[0].authorizationCode,
			redirectUri: OAUTH_API_REDIRECT_PATH
		}
	}

	const lastPolledAt: number = request.lastPolledAt ?? 0
	const isTooSoon: boolean =
		lastPolledAt > 0 && nowMs - lastPolledAt < POLL_INTERVAL_SECONDS * 1000
	await updateAuthorizationStatus(db, request.id, 'pending', { lastPolledAt: nowMs })
	if (isTooSoon) {
		return { status: 'slow_down', interval: POLL_INTERVAL_SECONDS * 2 }
	}
	return { status: 'pending', interval: POLL_INTERVAL_SECONDS }
}

export async function completeAuthorization(
	db: MetaDb,
	input: { state: string; authorizationCode: string },
	nowMs: number = Date.now()
): Promise<{ status: 'authorized' }> {
	const request = await findAuthorizationByState(db, input.state)
	assertPendingAuthorization(request, nowMs)
	await updateAuthorizationStatus(db, request.id, 'pending', {
		status: 'authorized',
		authorizationCode: input.authorizationCode,
		codeExpiresAt: nowMs + AUTHORIZATION_CODE_EXPIRES_SECONDS * 1000
	})
	return { status: 'authorized' }
}

export async function activateGrantForAuthorization(
	db: MetaDb,
	input: { state: string; userId: string },
	nowMs: number = Date.now()
): Promise<OAuthGrantRecord> {
	const request = await findAuthorizationByState(db, input.state)
	if (!request.grantId) {
		throw new OAuthApiAccessError('GRANT_NOT_FOUND', 'OAuth grant not found')
	}
	const grant: OAuthGrantRecord = await getOAuthGrant(db, request.grantId)
	if (grant.userId !== input.userId) {
		throw new OAuthApiAccessError('GRANT_NOT_FOUND', 'OAuth grant not found')
	}
	await db
		.update(oauthGrant)
		.set({ status: 'active', approvedAt: nowMs })
		.where(and(eq(oauthGrant.id, grant.id), eq(oauthGrant.status, 'pending')))
		.run()
	return getOAuthGrant(db, grant.id)
}

export async function denyAuthorization(
	db: MetaDb,
	state: string,
	nowMs: number = Date.now()
): Promise<void> {
	const request = await findAuthorizationByState(db, state)
	const updateRequest = db.run(sql`
			UPDATE oauth_authorization_requests
			SET status = 'denied', consumed_at = ${nowMs}
			WHERE id = ${request.id} AND status = 'pending'
		`)
	if (request.grantId) {
		await runRawD1Batch(db, [
			updateRequest,
			db.run(sql`
				UPDATE oauth_grants
				SET status = 'revoked', revoked_at = ${nowMs}
				WHERE id = ${request.grantId} AND status = 'pending'
			`)
		])
		return
	}
	await updateRequest
}

export async function getGrantIdForAuthorization(
	db: MetaDb,
	state: string,
	userId: string
): Promise<string> {
	const request = await findAuthorizationByState(db, state)
	if (!request.grantId) {
		throw new OAuthApiAccessError('GRANT_NOT_FOUND', 'OAuth grant not found')
	}
	const grant: OAuthGrantRecord = await getOAuthGrant(db, request.grantId)
	if (grant.userId !== userId || grant.status !== 'pending') {
		throw new OAuthApiAccessError('GRANT_NOT_FOUND', 'OAuth grant not found')
	}
	return grant.id
}

export async function getOAuthGrant(db: MetaDb, grantId: string): Promise<OAuthGrantRecord> {
	const grant = await db.query.oauthGrant.findFirst({ where: eq(oauthGrant.id, grantId) })
	if (!grant) {
		throw new OAuthApiAccessError('GRANT_NOT_FOUND', 'OAuth grant not found')
	}
	return {
		id: grant.id,
		userId: grant.userId,
		clientId: grant.clientId,
		scopes: canonicalizeScopes(grant.scopes),
		status: grant.status as 'pending' | 'active' | 'revoked',
		createdAt: grant.createdAt,
		approvedAt: grant.approvedAt ?? null,
		revokedAt: grant.revokedAt ?? null
	}
}

export async function getPendingOAuthGrant(
	db: MetaDb,
	userId: string,
	clientId: string
): Promise<OAuthGrantRecord> {
	const grant = await db.query.oauthGrant.findFirst({
		where: and(
			eq(oauthGrant.userId, userId),
			eq(oauthGrant.clientId, clientId),
			eq(oauthGrant.status, 'pending')
		)
	})
	if (!grant) {
		throw new OAuthApiAccessError('GRANT_NOT_FOUND', 'Pending OAuth grant not found')
	}
	return {
		id: grant.id,
		userId: grant.userId,
		clientId: grant.clientId,
		scopes: canonicalizeScopes(grant.scopes),
		status: 'pending',
		createdAt: grant.createdAt,
		approvedAt: grant.approvedAt ?? null,
		revokedAt: grant.revokedAt ?? null
	}
}

export async function revokeOAuthGrant(
	db: MetaDb,
	input: { grantId: string; userId: string },
	nowMs: number = Date.now()
): Promise<void> {
	const grant: OAuthGrantRecord = await getOAuthGrant(db, input.grantId)
	if (grant.userId !== input.userId) {
		throw new OAuthApiAccessError('GRANT_NOT_FOUND', 'OAuth grant not found')
	}
	if (grant.status === 'revoked') {
		return
	}
	await runRawD1Batch(db, [
		db.run(sql`
			UPDATE oauth_grants
			SET status = 'revoked', revoked_at = ${nowMs}
			WHERE id = ${input.grantId}
		`),
		db.run(sql`
			UPDATE oauth_refresh_token
			SET revoked = ${nowMs}
			WHERE reference_id = ${input.grantId} AND revoked IS NULL
		`)
	])
}

async function findAuthorizationByState(db: MetaDb, state: string) {
	const stateHash: string = await hashProtocolSecret(state)
	const request = await db.query.oauthAuthorizationRequest.findFirst({
		where: eq(oauthAuthorizationRequest.stateHash, stateHash)
	})
	if (!request) {
		throw new OAuthApiAccessError('INVALID_STATE', 'Invalid state')
	}
	return request
}

function assertPendingAuthorization(
	request: Awaited<ReturnType<typeof findAuthorizationByState>> | undefined,
	nowMs: number
): asserts request is Awaited<ReturnType<typeof findAuthorizationByState>> {
	if (!request) {
		throw new OAuthApiAccessError('INVALID_DEVICE_CODE', 'Invalid user code')
	}
	if (request.status === 'pending' && nowMs > request.expiresAt) {
		throw new OAuthApiAccessError('AUTHORIZATION_EXPIRED', 'Authorization request expired')
	}
	if (request.status !== 'pending') {
		throw new OAuthApiAccessError(
			'AUTHORIZATION_NOT_PENDING',
			'Authorization request is not pending'
		)
	}
}

async function updateAuthorizationStatus(
	db: MetaDb,
	id: string,
	currentStatus: string,
	changes: Partial<typeof oauthAuthorizationRequest.$inferInsert>
): Promise<void> {
	await db
		.update(oauthAuthorizationRequest)
		.set(changes)
		.where(
			and(eq(oauthAuthorizationRequest.id, id), eq(oauthAuthorizationRequest.status, currentStatus))
		)
		.run()
}

async function createUserCode(): Promise<ProtocolSecret> {
	const bytes: Uint8Array = new Uint8Array(8)
	crypto.getRandomValues(bytes)
	const alphabet: string = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
	let value: string = ''
	for (const byte of bytes) {
		value += alphabet[byte % alphabet.length]
	}
	const formatted: string = `${value.slice(0, 4)}-${value.slice(4)}`
	return {
		value: formatted,
		hash: await hashProtocolSecret(formatted)
	}
}

async function deriveAuthorizationState(userCode: string): Promise<string> {
	return hashProtocolSecret(`opc-oauth-state:${userCode}`)
}

function encodeBase64Url(bytes: Uint8Array): string {
	let binary: string = ''
	for (const byte of bytes) {
		binary += String.fromCharCode(byte)
	}
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}
