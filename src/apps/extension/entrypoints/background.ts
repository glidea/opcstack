import { browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'

type ContentPingMessage = {
	type: 'opcstack:content-ping'
	url: string
}

export default defineBackground((): void => {
	browser.runtime.onMessage.addListener((message: unknown): Promise<string | undefined> => {
		if (isContentPingMessage(message)) {
			return Promise.resolve(`opcstack:content-pong:${message.url}`)
		}

		return Promise.resolve(undefined)
	})
})

function isContentPingMessage(message: unknown): message is ContentPingMessage {
	if (typeof message !== 'object' || message === null) {
		return false
	}

	const value = message as Record<string, unknown>
	return value['type'] === 'opcstack:content-ping' && typeof value['url'] === 'string'
}
