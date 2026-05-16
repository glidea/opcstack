import wranglerConfigText from '../../../../wrangler.jsonc?raw'

type StringConfigKeys = {
	[K in keyof Env]: Env[K] extends string ? K : never
}[keyof Env]

type AppConfigType = {
	readonly [K in StringConfigKeys]: Env[K]
}

type WranglerConfig = {
	vars: AppConfigType
}

const wranglerConfig = JSON.parse(wranglerConfigText) as WranglerConfig

export const AppConfig: AppConfigType = wranglerConfig.vars
