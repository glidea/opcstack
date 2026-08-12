import { redirect } from '@sveltejs/kit'
import type { PublicRuntimeConfig } from '$backend/config'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, parent }) => {
	const data = await parent() as { publicRuntimeConfig: PublicRuntimeConfig }
	const theme = data.publicRuntimeConfig.design_system
	throw redirect(302, `/${params.locale}/demo-design/${theme}`)
}
