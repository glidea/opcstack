#!/usr/bin/env node
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { createHash, randomBytes } from 'node:crypto'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const CLIENT_ID = 'opcstack-agent'
const REDIRECT_URI_PATH = '/api/agent/authorization_callback'
const CONFIG_DIR = join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'opcstack')
const CREDENTIALS_PATH = join(CONFIG_DIR, 'credentials.json')
let refreshPromise

export function createPkcePair() {
	const verifier = randomBytes(32).toString('base64url')
	const challenge = createHash('sha256').update(verifier).digest('base64url')
	return { verifier, challenge }
}

export function parseScopes(value) {
	return String(value || 'agent').split(',').map((scope) => scope.trim()).filter(Boolean)
}

export function buildApiUrl(server, path) {
	return new URL(path, `${server.replace(/\/$/, '')}/`).toString()
}

export function resolveSameOriginUrl(server, path) {
	const url = new URL(path, `${server.replace(/\/$/, '')}/`)
	if (url.origin !== new URL(server).origin) {
		throw new Error('Only same-origin URLs can receive an Agent token')
	}
	return url
}

export function injectAccessToken(headers, accessToken) {
	for (const name of Object.keys(headers)) {
		if (name.toLowerCase() === 'authorization') {
			throw new Error('Authorization header is managed by opc')
		}
	}
	return { ...headers, Authorization: `Bearer ${accessToken}` }
}

async function readCredentials() {
	const content = await readFile(CREDENTIALS_PATH, 'utf8')
	return JSON.parse(content)
}

async function writeCredentials(credentials) {
	await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 })
	const temporaryPath = `${CREDENTIALS_PATH}.tmp-${process.pid}`
	await writeFile(temporaryPath, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600 })
	await chmod(temporaryPath, 0o600)
	await rename(temporaryPath, CREDENTIALS_PATH)
}

async function requestJson(url, init) {
	const response = await fetch(url, init)
	const body = await response.json()
	if (!response.ok) {
		throw new Error(body?.message || body?.error_description || `Request failed: ${response.status}`)
	}
	return body
}

function openBrowser(url) {
	const command = platform() === 'darwin' ? 'open' : platform() === 'win32' ? 'start' : 'xdg-open'
	spawn(command, [url], { detached: true, stdio: 'ignore', shell: platform() === 'win32' }).unref()
}

async function login(server, scopes) {
	const normalizedServer = server.replace(/\/$/, '')
	const pkce = createPkcePair()
	const created = await requestJson(buildApiUrl(normalizedServer, '/api/agent/create_authorization'), {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			code_challenge: pkce.challenge,
			code_challenge_method: 'S256',
			scopes
		})
	})
	console.log(`Open ${created.verification_uri_complete}`)
	try {
		openBrowser(created.verification_uri_complete)
	} catch {
		// The printed URL is sufficient when no desktop opener exists
	}

	let interval = Number(created.interval)
	while (true) {
		const result = await requestJson(buildApiUrl(normalizedServer, '/api/agent/poll_authorization'), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ device_code: created.device_code })
		})
		if (result.status === 'pending' || result.status === 'slow_down') {
			interval = Number(result.interval || interval)
			await new Promise((resolve) => setTimeout(resolve, interval * 1000))
			continue
		}
		if (result.status !== 'authorized') {
			throw new Error(`Authorization ${result.status}`)
		}
		const token = await requestJson(buildApiUrl(normalizedServer, '/api/auth/oauth2/token'), {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'authorization_code',
				client_id: CLIENT_ID,
				code: result.code,
				redirect_uri: new URL(REDIRECT_URI_PATH, `${normalizedServer}/`).toString(),
				code_verifier: pkce.verifier
			}).toString()
		})
		await writeCredentials({
			server: normalizedServer,
			client_id: CLIENT_ID,
			access_token: token.access_token,
			refresh_token: token.refresh_token,
			expires_at: Date.now() + Number(token.expires_in || 900) * 1000
		})
		console.log('Authenticated')
		return
	}
}

async function refreshCredentials(credentials) {
	if (refreshPromise) {
		return refreshPromise
	}
	refreshPromise = refreshCredentialsOnce(credentials)
	try {
		return await refreshPromise
	} finally {
		refreshPromise = undefined
	}
}

async function refreshCredentialsOnce(credentials) {
	let token
	try {
		token = await requestJson(buildApiUrl(credentials.server, '/api/auth/oauth2/token'), {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			client_id: CLIENT_ID,
			refresh_token: credentials.refresh_token
		}).toString()
		})
	} catch {
		await rm(CREDENTIALS_PATH, { force: true })
		throw new Error('AUTHORIZATION_REQUIRED')
	}
	const refreshed = {
		...credentials,
		access_token: token.access_token,
		refresh_token: token.refresh_token || credentials.refresh_token,
		expires_at: Date.now() + Number(token.expires_in || 900) * 1000
	}
	await writeCredentials(refreshed)
	return refreshed
}

async function apiRequest(method, path, body, query, headers) {
	let credentials = await readCredentials()
	if (Number(credentials.expires_at) <= Date.now() + 10_000) {
		credentials = await refreshCredentials(credentials)
	}
	const url = resolveSameOriginUrl(credentials.server, path)
	if (query) {
		for (const [key, value] of Object.entries(query)) {
			url.searchParams.set(key, String(value))
		}
	}
	const requestHeaders = { ...headers }
	const hasContentType = Object.keys(requestHeaders).some((name) => name.toLowerCase() === 'content-type')
	const requestHeadersWithDefaults = {
		...requestHeaders,
		...(body === undefined || hasContentType ? {} : { 'content-type': 'application/json' })
	}
	const init = {
		method,
		headers: injectAccessToken(requestHeadersWithDefaults, credentials.access_token),
		...(body === undefined ? {} : { body: JSON.stringify(body) })
	}
	let response = await fetch(url, init)
	if (response.status === 401) {
		credentials = await refreshCredentials(credentials)
		init.headers = injectAccessToken(requestHeadersWithDefaults, credentials.access_token)
		response = await fetch(url, init)
	}
	const responseBody = await response.text()
	if (!response.ok) {
		throw new Error(responseBody || `Request failed: ${response.status}`)
	}
	console.log(responseBody)
}

async function main(argv) {
	const [group, action, ...args] = argv
	if (group === 'auth' && action === 'login') {
		const serverIndex = args.indexOf('--server')
		const server = serverIndex >= 0 ? args[serverIndex + 1] : undefined
		if (!server) throw new Error('Usage: opc auth login --server URL [--scopes a,b]')
		const scopeIndex = args.indexOf('--scopes')
		const scopes = parseScopes(scopeIndex >= 0 ? args[scopeIndex + 1] : 'agent')
		await login(server, scopes)
		return
	}
	if (group === 'auth' && action === 'connect') {
		return main(['auth', 'login', ...args])
	}
	if (group === 'auth' && action === 'logout') {
		await rm(CREDENTIALS_PATH, { force: true })
		console.log('Logged out')
		return
	}
	if (group === 'auth' && action === 'status') {
		const credentials = await readCredentials()
		console.log(JSON.stringify({ server: credentials.server, expires_at: credentials.expires_at }))
		return
	}
	if (group === 'api' && action === 'request') {
		const methodIndex = args.indexOf('--method')
		const urlIndex = args.indexOf('--url')
		const method = methodIndex >= 0 ? args[methodIndex + 1] : args[0]
		const path = urlIndex >= 0 ? args[urlIndex + 1] : args[1]
		if (!method || !path) throw new Error('Usage: opc api request METHOD /path [--body JSON]')
		const bodyIndex = args.indexOf('--body')
		const body = bodyIndex >= 0 ? JSON.parse(args[bodyIndex + 1]) : undefined
		const queryIndex = args.indexOf('--query')
		const query = queryIndex >= 0 ? JSON.parse(args[queryIndex + 1]) : undefined
		const headers = {}
		for (let index = 0; index < args.length; index += 1) {
			if (args[index] !== '--header') continue
			const separator = String(args[index + 1]).indexOf(':')
			if (separator < 1) throw new Error('Invalid header')
			const name = String(args[index + 1]).slice(0, separator)
			const value = String(args[index + 1]).slice(separator + 1).trim()
			headers[name] = value
		}
		await apiRequest(method, path, body, query, headers)
		return
	}
	throw new Error('Usage: opc auth login|logout|status or opc api request')
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main(process.argv.slice(2)).catch((error) => {
		console.error(error instanceof Error ? error.message : String(error))
		process.exitCode = 1
	})
}
