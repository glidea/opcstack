import { addMessages, init, locale, _ } from 'svelte-i18n'
import { defaultLocale, supportedLocales, type SystemLocale } from './locales'

const messageModules = import.meta.glob('./messages/*.json', {
	eager: true,
	import: 'default'
}) as Record<string, Record<string, string>>

for (const path in messageModules) {
	const messages = messageModules[path]
	if (!messages) {
		continue
	}
	const filename = path.split('/').pop() ?? ''
	const localeName = filename.replace('.json', '')
	if (localeName === '') {
		continue
	}
	addMessages(localeName, messages)
}

init({
	fallbackLocale: defaultLocale,
	initialLocale: defaultLocale
})

export function setSystemLocale(next: SystemLocale): void {
	locale.set(next)
}

export { _, locale, defaultLocale, supportedLocales }
