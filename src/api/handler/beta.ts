import { and, desc, eq, isNull } from 'drizzle-orm'
import type { Context } from 'hono'
import { z } from 'zod'
import type { NewBetaCode } from '../../db/schema'
import { betaCode } from '../../db/schema'
import { parse } from './utils'
import type { ApiEnv } from '..'

export const BindBetaCodeRequestSchema = z.object({
	beta_code: z.string().min(1)
})
export type BindBetaCodeRequest = z.infer<typeof BindBetaCodeRequestSchema>

export const GenerateBetaCodesRequestSchema = z.object({
	count: z.number().int().min(1).optional().default(1)
})
export type GenerateBetaCodesRequest = z.infer<typeof GenerateBetaCodesRequestSchema>

export interface GenerateBetaCodesResponseCode {
	id: string
	code: string
}

export interface GenerateBetaCodesResponse {
	codes: GenerateBetaCodesResponseCode[]
}

export interface ListBetaCodesResponseCode {
	id: string
	code: string
	used_by: string | null
	used_at: number | null
	created_at: number
}

export interface ListBetaCodesResponse {
	codes: ListBetaCodesResponseCode[]
}

export async function bindBetaCodeHandler(ctx: Context<ApiEnv>): Promise<Response> {
	if (String(ctx.env.BETA_CODE_ENABLED) !== 'true') {
		return ctx.json({})
	}

	const req = await parse(ctx, BindBetaCodeRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_BETA_CODE' }, 400)
	}

	const userId = ctx.get('userId')
	const db = ctx.get('db')
	const updateResult = await db
		.update(betaCode)
		.set({
			usedBy: userId,
			usedAt: Date.now()
		})
		.where(and(eq(betaCode.code, req.beta_code), isNull(betaCode.usedBy)))

	if (updateResult.meta.changes === 0) {
		const alreadyBoundBeta = await db.query.betaCode.findFirst({
			columns: {
				id: true
			},
			where: eq(betaCode.usedBy, userId)
		})
		if (alreadyBoundBeta) {
			return ctx.json({ code: 'BETA_CODE_ALREADY_BOUND' }, 409)
		}

		return ctx.json({ code: 'INVALID_BETA_CODE' }, 400)
	}

	return ctx.json({})
}

export async function generateBetaCodesHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const req = await parse(ctx, GenerateBetaCodesRequestSchema)
	if (!req) {
		return ctx.json({ code: 'INVALID_REQUEST' }, 400)
	}

	const db = ctx.get('db')
	const now = Date.now()
	const rows: NewBetaCode[] = []
	let index = 0
	while (index < req.count) {
		const row: NewBetaCode = {
			id: crypto.randomUUID(),
			code: createBetaCode(),
			createdAt: now
		}
		rows.push(row)
		index += 1
	}

	await db.insert(betaCode).values(rows)

	const codes: GenerateBetaCodesResponseCode[] = rows.map((row) => {
		return {
			id: row.id,
			code: row.code
		}
	})
	return ctx.json({ codes } as GenerateBetaCodesResponse)
}

export async function listBetaCodesHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const db = ctx.get('db')
	const rows = await db.query.betaCode.findMany({
		columns: {
			id: true,
			code: true,
			usedBy: true,
			usedAt: true,
			createdAt: true
		},
		orderBy: [desc(betaCode.createdAt)]
	})

	const codes: ListBetaCodesResponseCode[] = rows.map((row) => {
		return {
			id: row.id,
			code: row.code,
			used_by: row.usedBy,
			used_at: row.usedAt,
			created_at: row.createdAt
		}
	})
	return ctx.json({ codes } as ListBetaCodesResponse)
}

function createBetaCode(): string {
	return crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()
}
