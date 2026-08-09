import { redirect } from '@sveltejs/kit'

export async function load(event: { params: { locale: string } }): Promise<never> {
	throw redirect(302, `/${event.params.locale}/admin/overview`)
}
