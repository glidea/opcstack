import { eq, sql } from 'drizzle-orm'
import type { AppDb } from '../db'
import { affReferral } from '../db/schema'
import { user } from '../db/schema.auth'
import {
	CREDIT_TRANSACTION_TYPE_AFFILIATE_INVITEE,
	CREDIT_TRANSACTION_TYPE_AFFILIATE_INVITER
} from '../credits'

export const AFF_CREDIT_SOURCE_INVITER = CREDIT_TRANSACTION_TYPE_AFFILIATE_INVITER
export const AFF_CREDIT_SOURCE_INVITEE = CREDIT_TRANSACTION_TYPE_AFFILIATE_INVITEE

export interface GetAffSummaryInput {
	userId: string
}

export interface AffSummary {
	affCode: string
	invitedCount: number
}

export interface BindAffInput {
	inviteeUserId: string
	affCode: string
	nowMs?: number
}

export interface BindAffResult {
	affId: string
	inviterUserId: string
	inviteeUserId: string
}

export class AffError extends Error {
	public readonly code: string

	constructor(code: string) {
		super(code)
		this.code = code
	}
}

export class AffService {
	private readonly db: AppDb

	constructor(db: AppDb) {
		this.db = db
	}

	async createCode(): Promise<string> {
		const maxAttempts: number = 10
		let attempt: number = 0
		while (attempt < maxAttempts) {
			const code: string = generateAffCode()
			const existing = await this.db.query.user.findFirst({
				columns: {
					id: true
				},
				where: eq(user.affCode, code)
			})
			if (!existing) {
				return code
			}
			attempt += 1
		}
		throw new AffError('AFF_CODE_GENERATE_FAILED')
	}

	async getSummary(input: GetAffSummaryInput): Promise<AffSummary> {
		const userRow = await this.db.query.user.findFirst({
			columns: {
				affCode: true
			},
			where: eq(user.id, input.userId)
		})
		if (!userRow) {
			throw new AffError('AFF_USER_NOT_FOUND')
		}

		const invitedCountRows = await this.db
			.select({
				count: sql<number>`count(*)`
			})
			.from(affReferral)
			.where(eq(affReferral.inviterUserId, input.userId))
		const invitedCount: number = Number(invitedCountRows[0]?.count ?? 0)

		return {
			affCode: userRow.affCode ?? '',
			invitedCount
		}
	}

	async bind(input: BindAffInput): Promise<BindAffResult> {
		const code: string = input.affCode.trim()
		if (code === '') {
			throw new AffError('INVALID_AFF_CODE')
		}

		const inviter = await this.db.query.user.findFirst({
			columns: {
				id: true,
				affCode: true
			},
			where: eq(user.affCode, code)
		})
		if (!inviter || inviter.id === input.inviteeUserId) {
			throw new AffError('INVALID_AFF_CODE')
		}

		const invitee = await this.db.query.user.findFirst({
			columns: {
				id: true
			},
			where: eq(user.id, input.inviteeUserId)
		})
		if (!invitee) {
			throw new AffError('AFF_USER_NOT_FOUND')
		}

		const nowMs: number = input.nowMs ?? Date.now()
		const affId: string = crypto.randomUUID()

		try {
			await this.db.insert(affReferral).values({
				id: affId,
				inviterUserId: inviter.id,
				inviteeUserId: input.inviteeUserId,
				createdAt: nowMs
			})
		} catch (error) {
			if (isAffAlreadyBoundError(error)) {
				throw new AffError('AFF_ALREADY_BOUND')
			}
			throw error
		}

		return {
			affId,
			inviterUserId: inviter.id,
			inviteeUserId: input.inviteeUserId
		}
	}
}

function generateAffCode(): string {
	const raw: string = crypto.randomUUID().replaceAll('-', '').slice(0, 8)
	return raw.toUpperCase()
}

function isAffAlreadyBoundError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false
	}
	const cause = readErrorCause(error)
	return (
		error.message.includes('aff_referrals_invitee_user_id_unique') ||
		error.message.includes('UNIQUE constraint failed: aff_referrals.invitee_user_id') ||
		isAffAlreadyBoundError(cause)
	)
}

function readErrorCause(error: Error): unknown {
	return (error as Error & { cause?: unknown }).cause
}
