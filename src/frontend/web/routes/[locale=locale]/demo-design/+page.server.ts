import { redirect } from '@sveltejs/kit'
import { clientConfig } from '$frontend/config/client'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = ({ params }) => {
	const theme = clientConfig.designSystem
	throw redirect(302, `/${params.locale}/demo-design/${theme}`)
}
