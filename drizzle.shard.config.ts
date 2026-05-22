import { defineConfig } from 'drizzle-kit'

export default defineConfig({
	schema: './src/db/schema.shard.ts',
	out: './src/db/shard-migrations',
	dialect: 'sqlite'
})
