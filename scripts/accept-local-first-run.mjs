#!/usr/bin/env node
import { cp, mkdtemp, open, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, relative, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'

const SOURCE_ROOT = resolve(import.meta.dirname, '..')
const EXCLUDED_NAMES = new Set([
	'.git',
	'.wrangler',
	'.svelte-kit',
	'node_modules',
	'dist',
	'.env.secret.dev'
])

async function main() {
	const temporaryRoot = await mkdtemp(join(tmpdir(), 'opcstack-first-run-'))
	const workspace = join(temporaryRoot, 'workspace')
	const secondWorkspace = join(temporaryRoot, 'second-workspace')
	let worker
	let vite
	let secondWorker
	let secondVite
	let workerLogPath
	let viteLogPath
	let secondWorkerLogPath
	let secondViteLogPath
	try {
		await cp(SOURCE_ROOT, workspace, {
			recursive: true,
			filter: (source) => !EXCLUDED_NAMES.has(basename(source))
		})
		await symlink(join(SOURCE_ROOT, 'node_modules'), join(workspace, 'node_modules'), 'dir')
		await cp(SOURCE_ROOT, secondWorkspace, {
			recursive: true,
			filter: (source) => !EXCLUDED_NAMES.has(basename(source))
		})
		await symlink(join(SOURCE_ROOT, 'node_modules'), join(secondWorkspace, 'node_modules'), 'dir')
		await writeSecondProjectPorts(secondWorkspace)

		const firstPrepare = await runCaptured('pnpm', ['prepare:cloudflare:dev'], workspace)
		const credentials = readInitialCredentials(firstPrepare)
		const secondPrepare = await runCaptured('pnpm', ['prepare:cloudflare:dev'], workspace)
		if (countInitialCredentialBanners(secondPrepare) !== 0) {
			throw new Error('Initial administrator credentials were printed more than once')
		}
		const secondProjectPrepare = await runCaptured(
			'pnpm',
			['prepare:cloudflare:dev'],
			secondWorkspace
		)
		const secondProjectCredentials = readInitialCredentials(secondProjectPrepare)

		await runCaptured('pnpm', ['exec', 'svelte-kit', 'sync'], workspace)
		await runCaptured(
			'pnpm',
			[
				'exec',
				'wrangler',
				'types',
				'--config',
				'.wrangler/wrangler.types.jsonc',
				'--env-file',
				'.wrangler/runtime-secrets.env',
				'--strict-vars',
				'false'
			],
			workspace
		)
		await runCaptured('pnpm', ['exec', 'svelte-kit', 'sync'], secondWorkspace)
		await runCaptured(
			'pnpm',
			[
				'exec',
				'wrangler',
				'types',
				'--config',
				'.wrangler/wrangler.types.jsonc',
				'--env-file',
				'.wrangler/runtime-secrets.env',
				'--strict-vars',
				'false'
			],
			secondWorkspace
		)

		workerLogPath = join(temporaryRoot, 'worker.log')
		worker = await startServer(
			'pnpm',
			[
				'exec',
				'wrangler',
				'dev',
				'--env-file',
				'.wrangler/runtime-secrets.env',
				'--port',
				'8787',
				'--inspector-port',
				'9230'
			],
			workspace,
			workerLogPath
		)
		viteLogPath = join(temporaryRoot, 'vite.log')
		vite = await startServer(
			'pnpm',
			['exec', 'vite', 'dev', '--mode', 'dev', '--port', '5173', '--strictPort'],
			workspace,
			viteLogPath
		)
		secondWorkerLogPath = join(temporaryRoot, 'second-worker.log')
		secondWorker = await startServer(
			'pnpm',
			[
				'exec',
				'wrangler',
				'dev',
				'--env-file',
				'.wrangler/runtime-secrets.env',
				'--port',
				'8788',
				'--inspector-port',
				'9231'
			],
			secondWorkspace,
			secondWorkerLogPath
		)
		secondViteLogPath = join(temporaryRoot, 'second-vite.log')
		secondVite = await startServer(
			'pnpm',
			['exec', 'vite', 'dev', '--mode', 'dev', '--port', '5174', '--strictPort'],
			secondWorkspace,
			secondViteLogPath
		)
		await waitForHealth('http://localhost:5173/api/health')
		await waitForHealth('http://localhost:5174/api/health')

		const nextEmail = `administrator-${randomBytes(6).toString('hex')}@example.com`
		const nextPassword = randomBytes(24).toString('base64url')
		const initialEnvironment = {
			...process.env,
			E2E_FIRST_RUN: '1',
			E2E_ADMIN_EMAIL: credentials.email,
			E2E_ADMIN_PASSWORD: credentials.password,
			E2E_NEW_ADMIN_EMAIL: nextEmail,
			E2E_NEW_ADMIN_PASSWORD: nextPassword
		}
		await runVisible(
			'pnpm',
			['exec', 'playwright', 'test', 'e2e-browser/first-run.spec.ts'],
			workspace,
			initialEnvironment
		)
		await runVisible(
			'pnpm',
			['exec', 'vitest', '--config', 'vitest.e2e.config.ts', 'e2e/first-run.test.ts'],
			workspace,
			{
				...initialEnvironment,
				E2E_ADMIN_EMAIL: nextEmail,
				E2E_ADMIN_PASSWORD: nextPassword
			}
		)
		await runVisible('pnpm', ['test:e2e'], workspace, {
			...process.env,
			E2E_FIRST_RUN: '0',
			E2E_ADMIN_EMAIL: nextEmail,
			E2E_ADMIN_PASSWORD: nextPassword
		})
		await runVisible(
			'pnpm',
			['exec', 'vitest', '--config', 'vitest.e2e.config.ts', 'e2e/opc-cli.test.ts'],
			workspace,
			{
				...process.env,
				E2E_FIRST_RUN: '1',
				E2E_ADMIN_EMAIL: nextEmail,
				E2E_ADMIN_PASSWORD: nextPassword,
				E2E_SECOND_APP_BASE_URL: 'http://localhost:5174',
				E2E_SECOND_ADMIN_EMAIL: secondProjectCredentials.email,
				E2E_SECOND_ADMIN_PASSWORD: secondProjectCredentials.password
			}
		)
		console.log('Local first-run acceptance passed')
	} catch (error) {
		if (workerLogPath) {
			const workerLog = await readFile(workerLogPath, 'utf8').catch(() => '')
			if (workerLog !== '') {
				console.error(sanitize(workerLog))
			}
		}
		if (viteLogPath) {
			const viteLog = await readFile(viteLogPath, 'utf8').catch(() => '')
			if (viteLog !== '') {
				console.error(sanitize(viteLog))
			}
		}
		if (secondWorkerLogPath) {
			const workerLog = await readFile(secondWorkerLogPath, 'utf8').catch(() => '')
			if (workerLog !== '') {
				console.error(sanitize(workerLog))
			}
		}
		if (secondViteLogPath) {
			const viteLog = await readFile(secondViteLogPath, 'utf8').catch(() => '')
			if (viteLog !== '') {
				console.error(sanitize(viteLog))
			}
		}
		throw error
	} finally {
		stopServer(secondVite)
		stopServer(secondWorker)
		stopServer(vite)
		stopServer(worker)
		await rm(temporaryRoot, { recursive: true, force: true })
	}
}

async function writeSecondProjectPorts(workspace) {
	const packagePath = join(workspace, 'package.json')
	const packageJson = JSON.parse(await readFile(packagePath, 'utf8'))
	packageJson.scripts.dev = packageJson.scripts.dev
		.replace('--port 8787', '--port 8788')
		.replace('--port 5173', '--port 5174')
	await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`)

	const vitePath = join(workspace, 'vite.config.ts')
	const viteConfig = await readFile(vitePath, 'utf8')
	await writeFile(vitePath, viteConfig.replace('http://127.0.0.1:8787', 'http://127.0.0.1:8788'))
}

function readInitialCredentials(output) {
	if (countInitialCredentialBanners(output) !== 1) {
		throw new Error('Initial administrator credentials were not printed exactly once')
	}
	const match = output.match(/Initial administrator credentials[\s\S]*?Email: ([^\n]+)[\s\S]*?Password: ([^\n]+)/)
	if (!match) {
		throw new Error('Initial administrator credentials could not be parsed')
	}
	return { email: match[1].trim(), password: match[2].trim() }
}

function countInitialCredentialBanners(output) {
	return output.match(/Initial administrator credentials/g)?.length ?? 0
}

async function runCaptured(command, args, cwd) {
	return new Promise((resolvePromise, rejectPromise) => {
		const child = spawn(command, args, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] })
		let output = ''
		child.stdout.on('data', (chunk) => {
			output += String(chunk)
		})
		child.stderr.on('data', (chunk) => {
			output += String(chunk)
		})
		child.on('error', rejectPromise)
		child.on('exit', (code) => {
			if (code === 0) {
				resolvePromise(output)
				return
			}
			rejectPromise(new Error(`${command} ${args.join(' ')} failed\n${sanitize(output)}`))
		})
	})
}

async function runVisible(command, args, cwd, env) {
	await new Promise((resolvePromise, rejectPromise) => {
		const child = spawn(command, args, { cwd, env, stdio: 'inherit' })
		child.on('error', rejectPromise)
		child.on('exit', (code) => {
			if (code === 0) {
				resolvePromise()
				return
			}
			rejectPromise(new Error(`${command} ${args.join(' ')} failed`))
		})
	})
}

async function startServer(command, args, cwd, logPath) {
	const log = await open(logPath, 'w')
	const child = spawn(command, args, {
		cwd,
		env: process.env,
		detached: true,
		stdio: ['ignore', log.fd, log.fd]
	})
	await log.close()
	return child
}

function stopServer(child) {
	if (!child?.pid) {
		return
	}
	try {
		process.kill(-child.pid, 'SIGTERM')
	} catch {}
}

async function waitForHealth(url) {
	for (let attempt = 0; attempt < 60; attempt += 1) {
		try {
			const response = await fetch(url)
			if (response.status === 200) {
				return
			}
		} catch {}
		await new Promise((resolvePromise) => setTimeout(resolvePromise, 500))
	}
	throw new Error(`Server did not become healthy at ${url}`)
}

function sanitize(output) {
	return output.replace(/(Password: )[^\n]+/g, '$1[redacted]')
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error))
	process.exitCode = 1
})
