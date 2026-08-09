import { describe, expect, test } from 'vitest'
import {
	createPaymentSearchParams,
	createPaymentUserHref,
	formatPaymentAmount,
	getPaymentStatusVariant,
	parsePaymentListQuery
} from './payments-page'

describe('admin payments page', (): void => {
	test('parses filters and pagination from the URL', (): void => {
		const url = new URL(
			'https://example.com/en/admin/payments?user_id=user-1&type=credits_purchase&status=disputed&page=2'
		)

		expect({ query: parsePaymentListQuery(url) }).toEqual({
			query: {
				user_id: 'user-1',
				type: 'credits_purchase',
				status: 'disputed',
				page: 2,
				page_size: 20
			}
		})
	})

	test('serializes only active filters', (): void => {
		const params = createPaymentSearchParams({ status: 'paid', page: 1, page_size: 20 })
		expect({ search: params.toString() }).toEqual({ search: 'status=paid' })
	})

	test('formats provider minor units using currency precision', (): void => {
		expect({ usd: formatPaymentAmount(1234, 'USD', 'en-US') }).toEqual({ usd: '$12.34' })
		expect({ jpy: formatPaymentAmount(1234, 'JPY', 'en-US') }).toEqual({ jpy: '¥1,234' })
	})

	test('highlights refunded and disputed transactions', (): void => {
		expect({
			paid: getPaymentStatusVariant('paid'),
			refunded: getPaymentStatusVariant('refunded'),
			disputed: getPaymentStatusVariant('disputed')
		}).toEqual({ paid: 'secondary', refunded: 'destructive', disputed: 'destructive' })
	})

	test('links a transaction user to the filtered user directory', (): void => {
		expect({ href: createPaymentUserHref('zh', 'user 1') }).toEqual({
			href: '/zh/admin/users?search=user%201'
		})
	})
})
