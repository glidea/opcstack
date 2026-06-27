export type ApiClient = {
	requestJson<TResponse>(input: ApiJsonRequest): Promise<TResponse>
}

export type ApiJsonRequest = {
	path: string
	method?: string
	body?: unknown
}

export type ApiClientOptions = {
	baseUrl: string
	fetchApi: typeof fetch
	getToken: () => string | undefined | Promise<string | undefined>
}

export function createApiClient(options: ApiClientOptions): ApiClient {
	return {
		async requestJson<TResponse>(input: ApiJsonRequest): Promise<TResponse> {
			const headers = new Headers()
			headers.set('content-type', 'application/json')

			const token = await options.getToken()
			if (token !== undefined && token !== '') {
				headers.set('authorization', `Bearer ${token}`)
			}

			const response = await options.fetchApi(new URL(input.path, options.baseUrl), {
				method: input.method ?? 'POST',
				headers,
				body: input.body === undefined ? undefined : JSON.stringify(input.body)
			})

			return await response.json() as TResponse
		}
	}
}
