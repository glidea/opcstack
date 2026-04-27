import { defineConfig } from 'drizzle-kit'

export default defineConfig({
	schema: ['./src/db/schema.ts', './src/db/schema.auth.ts'],
	out: './src/db/migrations',
	dialect: 'sqlite'
})
