import { isSystemLocale } from '$web/i18n/locales'

export function match(param: string): boolean {
	return isSystemLocale(param)
}
