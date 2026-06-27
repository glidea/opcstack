import { z } from 'zod'
import { PageRequestSchema, type PageResponse } from './common'

export type PaymentProductItem = {
	product_id: string
	type: string
	name: string
	description: string
	price_amount: number
	currency: string
	credits_amount: string | null
	subscription_plan: string | null
	upgrade_rank: number | null
	period_credits_amount: string | null
}

export type ListPaymentProductsResponse = {
	items: PaymentProductItem[]
}

export const CreatePaymentCheckoutRequestSchema = z.object({
	product_id: z.string().min(1),
	return_path: z.string().min(1).optional()
})
export type CreatePaymentCheckoutRequest = z.infer<typeof CreatePaymentCheckoutRequestSchema>

export type CreatePaymentCheckoutResponse = {
	checkout_order_id: string
	checkout_url: string
}

export type GetSubscriptionResponse = {
	subscription_plan: string | null
	subscription: {
		product_id: string
		status: string
		current_period_start: number | null
		current_period_end: number | null
		canceled_at: number | null
	} | null
}

export type CancelSubscriptionResponse = {
	status: string
	current_period_end: number | null
	canceled_at: number | null
}

export const UpgradeSubscriptionRequestSchema = z.object({
	product_id: z.string().min(1)
})
export type UpgradeSubscriptionRequest = z.infer<typeof UpgradeSubscriptionRequestSchema>

export type UpgradeSubscriptionResponse = {
	status: string
}

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

export type PaymentTransactionItem = {
	id: string
	type: string
	status: string
	product_id: string
	amount: number
	currency: string
	credits_granted: string
	paid_at: number | null
	refunded_at: number | null
	disputed_at: number | null
	created_at: number
}

export type AdminPaymentTransactionItem = PaymentTransactionItem & {
	user_id: string
}

export type ListPaymentTransactionsResponse = PageResponse<PaymentTransactionItem>
export type ListAdminPaymentTransactionsResponse = PageResponse<AdminPaymentTransactionItem>
