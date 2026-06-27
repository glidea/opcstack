import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/utils/define-content-script'
import { clientConfig } from '$web/config/client'

export default defineContentScript({
	matches: clientConfig.extension.hostPermissions,
	main(): void {
		void browser.runtime.sendMessage({
			type: 'opcstack:content-ping',
			url: window.location.href
		})
	}
})
