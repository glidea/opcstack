export function readAdminDetailKey(url: URL): string {
	return url.searchParams.get('detail')?.trim() ?? ''
}

export function createAdminPageSearch(
	params: URLSearchParams,
	detailKey: string
): string {
	const next: URLSearchParams = new URLSearchParams(params)
	if (detailKey === '') {
		next.delete('detail')
	} else {
		next.set('detail', detailKey)
	}
	return next.toString()
}
