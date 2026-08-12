export class CookieJar {
	private readonly cookies: Map<string, string> = new Map<string, string>()

	addResponse(response: Response): void {
		const headers: Headers & { getSetCookie?: () => string[] } = response.headers
		const values: string[] = headers.getSetCookie?.() ?? readCombinedSetCookie(headers.get('set-cookie'))
		for (const value of values) {
			const pair: string = value.split(';', 1)[0] ?? ''
			const separator: number = pair.indexOf('=')
			if (separator <= 0) {
				continue
			}
			const name: string = pair.slice(0, separator)
			const cookieValue: string = pair.slice(separator + 1)
			if (cookieValue === '') {
				this.cookies.delete(name)
				continue
			}
			this.cookies.set(name, cookieValue)
		}
	}

	toHeader(): string {
		return Array.from(this.cookies.entries())
			.map(([name, value]: [string, string]): string => `${name}=${value}`)
			.join('; ')
	}
}

export async function signInWithPassword(input: {
	appBaseUrl: string
	email: string
	password: string
}): Promise<{ response: Response; cookies: CookieJar }> {
	const cookies: CookieJar = new CookieJar()
	const response: Response = await fetch(`${input.appBaseUrl}/api/auth/sign-in/email`, {
		method: 'POST',
		headers: browserHeaders(input.appBaseUrl),
		body: JSON.stringify({ email: input.email, password: input.password }),
		redirect: 'manual'
	})
	cookies.addResponse(response)
	return { response, cookies }
}

export function browserHeaders(appBaseUrl: string, cookies?: CookieJar): Record<string, string> {
	const origin: string = new URL(appBaseUrl).origin
	const headers: Record<string, string> = {
		'content-type': 'application/json',
		origin,
		referer: `${origin}/`
	}
	if (cookies) {
		headers.cookie = cookies.toHeader()
	}
	return headers
}

export async function readJson<T>(response: Response): Promise<T> {
	return response.json() as Promise<T>
}

export function requireBookmark(response: Response): string {
	const bookmark: string | null = response.headers.get('x-d1-meta-bookmark')
	if (!bookmark) {
		throw new Error('CONFIGURATION_BOOKMARK_MISSING')
	}
	return bookmark
}

function readCombinedSetCookie(value: string | null): string[] {
	if (!value) {
		return []
	}
	return value.split(/,(?=\s*[^;,=]+=[^;,]*)/)
}
