import type { PublicRuntimeConfig } from './backend/config'

declare global {
	namespace App {
		interface Locals {
			publicRuntimeConfig: PublicRuntimeConfig
		}

		interface Platform {
			env: Env
		}
	}
}

export {}
