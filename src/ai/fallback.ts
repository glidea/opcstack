export interface AIEndpoint {
	baseURL: string
	apiKey: string
}

export function resolveAIEndpoints(
	baseURL: string,
	apiKey: string,
	fallbackBaseURL: string,
	fallbackApiKey: string
): AIEndpoint[] {
	const endpoints: AIEndpoint[] = [{ baseURL, apiKey }]
	if (fallbackBaseURL === '' && fallbackApiKey === '') {
		return endpoints
	}
	if (fallbackBaseURL === '' || fallbackApiKey === '') {
		throw new Error('AI_FALLBACK_CONFIG_INCOMPLETE')
	}

	endpoints.push({ baseURL: fallbackBaseURL, apiKey: fallbackApiKey })
	return endpoints
}

export async function runWithAIFallback<T>(
	endpoints: AIEndpoint[],
	run: (endpoint: AIEndpoint) => Promise<T>
): Promise<T> {
	let lastError: unknown
	for (const endpoint of endpoints) {
		try {
			return await run(endpoint)
		} catch (error) {
			lastError = error
		}
	}

	throw lastError
}
