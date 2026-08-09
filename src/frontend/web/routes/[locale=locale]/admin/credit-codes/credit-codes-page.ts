import type {
	CreditCodeResponseItem,
	ListCreditCodesRequest
} from '$apiContract/credits'

export type CreditCodeStatusVariant = 'outline' | 'destructive' | 'secondary'

export function parseCreditCodeListQuery(url: URL): ListCreditCodesRequest {
	const code: string = url.searchParams.get('code')?.trim() ?? ''
	const claimedBy: string = url.searchParams.get('claimed_by')?.trim() ?? ''
	const statusValue: string | null = url.searchParams.get('status')
	const amount: string = url.searchParams.get('amount')?.trim() ?? ''
	const rawPage: number = Number(url.searchParams.get('page') ?? '1')
	const status: ListCreditCodesRequest['status'] =
		statusValue === 'unused' || statusValue === 'claimed' || statusValue === 'granted'
			? statusValue
			: undefined

	return {
		...(code === '' ? {} : { code }),
		...(claimedBy === '' ? {} : { claimed_by: claimedBy }),
		...(status === undefined ? {} : { status }),
		...(amount === '' ? {} : { amount }),
		...readTimestamp(url.searchParams, 'created_at_start'),
		...readTimestamp(url.searchParams, 'created_at_end'),
		...readTimestamp(url.searchParams, 'expires_at_start'),
		...readTimestamp(url.searchParams, 'expires_at_end'),
		page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
		page_size: 20
	}
}

export function createCreditCodeSearchParams(input: ListCreditCodesRequest): URLSearchParams {
	const params: URLSearchParams = new URLSearchParams()
	const entries: [string, string | number | undefined][] = [
		['code', input.code],
		['claimed_by', input.claimed_by],
		['status', input.status],
		['amount', input.amount],
		['created_at_start', input.created_at_start],
		['created_at_end', input.created_at_end],
		['expires_at_start', input.expires_at_start],
		['expires_at_end', input.expires_at_end]
	]
	for (const [name, value] of entries) {
		if (value !== undefined && value !== '') {
			params.set(name, String(value))
		}
	}
	if ((input.page ?? 1) > 1) {
		params.set('page', String(input.page))
	}
	return params
}

export function getCreditCodeStatusVariant(status: string): CreditCodeStatusVariant {
	switch (status) {
		case 'unused':
			return 'outline'
		case 'claimed':
			return 'destructive'
		case 'granted':
			return 'secondary'
		default:
			throw new Error(`Unsupported credit code status: ${status}`)
	}
}

export function validateCreditCodeCount(value: string): boolean {
	if (!/^[1-9]\d*$/.test(value)) {
		return false
	}
	return Number(value) <= 200
}

export function validateCreditCodeAmount(value: string): boolean {
	return /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(value) && Number(value) > 0
}

export function joinCreditCodes(codes: Pick<CreditCodeResponseItem, 'code'>[]): string {
	return codes.map((item): string => item.code).join('\n')
}

function readTimestamp(params: URLSearchParams, name: string): Record<string, number> {
	const value: string | null = params.get(name)
	if (value === null || value === '') {
		return {}
	}
	const parsed: number = Number(value)
	return Number.isInteger(parsed) ? { [name]: parsed } : {}
}
