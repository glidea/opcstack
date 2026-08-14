import { describe, expect, test } from 'vitest'
import {
	CreatePaymentProductRequestSchema,
	UpdatePaymentProductRequestSchema
} from './configuration'

describe('payment product contracts', (): void => {
	test('creates a link without caller-owned IDs or remote product facts', (): void => {
		const result = CreatePaymentProductRequestSchema.safeParse({
			provider: 'dodo',
			provider_product_id: 'prod_1',
			credits_amount: '100',
			subscription_plan: null,
			upgrade_rank: null,
			period_credits_amount: null
		})

		expect({ success: result.success }).toEqual({ success: true })
	})

	test('rejects caller-owned product IDs and types on create', (): void => {
		const result = CreatePaymentProductRequestSchema.safeParse({
			product_id: 'manual-id',
			provider: 'dodo',
			provider_product_id: 'prod_1',
			type: 'one_time',
			credits_amount: '100',
			subscription_plan: null,
			upgrade_rank: null,
			period_credits_amount: null
		})

		expect({ success: result.success }).toEqual({ success: false })
	})

	test('updates only local entitlement fields', (): void => {
		const result = UpdatePaymentProductRequestSchema.safeParse({
			product_id: 'system-id',
			credits_amount: '120',
			subscription_plan: null,
			upgrade_rank: null,
			period_credits_amount: null,
			expected_version: 1
		})

		expect({ success: result.success }).toEqual({ success: true })
	})
})
