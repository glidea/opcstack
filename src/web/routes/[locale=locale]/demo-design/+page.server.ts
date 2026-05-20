import { redirect } from '@sveltejs/kit'
import { serverConfig } from '$web/config/server.server'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = ({ params }) => {
	const theme = serverConfig.DESIGN_SYSTEM || 'apple-saas'
	throw redirect(302, `/${params.locale}/demo-design/${theme}`)
}
