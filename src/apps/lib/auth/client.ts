import { createAuthClient } from 'better-auth/svelte'
import { emailOTPClient, genericOAuthClient } from 'better-auth/client/plugins'

const AUTH_TOKEN_STORAGE_KEY = 'auth_token'

export function getAuthToken(): string | undefined {
	if (typeof localStorage === 'undefined') {
		return undefined
	}

	const token: string | null = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
	return token ?? undefined
}

export function setAuthToken(token: string): void {
	localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
}

export function clearAuthToken(): void {
	localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
}

// baseURL is only available in browser context; SSR skips auth client calls entirely
export const authClient = createAuthClient({
	baseURL: typeof window !== 'undefined' ? window.location.origin : '',
	fetchOptions: {
		auth: {
			type: 'Bearer',
			token: getAuthToken
		}
	},
	plugins: [emailOTPClient(), genericOAuthClient()]
})
