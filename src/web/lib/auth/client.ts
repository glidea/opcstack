import { createAuthClient } from 'better-auth/svelte'
import { emailOTPClient } from 'better-auth/client/plugins'

// baseURL is only available in browser context; SSR skips auth client calls entirely
export const authClient = createAuthClient({
	baseURL: typeof window !== 'undefined' ? window.location.origin : '',
	plugins: [emailOTPClient()]
})
