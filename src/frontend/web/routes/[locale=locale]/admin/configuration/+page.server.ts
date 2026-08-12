import { redirect } from '@sveltejs/kit'

export function load({ params }: { params: { locale: string } }): never {
	throw redirect(302, `/${params.locale}/admin/configuration/general`)
}
