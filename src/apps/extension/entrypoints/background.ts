import { browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'

export default defineBackground((): void => {
	browser.runtime.onMessage.addListener((message: unknown): Promise<string | undefined> => {
		if (message === 'opcstack:ping') {
			return Promise.resolve('opcstack:pong')
		}

		return Promise.resolve(undefined)
	})
})
