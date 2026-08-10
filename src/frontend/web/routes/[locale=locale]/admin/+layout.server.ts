import { error, redirect } from '@sveltejs/kit'
import { createCloudflareWorkerUrl } from './admin-cloudflare'

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
	platform?: { env?: Cloudflare.Env }
	url: URL
}

type AdminLayoutData = AdminParentData & {
	cloudflareWorkerUrl: string | null
}

export async function load(event: AdminLayoutEvent): Promise<AdminLayoutData> {
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

	return {
		...parentData,
		cloudflareWorkerUrl: createCloudflareWorkerUrl(
			event.platform?.env?.R2_ACCOUNT_ID ?? '',
			event.platform?.env?.APP_NAME ?? ''
		)
	}
}
