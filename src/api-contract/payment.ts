import { z } from 'zod'
import { PageRequestSchema, type ApiErrorResult } from './common'

export const ListPaymentProductsRequestSchema = z.object({})
export type ListPaymentProductsRequest = z.infer<typeof ListPaymentProductsRequestSchema>

export const PaymentProductItemSchema = z.object({
	product_id: z.string(),
	type: z.string(),
	name: z.string(),
	description: z.string(),
	price_amount: z.number(),
	currency: z.string(),
	credits_amount: z.string().nullable(),
	subscription_plan: z.string().nullable(),
	upgrade_rank: z.number().nullable(),
	period_credits_amount: z.string().nullable()
})
export type PaymentProductItem = z.infer<typeof PaymentProductItemSchema>

export const ListPaymentProductsResponseSchema = z.object({
	items: z.array(PaymentProductItemSchema)
})
export type ListPaymentProductsResponse = z.infer<typeof ListPaymentProductsResponseSchema>

export const CreatePaymentCheckoutRequestSchema = z.object({
	product_id: z.string().min(1),
	return_path: z.string().min(1).optional()
})
export type CreatePaymentCheckoutRequest = z.infer<typeof CreatePaymentCheckoutRequestSchema>

export const CreatePaymentCheckoutResponseSchema = z.object({
	checkout_order_id: z.string(),
	checkout_url: z.string()
})
export type CreatePaymentCheckoutResponse = z.infer<typeof CreatePaymentCheckoutResponseSchema>

export const GetSubscriptionRequestSchema = z.object({})
export type GetSubscriptionRequest = z.infer<typeof GetSubscriptionRequestSchema>

export const GetSubscriptionResponseSchema = z.object({
	subscription_plan: z.string().nullable(),
	subscription: z.object({
		product_id: z.string(),
		status: z.string(),
		current_period_start: z.number().nullable(),
		current_period_end: z.number().nullable(),
		canceled_at: z.number().nullable()
	}).nullable()
})
export type GetSubscriptionResponse = z.infer<typeof GetSubscriptionResponseSchema>

export const CancelSubscriptionRequestSchema = z.object({})
export type CancelSubscriptionRequest = z.infer<typeof CancelSubscriptionRequestSchema>

export const CancelSubscriptionResponseSchema = z.object({
	status: z.string(),
	current_period_end: z.number().nullable(),
	canceled_at: z.number().nullable()
})
export type CancelSubscriptionResponse = z.infer<typeof CancelSubscriptionResponseSchema>

export const UpgradeSubscriptionRequestSchema = z.object({
	product_id: z.string().min(1)
})
export type UpgradeSubscriptionRequest = z.infer<typeof UpgradeSubscriptionRequestSchema>

export const UpgradeSubscriptionResponseSchema = z.object({
	status: z.string()
})
export type UpgradeSubscriptionResponse = z.infer<typeof UpgradeSubscriptionResponseSchema>

export const ListPaymentTransactionsRequestSchema = PageRequestSchema.extend({
	type: z.string().min(1).optional(),
	status: z.string().min(1).optional()
})
export type ListPaymentTransactionsRequest = z.infer<typeof ListPaymentTransactionsRequestSchema>

export const ListAdminPaymentTransactionsRequestSchema = PageRequestSchema.extend({
	user_id: z.string().min(1).optional(),
	type: z.string().min(1).optional(),
	status: z.string().min(1).optional()
})
export type ListAdminPaymentTransactionsRequest = z.infer<typeof ListAdminPaymentTransactionsRequestSchema>

export const PaymentTransactionItemSchema = z.object({
	id: z.string(),
	type: z.string(),
	status: z.string(),
	product_id: z.string(),
	amount: z.number(),
	currency: z.string(),
	credits_granted: z.string(),
	paid_at: z.number().nullable(),
	refunded_at: z.number().nullable(),
	disputed_at: z.number().nullable(),
	created_at: z.number()
})
export type PaymentTransactionItem = z.infer<typeof PaymentTransactionItemSchema>

export const AdminPaymentTransactionItemSchema = PaymentTransactionItemSchema.extend({
	user_id: z.string()
})
export type AdminPaymentTransactionItem = z.infer<typeof AdminPaymentTransactionItemSchema>

export const ListPaymentTransactionsResponseSchema = z.object({
	items: z.array(PaymentTransactionItemSchema),
	total: z.number()
})
export type ListPaymentTransactionsResponse = z.infer<typeof ListPaymentTransactionsResponseSchema>

export const ListAdminPaymentTransactionsResponseSchema = z.object({
	items: z.array(AdminPaymentTransactionItemSchema),
	total: z.number()
})
export type ListAdminPaymentTransactionsResponse = z.infer<
	typeof ListAdminPaymentTransactionsResponseSchema
>

export const ListPaymentProductsApi = {
	request: ListPaymentProductsRequestSchema,
	response: ListPaymentProductsResponseSchema,
	errors: {}
}

export const CreatePaymentCheckoutApi = {
	request: CreatePaymentCheckoutRequestSchema,
	response: CreatePaymentCheckoutResponseSchema,
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
		PAYMENT_DISABLED(): ApiErrorResult<'PAYMENT_DISABLED', 400> {
			return {
				status: 400,
				body: {
					code: 'PAYMENT_DISABLED',
					message: 'Payment is disabled'
				}
			}
		},
		PAYMENT_PRODUCT_NOT_FOUND(): ApiErrorResult<'PAYMENT_PRODUCT_NOT_FOUND', 400> {
			return {
				status: 400,
				body: {
					code: 'PAYMENT_PRODUCT_NOT_FOUND',
					message: 'Payment product not found'
				}
			}
		},
		PAYMENT_RETURN_PATH_INVALID(): ApiErrorResult<'PAYMENT_RETURN_PATH_INVALID', 400> {
			return {
				status: 400,
				body: {
					code: 'PAYMENT_RETURN_PATH_INVALID',
					message: 'Payment return path is invalid'
				}
			}
		}
	}
}

export const GetSubscriptionApi = {
	request: GetSubscriptionRequestSchema,
	response: GetSubscriptionResponseSchema,
	errors: {}
}

export const CancelSubscriptionApi = {
	request: CancelSubscriptionRequestSchema,
	response: CancelSubscriptionResponseSchema,
	errors: {
		SUBSCRIPTION_NOT_FOUND(): ApiErrorResult<'SUBSCRIPTION_NOT_FOUND', 404> {
			return {
				status: 404,
				body: {
					code: 'SUBSCRIPTION_NOT_FOUND',
					message: 'Subscription not found'
				}
			}
		},
		SUBSCRIPTION_ALREADY_CANCELED(): ApiErrorResult<'SUBSCRIPTION_ALREADY_CANCELED', 409> {
			return {
				status: 409,
				body: {
					code: 'SUBSCRIPTION_ALREADY_CANCELED',
					message: 'Subscription is already canceled'
				}
			}
		}
	}
}

export const UpgradeSubscriptionApi = {
	request: UpgradeSubscriptionRequestSchema,
	response: UpgradeSubscriptionResponseSchema,
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
		PAYMENT_DISABLED(): ApiErrorResult<'PAYMENT_DISABLED', 400> {
			return {
				status: 400,
				body: {
					code: 'PAYMENT_DISABLED',
					message: 'Payment is disabled'
				}
			}
		},
		SUBSCRIPTION_NOT_FOUND(): ApiErrorResult<'SUBSCRIPTION_NOT_FOUND', 404> {
			return {
				status: 404,
				body: {
					code: 'SUBSCRIPTION_NOT_FOUND',
					message: 'Subscription not found'
				}
			}
		},
		SUBSCRIPTION_NOT_ACTIVE(): ApiErrorResult<'SUBSCRIPTION_NOT_ACTIVE', 400> {
			return {
				status: 400,
				body: {
					code: 'SUBSCRIPTION_NOT_ACTIVE',
					message: 'Subscription is not active'
				}
			}
		},
		SUBSCRIPTION_TARGET_INVALID(): ApiErrorResult<'SUBSCRIPTION_TARGET_INVALID', 400> {
			return {
				status: 400,
				body: {
					code: 'SUBSCRIPTION_TARGET_INVALID',
					message: 'Target subscription product is invalid'
				}
			}
		},
		SUBSCRIPTION_CURRENT_INVALID(): ApiErrorResult<'SUBSCRIPTION_CURRENT_INVALID', 400> {
			return {
				status: 400,
				body: {
					code: 'SUBSCRIPTION_CURRENT_INVALID',
					message: 'Current subscription product is invalid'
				}
			}
		},
		SUBSCRIPTION_UPGRADE_NOT_ALLOWED(): ApiErrorResult<'SUBSCRIPTION_UPGRADE_NOT_ALLOWED', 400> {
			return {
				status: 400,
				body: {
					code: 'SUBSCRIPTION_UPGRADE_NOT_ALLOWED',
					message: 'Subscription upgrade is not allowed'
				}
			}
		},
		PAYMENT_PRODUCT_NOT_FOUND(): ApiErrorResult<'PAYMENT_PRODUCT_NOT_FOUND', 400> {
			return {
				status: 400,
				body: {
					code: 'PAYMENT_PRODUCT_NOT_FOUND',
					message: 'Payment product not found'
				}
			}
		}
	}
}

export const ListPaymentTransactionsApi = {
	request: ListPaymentTransactionsRequestSchema,
	response: ListPaymentTransactionsResponseSchema,
	errors: {
		INVALID_REQUEST(message: string): ApiErrorResult<'INVALID_REQUEST', 400> {
			return {
				status: 400,
				body: {
					code: 'INVALID_REQUEST',
					message
				}
			}
		}
	}
}

export const ListAdminPaymentTransactionsApi = {
	request: ListAdminPaymentTransactionsRequestSchema,
	response: ListAdminPaymentTransactionsResponseSchema,
	errors: {
		INVALID_REQUEST(message: string): ApiErrorResult<'INVALID_REQUEST', 400> {
			return {
				status: 400,
				body: {
					code: 'INVALID_REQUEST',
					message
				}
			}
		}
	}
}
