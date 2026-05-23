import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const CLOUDFLARE_TOKEN_CACHE_PATH = '.wrangler/cloudflare-api-token'

function run(command, args) {
	console.log(`> ${[command, ...args].join(' ')}`)
	execFileSync(command, args, { stdio: 'inherit', env: process.env })
}

run('node', ['pre-build.mjs', '--remote'])

if (!process.env.CLOUDFLARE_API_TOKEN && existsSync(CLOUDFLARE_TOKEN_CACHE_PATH)) {
	process.env.CLOUDFLARE_API_TOKEN = readFileSync(CLOUDFLARE_TOKEN_CACHE_PATH, 'utf-8').trim()
}

run('wrangler', ['types'])
run('vite', ['build'])
run('wrangler', ['deploy'])
