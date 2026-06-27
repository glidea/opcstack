import { eq, sql } from 'drizzle-orm'
import type { MetaDb } from '../db'
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
	inviterGrantedAt: number | null
	inviteeGrantedAt: number | null
}

export interface MarkAffRewardGrantedInput {
	affId: string
	target: 'inviter' | 'invitee'
	nowMs?: number
}

export class AffError extends Error {
	public readonly code: string

	constructor(code: string) {
		super(code)
		this.code = code
	}
}

export class AffService {
	private readonly db: MetaDb

	constructor(db: MetaDb) {
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

		const row = {
			id: affId,
			inviterUserId: inviter.id,
			inviteeUserId: input.inviteeUserId,
			inviterGrantedAt: null,
			inviteeGrantedAt: null,
			createdAt: nowMs
		}

		const result: D1Result = await this.db
			.insert(affReferral)
			.values(row)
			.onConflictDoNothing()
			.run()
		if (readD1Changes(result) > 0) {
			return {
				affId,
				inviterUserId: inviter.id,
				inviteeUserId: input.inviteeUserId,
				inviterGrantedAt: null,
				inviteeGrantedAt: null
			}
		}

		const existing = await this.db.query.affReferral.findFirst({
			where: eq(affReferral.inviteeUserId, input.inviteeUserId)
		})
		if (!existing || existing.inviterUserId !== inviter.id) {
			throw new AffError('AFF_ALREADY_BOUND')
		}
		return {
			affId: existing.id,
			inviterUserId: existing.inviterUserId,
			inviteeUserId: existing.inviteeUserId,
			inviterGrantedAt: existing.inviterGrantedAt,
			inviteeGrantedAt: existing.inviteeGrantedAt
		}
	}

	async markRewardGranted(input: MarkAffRewardGrantedInput): Promise<void> {
		const nowMs: number = input.nowMs ?? Date.now()
		switch (input.target) {
			case 'inviter':
				await this.db
					.update(affReferral)
					.set({
						inviterGrantedAt: nowMs
					})
					.where(eq(affReferral.id, input.affId))
				return
			case 'invitee':
				await this.db
					.update(affReferral)
					.set({
						inviteeGrantedAt: nowMs
					})
					.where(eq(affReferral.id, input.affId))
				return
		}
	}
}

function generateAffCode(): string {
	const raw: string = crypto.randomUUID().replaceAll('-', '').slice(0, 8)
	return raw.toUpperCase()
}

function readD1Changes(result: unknown): number {
	const row = result as { meta?: { changes?: number } }
	return Number(row.meta?.changes ?? 0)
}
