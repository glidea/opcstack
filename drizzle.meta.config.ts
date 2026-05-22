import { defineConfig } from 'drizzle-kit'

export default defineConfig({
	schema: ['./src/db/schema.meta.ts', './src/db/schema.auth.ts'],
	out: './src/db/meta-migrations',
	dialect: 'sqlite'
})
