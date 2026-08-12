import { error, redirect } from '@sveltejs/kit'
import { authCore } from '$backend/api/auth'
import { getMetaDb } from '$backend/db'
import { getAuthRuntimeConfig } from '$backend/config'
import { createCloudflareWorkerUrl } from './admin-cloudflare'

type AdminSession = {
	user: {
		id: string
		email: string
		name: string
		role?: string | null
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
	platform?: { env?: Env }
	request: Request
	url: URL
}

type AdminLayoutData = AdminParentData & {
	cloudflareWorkerUrl: string | null
}

export async function load(event: AdminLayoutEvent): Promise<AdminLayoutData> {
	const parentData: AdminParentData = await event.parent()
	const session: AdminSession | null = await readAdminSession(event)
	if (session === null) {
		const redirectPath: string = `${event.url.pathname}${event.url.search}`
		const search: URLSearchParams = new URLSearchParams({ redirect: redirectPath })
		throw redirect(302, `/${event.params.locale}/login?${search.toString()}`)
	}
	if (session.user.role !== 'admin') {
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

async function readAdminSession(event: AdminLayoutEvent): Promise<AdminSession | null> {
	const env: Env | undefined = event.platform?.env
	if (env?.META_DB) {
		const metaDb = getMetaDb(env.META_DB.withSession('first-primary'))
		const config = await getAuthRuntimeConfig(metaDb, env.CONFIG_ENCRYPTION_KEY)
		return authCore(env, metaDb, config).api.getSession({ headers: event.request.headers })
	}

	const response: Response = await event.fetch('/api/auth/get-session')
	return response.json()
}
