import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { approveApiAccess } from './support/oauth'
import { browserHeaders, readJson, signInWithPassword, type CookieJar } from './support/http'

type CliResult = {
	exitCode: number
	stdout: string
	stderr: string
}

type OAuthGrant = {
	id: string
	scopes: string[]
	status: 'pending' | 'active' | 'revoked'
	created_at: number
}

const enabled: boolean = process.env['E2E_FIRST_RUN'] === '1'
const primaryBaseUrl: string = process.env['APP_BASE_URL'] ?? ''
const primaryEmail: string = process.env['E2E_ADMIN_EMAIL'] ?? ''
const primaryPassword: string = process.env['E2E_ADMIN_PASSWORD'] ?? ''
const secondaryBaseUrl: string = process.env['E2E_SECOND_APP_BASE_URL'] ?? ''
const secondaryEmail: string = process.env['E2E_SECOND_ADMIN_EMAIL'] ?? ''
const secondaryPassword: string = process.env['E2E_SECOND_ADMIN_PASSWORD'] ?? ''

describe.skipIf(!enabled)('opc CLI OAuth journey', (): void => {
	test('connects two local projects and enforces granted scopes and revocation', async (): Promise<void> => {
		if (
			primaryBaseUrl === '' ||
			primaryEmail === '' ||
			primaryPassword === '' ||
			secondaryBaseUrl === '' ||
			secondaryEmail === '' ||
			secondaryPassword === ''
		) {
			throw new Error('E2E_SECOND_LOCAL_PROJECT_REQUIRED')
		}

		const primarySignIn = await signInWithPassword({
			appBaseUrl: primaryBaseUrl,
			email: primaryEmail,
			password: primaryPassword
		})
		expect(primarySignIn.response.status).toBe(200)
		const secondarySignIn = await signInWithPassword({
			appBaseUrl: secondaryBaseUrl,
			email: secondaryEmail,
			password: secondaryPassword
		})
		expect(secondarySignIn.response.status).toBe(200)

		const temporaryRoot: string = await mkdtemp(join(tmpdir(), 'opc-cli-e2e-'))
		const configRoot: string = join(temporaryRoot, 'config')
		const binRoot: string = join(temporaryRoot, 'bin')
		await createBrowserOpeners(binRoot)
		const cliEnvironment: NodeJS.ProcessEnv = {
			...process.env,
			XDG_CONFIG_HOME: configRoot,
			PATH: `${binRoot}${delimiter}${process.env['PATH'] ?? ''}`
		}
		const scopes: string[] = ['config:credits:read']

		try {
			await connectCli(
				'shop-local',
				primaryBaseUrl,
				scopes,
				primarySignIn.cookies,
				cliEnvironment
			)
			await connectCli(
				'shop-preview',
				secondaryBaseUrl,
				scopes,
				secondarySignIn.cookies,
				cliEnvironment
			)

			const primaryStatus: CliResult = await runCli(
				['auth', 'status', '--name', 'shop-local'],
				cliEnvironment
			)
			const secondaryStatus: CliResult = await runCli(
				['auth', 'status', '--name', 'shop-preview'],
				cliEnvironment
			)
			expect(primaryStatus.exitCode).toBe(0)
			expect(secondaryStatus.exitCode).toBe(0)
			expect(JSON.parse(primaryStatus.stdout)).toEqual(
				expect.objectContaining({ name: 'shop-local', server: primaryBaseUrl, scopes })
			)
			expect(JSON.parse(secondaryStatus.stdout)).toEqual(
				expect.objectContaining({ name: 'shop-preview', server: secondaryBaseUrl, scopes })
			)

			const allowed: CliResult = await runCli(
				[
					'api',
					'request',
					'--name',
					'shop-local',
					'--method',
					'POST',
					'--url',
					'/api/admin/get_credits_config',
					'--body',
					'{}'
				],
				cliEnvironment
			)
			expect(allowed.exitCode).toBe(0)
			expect(JSON.parse(allowed.stdout)).toEqual(
				expect.objectContaining({ history_retention_days: expect.any(Number) })
			)

			const forbidden: CliResult = await runCli(
				[
					'api',
					'request',
					'--name',
					'shop-local',
					'--method',
					'POST',
					'--url',
					'/api/admin/get_ai_config',
					'--body',
					'{}'
				],
				cliEnvironment
			)
			expect(forbidden.exitCode).toBe(1)
			expect(forbidden.stderr).toContain('Required API scope is missing')

			await revokeNewestGrant(primaryBaseUrl, primarySignIn.cookies, scopes)
			const revoked: CliResult = await runCli(
				[
					'api',
					'request',
					'--name',
					'shop-local',
					'--method',
					'POST',
					'--url',
					'/api/admin/get_credits_config',
					'--body',
					'{}'
				],
				cliEnvironment
			)
			expect(revoked.exitCode).toBe(1)
			expect(revoked.stderr).toContain('AUTHORIZATION_REQUIRED')

			const removedStatus: CliResult = await runCli(
				['auth', 'status', '--name', 'shop-local'],
				cliEnvironment
			)
			const retainedStatus: CliResult = await runCli(
				['auth', 'status', '--name', 'shop-preview'],
				cliEnvironment
			)
			expect(removedStatus.stderr).toContain('Connection not found: shop-local')
			expect(retainedStatus.exitCode).toBe(0)

			const retainedRequest: CliResult = await runCli(
				[
					'api',
					'request',
					'--name',
					'shop-preview',
					'--method',
					'POST',
					'--url',
					'/api/admin/get_credits_config',
					'--body',
					'{}'
				],
				cliEnvironment
			)
			expect(retainedRequest.exitCode).toBe(0)
			expect(JSON.parse(retainedRequest.stdout)).toEqual(
				expect.objectContaining({ history_retention_days: expect.any(Number) })
			)
		} finally {
			await rm(temporaryRoot, { recursive: true, force: true })
		}
	})
})

async function connectCli(
	name: string,
	server: string,
	scopes: string[],
	cookies: CookieJar,
	environment: NodeJS.ProcessEnv
): Promise<void> {
	const child: ChildProcessWithoutNullStreams = spawn(
		process.execPath,
		[
			'scripts/opc.mjs',
			'auth',
			'connect',
			'--name',
			name,
			'--server',
			server,
			'--scopes',
			scopes.join(',')
		],
		{ cwd: process.cwd(), env: environment }
	)
	let stdout: string = ''
	let stderr: string = ''
	child.stdout.on('data', (chunk: Buffer): void => {
		stdout += chunk.toString()
	})
	child.stderr.on('data', (chunk: Buffer): void => {
		stderr += chunk.toString()
	})
	const verificationUrl: URL = await waitForVerificationUrl(child, (): string => stdout)
	const userCode: string | null = verificationUrl.searchParams.get('user_code')
	if (!userCode) {
		child.kill()
		throw new Error('CLI_OAUTH_USER_CODE_MISSING')
	}
	await approveApiAccess({ appBaseUrl: server, cookies, userCode })
	const exitCode: number = await waitForExit(child)
	expect({ exitCode, stdout, stderr }).toEqual(
		expect.objectContaining({ exitCode: 0, stdout: expect.stringContaining(`Connected ${name}`) })
	)
}

async function waitForVerificationUrl(
	child: ChildProcessWithoutNullStreams,
	readStdout: () => string
): Promise<URL> {
	for (let attempt: number = 0; attempt < 100; attempt += 1) {
		const match: RegExpMatchArray | null = readStdout().match(/Open (https?:\/\/\S+)/)
		if (match?.[1]) {
			return new URL(match[1])
		}
		if (child.exitCode !== null) {
			throw new Error('CLI_AUTH_CONNECT_EXITED_BEFORE_AUTHORIZATION')
		}
		await new Promise<void>((resolve: () => void): NodeJS.Timeout => setTimeout(resolve, 50))
	}
	child.kill()
	throw new Error('CLI_AUTHORIZATION_URL_TIMEOUT')
}

async function runCli(args: string[], environment: NodeJS.ProcessEnv): Promise<CliResult> {
	const child: ChildProcessWithoutNullStreams = spawn(
		process.execPath,
		['scripts/opc.mjs', ...args],
		{ cwd: process.cwd(), env: environment }
	)
	let stdout: string = ''
	let stderr: string = ''
	child.stdout.on('data', (chunk: Buffer): void => {
		stdout += chunk.toString()
	})
	child.stderr.on('data', (chunk: Buffer): void => {
		stderr += chunk.toString()
	})
	return { exitCode: await waitForExit(child), stdout: stdout.trim(), stderr: stderr.trim() }
}

function waitForExit(child: ChildProcessWithoutNullStreams): Promise<number> {
	return new Promise<number>((resolve: (code: number) => void, reject: (error: Error) => void): void => {
		child.once('error', reject)
		child.once('exit', (code: number | null): void => resolve(code ?? 1))
	})
}

async function createBrowserOpeners(binRoot: string): Promise<void> {
	await mkdir(binRoot, { recursive: true })
	for (const command of ['open', 'xdg-open', 'start']) {
		const path: string = join(binRoot, command)
		await writeFile(path, '#!/bin/sh\nexit 0\n')
		await chmod(path, 0o700)
	}
}

async function revokeNewestGrant(
	appBaseUrl: string,
	cookies: CookieJar,
	scopes: string[]
): Promise<void> {
	const listResponse: Response = await fetch(`${appBaseUrl}/api/oauth/list_grants`, {
		method: 'POST',
		headers: browserHeaders(appBaseUrl, cookies),
		body: JSON.stringify({})
	})
	expect(listResponse.status).toBe(200)
	const grants: { items: OAuthGrant[] } = await readJson<{ items: OAuthGrant[] }>(listResponse)
	const grant: OAuthGrant | undefined = grants.items
		.filter((item: OAuthGrant): boolean => item.status === 'active')
		.filter((item: OAuthGrant): boolean => item.scopes.join(' ') === scopes.join(' '))
		.sort((left: OAuthGrant, right: OAuthGrant): number => right.created_at - left.created_at)[0]
	expect(grant).toBeDefined()
	const revokeResponse: Response = await fetch(`${appBaseUrl}/api/oauth/revoke_grant`, {
		method: 'POST',
		headers: browserHeaders(appBaseUrl, cookies),
		body: JSON.stringify({ grant_id: grant?.id })
	})
	expect(revokeResponse.status).toBe(200)
}
