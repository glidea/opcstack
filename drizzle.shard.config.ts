import { defineConfig } from 'drizzle-kit'

export default defineConfig({
	schema: './src/backend/db/schema.shard.ts',
	out: './src/backend/db/shard-migrations',
	dialect: 'sqlite'
})
