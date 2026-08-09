import type {
	GenerateBetaCodesResponseCode,
	ListBetaCodesRequest
} from '$apiContract/beta'

export function parseBetaCodeListQuery(url: URL): ListBetaCodesRequest {
	const code: string = url.searchParams.get('code')?.trim() ?? ''
	const usedBy: string = url.searchParams.get('used_by')?.trim() ?? ''
	const usedValue: string | null = url.searchParams.get('used')
	const rawPage: number = Number(url.searchParams.get('page') ?? '1')
	const createdAtStart: number | undefined = readInteger(url.searchParams, 'created_at_start')
	const createdAtEnd: number | undefined = readInteger(url.searchParams, 'created_at_end')

	return {
		...(code === '' ? {} : { code }),
		...(usedBy === '' ? {} : { used_by: usedBy }),
		...(usedValue === 'true' ? { used: true } : {}),
		...(usedValue === 'false' ? { used: false } : {}),
		...(createdAtStart === undefined ? {} : { created_at_start: createdAtStart }),
		...(createdAtEnd === undefined ? {} : { created_at_end: createdAtEnd }),
		page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
		page_size: 20
	}
}

export function createBetaCodeSearchParams(input: ListBetaCodesRequest): URLSearchParams {
	const params: URLSearchParams = new URLSearchParams()
	if (input.code) {
		params.set('code', input.code)
	}
	if (input.used_by) {
		params.set('used_by', input.used_by)
	}
	if (input.used !== undefined) {
		params.set('used', String(input.used))
	}
	if (input.created_at_start !== undefined) {
		params.set('created_at_start', String(input.created_at_start))
	}
	if (input.created_at_end !== undefined) {
		params.set('created_at_end', String(input.created_at_end))
	}
	if ((input.page ?? 1) > 1) {
		params.set('page', String(input.page))
	}
	return params
}

export function validateGenerateCount(value: string): boolean {
	return /^[1-9]\d*$/.test(value)
}

export function joinBetaCodes(codes: Pick<GenerateBetaCodesResponseCode, 'code'>[]): string {
	return codes.map((item): string => item.code).join('\n')
}

function readInteger(params: URLSearchParams, name: string): number | undefined {
	const value: string | null = params.get(name)
	if (value === null || value === '') {
		return undefined
	}
	const parsed: number = Number(value)
	return Number.isInteger(parsed) ? parsed : undefined
}
