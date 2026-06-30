import { createAuthClient } from 'better-auth/svelte'
import { emailOTPClient, genericOAuthClient } from 'better-auth/client/plugins'

export const AUTH_TOKEN_STORAGE_KEY = 'auth_token'

type AuthClient = ReturnType<typeof createAuthClient>

export type ApiClient = {
	json<TResponse>(req: ApiJsonRequest): Promise<TResponse>
}

export type ApiJsonRequest = {
	path: string
	method?: string
	body?: unknown
}

export type Client = {
	auth: AuthClient
	api: ApiClient
}

export type ClientOptions = {
	baseUrl: string
	fetchApi?: typeof fetch
	getToken?: () => string | undefined | Promise<string | undefined>
}

type AuthSuccessContext = {
	data?: {
		token?: string | null
	} | null
}

export function createClient(options: ClientOptions): Client {
	const auth: AuthClient = createAuth(options)
	const api: ApiClient = createApi(options)

	return {
		auth,
		api
	}
}

export const client: Client = createClient({
	baseUrl: typeof window === 'undefined' ? '' : window.location.origin,
	getToken: readAuthToken
})

function createAuth(options: ClientOptions): AuthClient {
	const auth: AuthClient = createAuthClient({
		baseURL: options.baseUrl,
		fetchOptions: {
			auth: {
				type: 'Bearer',
				token: options.getToken ?? readAuthToken
			},
			onSuccess(context: AuthSuccessContext): void {
				saveAuthToken(context)
			}
		},
		plugins: [emailOTPClient(), genericOAuthClient()]
	})

	const signOut: AuthClient['signOut'] = auth.signOut
	auth.signOut = async (...args: Parameters<AuthClient['signOut']>): ReturnType<AuthClient['signOut']> => {
		const result = await signOut(...args)
		clearAuthToken()
		return result
	}

	return auth
}

function createApi(options: ClientOptions): ApiClient {
	const fetchApi: typeof fetch = options.fetchApi ?? fetch

	return {
		async json<TResponse>(req: ApiJsonRequest): Promise<TResponse> {
			const headers: Headers = new Headers()
			headers.set('content-type', 'application/json')

			const token: string | undefined = await options.getToken?.()
			if (token !== undefined && token !== '') {
				headers.set('authorization', `Bearer ${token}`)
			}

			const response: Response = await fetchApi(new URL(req.path, options.baseUrl), {
				method: req.method ?? 'POST',
				headers,
				body: req.body === undefined ? undefined : JSON.stringify(req.body)
			})

			return (await response.json()) as TResponse
		}
	}
}

function saveAuthToken(context: AuthSuccessContext): void {
	const token: string = context.data?.token ?? ''
	if (token === '') {
		return
	}

	localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
}

function readAuthToken(): string | undefined {
	if (typeof localStorage === 'undefined') {
		return undefined
	}

	return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ?? undefined
}

function clearAuthToken(): void {
	localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
}
