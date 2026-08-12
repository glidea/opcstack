#!/usr/bin/env node
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { createHash, randomBytes } from 'node:crypto'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const CLIENT_ID = 'opc-cli'
const REDIRECT_URI_PATH = '/api/oauth/authorization_callback'
const CONFIG_DIR = join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'opcstack')
const CREDENTIALS_PATH = join(CONFIG_DIR, 'credentials.json')

export function createPkcePair() {
	const verifier = randomBytes(32).toString('base64url')
	const challenge = createHash('sha256').update(verifier).digest('base64url')
	return { verifier, challenge }
}

export function parseScopes(value) {
	return String(value || '').split(',').map((scope) => scope.trim()).filter(Boolean)
}

export function buildApiUrl(server, path) {
	return new URL(path, `${server.replace(/\/$/, '')}/`).toString()
}

export function resolveSameOriginUrl(server, path) {
	if (!String(path).startsWith('/') || String(path).startsWith('//')) {
		throw new Error('Only relative API paths can receive an access token')
	}
	const url = new URL(path, `${server.replace(/\/$/, '')}/`)
	if (url.origin !== new URL(server).origin) {
		throw new Error('Only relative API paths can receive an access token')
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

export function createEmptyCredentialStore() {
	return { connections: {} }
}

export function setConnection(store, name, connection) {
	return {
		connections: {
			...store.connections,
			[name]: connection
		}
	}
}

export function removeConnection(store, name) {
	const connections = { ...store.connections }
	delete connections[name]
	return { connections }
}

export function getConnection(store, name) {
	const connection = store.connections[name]
	if (!connection) {
		throw new Error(`Connection not found: ${name}`)
	}
	return connection
}

export function createRefreshTokenRequest(connection) {
	return {
		url: buildApiUrl(connection.server, '/api/auth/oauth2/token'),
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			client_id: CLIENT_ID,
			refresh_token: connection.refresh_token,
			resource: connection.server
		})
	}
}

async function readCredentialStore() {
	try {
		const content = await readFile(CREDENTIALS_PATH, 'utf8')
		const store = JSON.parse(content)
		if (!store || typeof store !== 'object' || !store.connections) {
			throw new Error('Invalid credential store')
		}
		return store
	} catch (error) {
		if (error && typeof error === 'object' && error.code === 'ENOENT') {
			return createEmptyCredentialStore()
		}
		throw error
	}
}

async function writeCredentialStore(store) {
	await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 })
	const temporaryPath = `${CREDENTIALS_PATH}.tmp-${process.pid}`
	await writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 })
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

async function connect(name, server, scopes) {
	const normalizedServer = server.replace(/\/$/, '')
	const pkce = createPkcePair()
	const created = await requestJson(buildApiUrl(normalizedServer, '/api/oauth/create_authorization'), {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			client_id: CLIENT_ID,
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
		const result = await requestJson(buildApiUrl(normalizedServer, '/api/oauth/poll_authorization'), {
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
				code_verifier: pkce.verifier,
				resource: normalizedServer
			}).toString()
		})
		const store = await readCredentialStore()
		await writeCredentialStore(setConnection(store, name, {
			server: normalizedServer,
			access_token: token.access_token,
			refresh_token: token.refresh_token,
			expires_at: Date.now() + Number(token.expires_in || 900) * 1000,
			scopes
		}))
		console.log(`Connected ${name}`)
		return
	}
}

async function refreshConnection(name, store, connection) {
	let token
	try {
		const request = createRefreshTokenRequest(connection)
		token = await requestJson(request.url, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: request.body.toString()
		})
	} catch {
		await writeCredentialStore(removeConnection(store, name))
		throw new Error('AUTHORIZATION_REQUIRED')
	}
	const refreshed = {
		...connection,
		access_token: token.access_token,
		refresh_token: token.refresh_token || connection.refresh_token,
		expires_at: Date.now() + Number(token.expires_in || 900) * 1000
	}
	const nextStore = setConnection(store, name, refreshed)
	await writeCredentialStore(nextStore)
	return { store: nextStore, connection: refreshed }
}

async function apiRequest(name, method, path, body, query, headers) {
	let store = await readCredentialStore()
	let connection = getConnection(store, name)
	if (Number(connection.expires_at) <= Date.now() + 10_000) {
		const refreshed = await refreshConnection(name, store, connection)
		store = refreshed.store
		connection = refreshed.connection
	}
	const url = resolveSameOriginUrl(connection.server, path)
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
		headers: injectAccessToken(requestHeadersWithDefaults, connection.access_token),
		...(body === undefined ? {} : { body: JSON.stringify(body) })
	}
	let response = await fetch(url, init)
	if (response.status === 401) {
		const refreshed = await refreshConnection(name, store, connection)
		connection = refreshed.connection
		init.headers = injectAccessToken(requestHeadersWithDefaults, connection.access_token)
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
	if (group === 'auth' && action === 'connect') {
		const nameIndex = args.indexOf('--name')
		const name = nameIndex >= 0 ? args[nameIndex + 1] : undefined
		const serverIndex = args.indexOf('--server')
		const server = serverIndex >= 0 ? args[serverIndex + 1] : undefined
		const scopeIndex = args.indexOf('--scopes')
		const scopes = parseScopes(scopeIndex >= 0 ? args[scopeIndex + 1] : '')
		if (!name || !server || scopes.length === 0) {
			throw new Error('Usage: opc auth connect --name NAME --server URL --scopes a,b')
		}
		await connect(name, server, scopes)
		return
	}
	if (group === 'auth' && action === 'disconnect') {
		const nameIndex = args.indexOf('--name')
		const name = nameIndex >= 0 ? args[nameIndex + 1] : undefined
		if (!name) throw new Error('Usage: opc auth disconnect --name NAME')
		const store = await readCredentialStore()
		getConnection(store, name)
		await writeCredentialStore(removeConnection(store, name))
		console.log(`Disconnected ${name}`)
		return
	}
	if (group === 'auth' && action === 'status') {
		const nameIndex = args.indexOf('--name')
		const name = nameIndex >= 0 ? args[nameIndex + 1] : undefined
		if (!name) throw new Error('Usage: opc auth status --name NAME')
		const connection = getConnection(await readCredentialStore(), name)
		console.log(JSON.stringify({
			name,
			server: connection.server,
			expires_at: connection.expires_at,
			scopes: connection.scopes
		}))
		return
	}
	if (group === 'api' && action === 'request') {
		const nameIndex = args.indexOf('--name')
		const name = nameIndex >= 0 ? args[nameIndex + 1] : undefined
		const methodIndex = args.indexOf('--method')
		const urlIndex = args.indexOf('--url')
		const method = methodIndex >= 0 ? args[methodIndex + 1] : undefined
		const path = urlIndex >= 0 ? args[urlIndex + 1] : undefined
		if (!name || !method || !path) {
			throw new Error('Usage: opc api request --name NAME --method METHOD --url /path')
		}
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
		await apiRequest(name, method, path, body, query, headers)
		return
	}
	throw new Error('Usage: opc auth connect|status|disconnect or opc api request')
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main(process.argv.slice(2)).catch((error) => {
		console.error(error instanceof Error ? error.message : String(error))
		process.exitCode = 1
	})
}
