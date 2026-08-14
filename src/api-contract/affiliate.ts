import { z } from 'zod'
import { PageRequestSchema, type ApiErrorResult } from './common'

export const GetAffiliateSummaryRequestSchema = z.object({})
export type GetAffiliateSummaryRequest = z.infer<typeof GetAffiliateSummaryRequestSchema>

export const GetAffiliateSummaryResponseSchema = z.object({
	aff_enabled: z.boolean(),
	aff_code: z.string(),
	invited_count: z.number()
})
export type GetAffiliateSummaryResponse = z.infer<typeof GetAffiliateSummaryResponseSchema>

export const BindAffiliateRequestSchema = z.object({
	aff_code: z.string().min(1)
})
export type BindAffiliateRequest = z.infer<typeof BindAffiliateRequestSchema>

export const BindAffiliateResponseSchema = z.object({})
export type BindAffiliateResponse = z.infer<typeof BindAffiliateResponseSchema>

export const ListAdminAffiliateReferralsRequestSchema = PageRequestSchema.extend({
	search: z.string().min(1).optional(),
	reward_status: z.enum(['pending', 'completed']).optional()
})
export type ListAdminAffiliateReferralsRequest = z.infer<typeof ListAdminAffiliateReferralsRequestSchema>

export const AffiliateReferralUserSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string()
})

export const AdminAffiliateReferralItemSchema = z.object({
	id: z.string(),
	inviter: AffiliateReferralUserSchema,
	invitee: AffiliateReferralUserSchema,
	reward_status: z.enum(['pending', 'completed']),
	created_at: z.number()
})
export type AdminAffiliateReferralItem = z.infer<typeof AdminAffiliateReferralItemSchema>

export const ListAdminAffiliateReferralsResponseSchema = z.object({
	items: z.array(AdminAffiliateReferralItemSchema),
	total: z.number()
})
export type ListAdminAffiliateReferralsResponse = z.infer<typeof ListAdminAffiliateReferralsResponseSchema>

export const GetAffiliateSummaryApi = {
	request: GetAffiliateSummaryRequestSchema,
	response: GetAffiliateSummaryResponseSchema,
	errors: {
		AFF_USER_NOT_FOUND(): ApiErrorResult<'AFF_USER_NOT_FOUND', 404> {
			return {
				status: 404,
				body: {
					code: 'AFF_USER_NOT_FOUND',
					message: 'User not found'
				}
			}
		}
	}
}

export const BindAffiliateApi = {
	request: BindAffiliateRequestSchema,
	response: BindAffiliateResponseSchema,
	errors: {
		INVALID_REQUEST(message: string): ApiErrorResult<'INVALID_REQUEST', 400> {
			return {
				status: 400,
				body: {
					code: 'INVALID_REQUEST',
					message
				}
			}
		},
		INVALID_AFF_CODE(): ApiErrorResult<'INVALID_AFF_CODE', 400> {
			return {
				status: 400,
				body: {
					code: 'INVALID_AFF_CODE',
					message: 'Affiliate code is invalid'
				}
			}
		},
		AFF_ALREADY_BOUND(): ApiErrorResult<'AFF_ALREADY_BOUND', 409> {
			return {
				status: 409,
				body: {
					code: 'AFF_ALREADY_BOUND',
					message: 'Affiliate code is already bound'
				}
			}
		}
	}
}

export const ListAdminAffiliateReferralsApi = {
	request: ListAdminAffiliateReferralsRequestSchema,
	response: ListAdminAffiliateReferralsResponseSchema,
	errors: {
		INVALID_REQUEST(message: string): ApiErrorResult<'INVALID_REQUEST', 400> {
			return {
				status: 400,
				body: { code: 'INVALID_REQUEST', message }
			}
		}
	}
}
