import wranglerConfigText from '../../../../wrangler.jsonc?raw'

type StringConfigKeys = {
	[K in keyof Env]: Env[K] extends string ? K : never
}[keyof Env]

type ServerConfig = {
	readonly [K in StringConfigKeys]: Env[K]
}

type WranglerConfig = {
	vars: ServerConfig
}

const wranglerConfig = JSON.parse(wranglerConfigText) as WranglerConfig

export const serverConfig: ServerConfig = wranglerConfig.vars
