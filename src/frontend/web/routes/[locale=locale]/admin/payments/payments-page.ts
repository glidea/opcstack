import type { ListAdminPaymentTransactionsRequest } from '$apiContract/payment'

export type PaymentStatusVariant = 'outline' | 'secondary' | 'destructive'

export function parsePaymentListQuery(url: URL): ListAdminPaymentTransactionsRequest {
	const userId: string = url.searchParams.get('user_id')?.trim() ?? ''
	const type: string = url.searchParams.get('type')?.trim() ?? ''
	const status: string = url.searchParams.get('status')?.trim() ?? ''
	const rawPage: number = Number(url.searchParams.get('page') ?? '1')
	return {
		...(userId === '' ? {} : { user_id: userId }),
		...(type === '' ? {} : { type }),
		...(status === '' ? {} : { status }),
		page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
		page_size: 20
	}
}

export function createPaymentSearchParams(
	input: ListAdminPaymentTransactionsRequest
): URLSearchParams {
	const params: URLSearchParams = new URLSearchParams()
	const entries: [string, string | undefined][] = [
		['user_id', input.user_id],
		['type', input.type],
		['status', input.status]
	]
	for (const [name, value] of entries) {
		if (value !== undefined && value !== '') {
			params.set(name, value)
		}
	}
	if ((input.page ?? 1) > 1) {
		params.set('page', String(input.page))
	}
	return params
}

export function formatPaymentAmount(amount: number, currency: string, locale: string): string {
	const formatter: Intl.NumberFormat = new Intl.NumberFormat(locale, {
		style: 'currency',
		currency
	})
	const minorUnitDigits: number | undefined = formatter.resolvedOptions().maximumFractionDigits
	if (minorUnitDigits === undefined) {
		throw new Error(`Currency precision is unavailable: ${currency}`)
	}
	return formatter.format(amount / 10 ** minorUnitDigits)
}

export function getPaymentStatusVariant(status: string): PaymentStatusVariant {
	switch (status) {
		case 'paid':
		case 'completed':
			return 'secondary'
		case 'refunded':
		case 'disputed':
			return 'destructive'
		default:
			return 'outline'
	}
}

export function createPaymentUserHref(locale: string, userId: string): string {
	return `/${locale}/admin/users?search=${encodeURIComponent(userId)}`
}
