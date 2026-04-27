import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

// CLI-only config for schema generation.
// Runtime fields are intentionally omitted.
export const auth = betterAuth({
	database: drizzleAdapter({}, { provider: 'sqlite' }),
	emailAndPassword: {
		enabled: true
	}
})

export default auth
