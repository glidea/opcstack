import { createHash, randomBytes } from 'node:crypto'
import { browserHeaders, CookieJar, readJson } from './http'

type CreatedAuthorization = {
	device_code: string
	user_code: string
}

type ResolvedAuthorization = {
	authorization_url: string
}

type AuthorizationPoll =
	| { status: 'pending' | 'slow_down' | 'expired' | 'denied' | 'consumed' }
	| { status: 'authorized'; code: string; redirect_uri: string }

export type OAuthTokenSet = {
	access_token: string
	refresh_token: string
	expires_in: number
}

export async function authorizeApiAccess(input: {
	appBaseUrl: string
	cookies: CookieJar
	scopes: string[]
}): Promise<OAuthTokenSet> {
	const verifier: string = randomBytes(32).toString('base64url')
	const challenge: string = createHash('sha256').update(verifier).digest('base64url')
	const createdResponse: Response = await fetch(
		`${input.appBaseUrl}/api/oauth/create_authorization`,
		{
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				client_id: 'opc-cli',
				scopes: input.scopes,
				code_challenge: challenge,
				code_challenge_method: 'S256'
			})
		}
	)
	expectHttpOk(createdResponse, 'create OAuth authorization')
	const created: CreatedAuthorization = await readJson<CreatedAuthorization>(createdResponse)
	await approveApiAccess({
		appBaseUrl: input.appBaseUrl,
		cookies: input.cookies,
		userCode: created.user_code
	})

	const pollResponse: Response = await fetch(`${input.appBaseUrl}/api/oauth/poll_authorization`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ device_code: created.device_code })
	})
	expectHttpOk(pollResponse, 'poll OAuth authorization')
	const poll: AuthorizationPoll = await readJson<AuthorizationPoll>(pollResponse)
	if (poll.status !== 'authorized') {
		throw new Error(`OAuth authorization was not completed: ${poll.status}`)
	}

	const tokenResponse: Response = await fetch(`${input.appBaseUrl}/api/auth/oauth2/token`, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			client_id: 'opc-cli',
			code: poll.code,
			redirect_uri: poll.redirect_uri,
			code_verifier: verifier,
			resource: input.appBaseUrl
		}).toString()
	})
	expectHttpOk(tokenResponse, 'exchange OAuth authorization code')
	return readJson<OAuthTokenSet>(tokenResponse)
}

export async function approveApiAccess(input: {
	appBaseUrl: string
	cookies: CookieJar
	userCode: string
}): Promise<void> {
	const resolvedResponse: Response = await fetch(
		`${input.appBaseUrl}/api/oauth/resolve_authorization`,
		{
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ user_code: input.userCode })
		}
	)
	expectHttpOk(resolvedResponse, 'resolve OAuth authorization')
	const resolved: ResolvedAuthorization =
		await readJson<ResolvedAuthorization>(resolvedResponse)

	const authorizeResponse: Response = await fetch(resolved.authorization_url, {
		headers: {
			accept: 'text/html',
			cookie: input.cookies.toHeader()
		},
		redirect: 'manual'
	})
	input.cookies.addResponse(authorizeResponse)
	const consentUrl: URL = await requireNavigationUrl(authorizeResponse, input.appBaseUrl)
	const state: string | null = consentUrl.searchParams.get('state')
	if (!consentUrl.pathname.endsWith('/oauth/consent') || !state) {
		throw new Error(`OAuth consent redirect was not returned: ${consentUrl.pathname}`)
	}

	const detailsResponse: Response = await fetch(
		`${input.appBaseUrl}/api/oauth/get_authorization_details`,
		{
			method: 'POST',
			headers: browserHeaders(input.appBaseUrl, input.cookies),
			body: JSON.stringify({ state })
		}
	)
	input.cookies.addResponse(detailsResponse)
	expectHttpOk(detailsResponse, 'read OAuth authorization details')

	const consentResponse: Response = await fetch(`${input.appBaseUrl}/api/auth/oauth2/consent`, {
		method: 'POST',
		headers: browserHeaders(input.appBaseUrl, input.cookies),
		body: JSON.stringify({ accept: true, oauth_query: consentUrl.searchParams.toString() }),
		redirect: 'manual'
	})
	input.cookies.addResponse(consentResponse)
	const callbackUrl: URL = await requireNavigationUrl(consentResponse, input.appBaseUrl)
	const callbackResponse: Response = await fetch(callbackUrl, {
		headers: browserHeaders(input.appBaseUrl, input.cookies),
		redirect: 'manual'
	})
	input.cookies.addResponse(callbackResponse)
	expectHttpOk(callbackResponse, 'complete OAuth authorization callback')
}

async function requireNavigationUrl(response: Response, appBaseUrl: string): Promise<URL> {
	const location: string | null = response.headers.get('location')
	if (response.status >= 300 && response.status < 400 && location) {
		return new URL(location, appBaseUrl)
	}
	if (response.ok) {
		const body: { redirect?: boolean; url?: string } =
			await readJson<{ redirect?: boolean; url?: string }>(response)
		if (body.redirect === true && body.url) {
			return new URL(body.url, appBaseUrl)
		}
	}
	throw new Error(`OAuth navigation was not returned: ${response.status}`)
}

function expectHttpOk(response: Response, operation: string): void {
	if (!response.ok) {
		throw new Error(`${operation} failed with ${response.status}`)
	}
}
