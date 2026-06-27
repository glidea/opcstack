import { defineConfig } from 'drizzle-kit'

export default defineConfig({
	schema: ['./src/backend/db/schema.meta.ts', './src/backend/db/schema.auth.ts'],
	out: './src/backend/db/meta-migrations',
	dialect: 'sqlite'
})
