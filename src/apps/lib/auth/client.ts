import { createAuthClient } from 'better-auth/svelte'
import { emailOTPClient, genericOAuthClient } from 'better-auth/client/plugins'

const AUTH_TOKEN_STORAGE_KEY = 'auth_token'

export type AuthTokenStorage = {
	getItem(key: string): string | null | Promise<string | null>
	setItem(key: string, value: string): void | Promise<void>
	removeItem(key: string): void | Promise<void>
}

export function getAuthTokenFromStorage(storage: AuthTokenStorage): string | undefined {
	const token = storage.getItem(AUTH_TOKEN_STORAGE_KEY)
	if (token !== null && typeof token !== 'string') {
		throw new Error('AUTH_TOKEN_STORAGE_ASYNC')
	}

	return token ?? undefined
}

export async function readAuthToken(storage: AuthTokenStorage): Promise<string | undefined> {
	const token = await storage.getItem(AUTH_TOKEN_STORAGE_KEY)
	return token ?? undefined
}

export async function writeAuthToken(storage: AuthTokenStorage, token: string): Promise<void> {
	await storage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
}

export async function removeAuthToken(storage: AuthTokenStorage): Promise<void> {
	await storage.removeItem(AUTH_TOKEN_STORAGE_KEY)
}

export function getAuthToken(): string | undefined {
	if (typeof localStorage === 'undefined') {
		return undefined
	}

	return getAuthTokenFromStorage(localStorage)
}

export function setAuthToken(token: string): void {
	void writeAuthToken(localStorage, token)
}

export function clearAuthToken(): void {
	void removeAuthToken(localStorage)
}

export function createClientAuth(baseURL: string, getToken: () => string | undefined | Promise<string | undefined>) {
	return createAuthClient({
		baseURL,
		fetchOptions: {
			auth: {
				type: 'Bearer',
				token: getToken
			}
		},
		plugins: [emailOTPClient(), genericOAuthClient()]
	})
}

// baseURL is only available in browser context; SSR skips auth client calls entirely
export const authClient = createClientAuth(typeof window !== 'undefined' ? window.location.origin : '', getAuthToken)
