import { and, desc, eq, gte, isNotNull, isNull, lte, sql, type SQL } from 'drizzle-orm'
import type { Context } from 'hono'
import type { NewBetaCode } from '../../db/schema'
import { betaCode } from '../../db/schema'
import { parseRequest } from '../../lib/request'
import type { ApiEnv } from '..'
import {
	BindBetaCodeApi,
	GenerateBetaCodesApi,
	ListBetaCodesApi,
	type BindBetaCodeRequest,
	type GenerateBetaCodesRequest,
	type GenerateBetaCodesResponse,
	type GenerateBetaCodesResponseCode,
	type ListBetaCodesResponse,
	type ListBetaCodesResponseCode
} from '../../../api-contract/beta'
import { getRequestAuthRuntimeConfig } from '../middleware/auth'

export type {
	BindBetaCodeRequest,
	GenerateBetaCodesRequest,
	GenerateBetaCodesResponse,
	ListBetaCodesResponse
} from '../../../api-contract/beta'

export async function bindBetaCodeHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const config = await getRequestAuthRuntimeConfig(ctx)
	if (!config.authentication.betaCodeEnabled) {
		return ctx.json({})
	}

	const request = await parseRequest(ctx, BindBetaCodeApi.request)
	if (!request.success) {
		const error = BindBetaCodeApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	const req = request.data

	const userId = ctx.get('userId')
	const db = ctx.get('metaDb')
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
			const error = BindBetaCodeApi.errors.BETA_CODE_ALREADY_BOUND()
			return ctx.json(error.body, error.status)
		}

		const error = BindBetaCodeApi.errors.INVALID_BETA_CODE()
		return ctx.json(error.body, error.status)
	}

	return ctx.json({})
}

export async function generateBetaCodesHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, GenerateBetaCodesApi.request)
	if (!request.success) {
		const error = GenerateBetaCodesApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	const req = request.data

	const db = ctx.get('metaDb')
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
	const request = await parseRequest(ctx, ListBetaCodesApi.request)
	if (!request.success) {
		const error = ListBetaCodesApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}
	const req = request.data

	const db = ctx.get('metaDb')
	const conditions: SQL[] = []
	if (req.code) {
		conditions.push(eq(betaCode.code, req.code))
	}
	if (req.used_by) {
		conditions.push(eq(betaCode.usedBy, req.used_by))
	}
	if (req.used === true) {
		conditions.push(isNotNull(betaCode.usedBy))
	}
	if (req.used === false) {
		conditions.push(isNull(betaCode.usedBy))
	}
	if (req.created_at_start !== undefined) {
		conditions.push(gte(betaCode.createdAt, req.created_at_start))
	}
	if (req.created_at_end !== undefined) {
		conditions.push(lte(betaCode.createdAt, req.created_at_end))
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined
	const offset = (req.page - 1) * req.page_size
	const totalRows = await db
		.select({ total: sql<number>`count(*)` })
		.from(betaCode)
		.where(where)
	const rows = await db.query.betaCode.findMany({
		columns: {
			id: true,
			code: true,
			usedBy: true,
			usedAt: true,
			createdAt: true
		},
		where,
		orderBy: [desc(betaCode.createdAt)],
		limit: req.page_size,
		offset
	})

	const items: ListBetaCodesResponseCode[] = rows.map((row) => {
		return {
			id: row.id,
			code: row.code,
			used_by: row.usedBy,
			used_at: row.usedAt,
			created_at: row.createdAt
		}
	})
	return ctx.json({ items, total: Number(totalRows[0]?.total ?? 0) } as ListBetaCodesResponse)
}

function createBetaCode(): string {
	return crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()
}
