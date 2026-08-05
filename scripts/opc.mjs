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
	const token = await requestJson(buildApiUrl(credentials.server, '/api/auth/oauth2/token'), {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			client_id: CLIENT_ID,
			refresh_token: credentials.refresh_token
		}).toString()
	})
	const refreshed = {
		...credentials,
		access_token: token.access_token,
		refresh_token: token.refresh_token || credentials.refresh_token,
		expires_at: Date.now() + Number(token.expires_in || 900) * 1000
	}
	await writeCredentials(refreshed)
	return refreshed
}

async function apiRequest(method, path, body) {
	let credentials = await readCredentials()
	if (Number(credentials.expires_at) <= Date.now() + 10_000) {
		credentials = await refreshCredentials(credentials)
	}
	const init = {
		method,
		headers: {
			Authorization: `Bearer ${credentials.access_token}`,
			...(body === undefined ? {} : { 'content-type': 'application/json' })
		},
		...(body === undefined ? {} : { body: JSON.stringify(body) })
	}
	let response = await fetch(buildApiUrl(credentials.server, path), init)
	if (response.status === 401) {
		credentials = await refreshCredentials(credentials)
		init.headers.Authorization = `Bearer ${credentials.access_token}`
		response = await fetch(buildApiUrl(credentials.server, path), init)
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
		const method = args[0]
		const path = args[1]
		if (!method || !path) throw new Error('Usage: opc api request METHOD /path [--body JSON]')
		const bodyIndex = args.indexOf('--body')
		const body = bodyIndex >= 0 ? JSON.parse(args[bodyIndex + 1]) : undefined
		await apiRequest(method, path, body)
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
