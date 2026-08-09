import { error, redirect } from '@sveltejs/kit'

type AdminSession = {
	user: {
		id: string
		email: string
		name: string
	}
}

type AdminParentData = {
	locale: string
	siteName: string
	supportEmail: string
	canonicalUrl: string
	[key: string]: unknown
}

type AdminLayoutEvent = {
	fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
	params: { locale: string }
	parent: () => Promise<AdminParentData>
	url: URL
}

export async function load(event: AdminLayoutEvent): Promise<AdminParentData> {
	const parentData: AdminParentData = await event.parent()
	const response: Response = await event.fetch('/api/auth/get-session')
	const session: AdminSession | null = await response.json()
	if (session === null) {
		const redirectPath: string = `${event.url.pathname}${event.url.search}`
		const search: URLSearchParams = new URLSearchParams({ redirect: redirectPath })
		throw redirect(302, `/${event.params.locale}/login?${search.toString()}`)
	}
	if (session.user.email !== parentData.supportEmail.toLowerCase()) {
		throw error(403, 'Forbidden')
	}

	return parentData
}
