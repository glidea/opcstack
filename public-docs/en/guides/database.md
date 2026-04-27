---
title: Database
description: D1 database usage with Drizzle ORM
group: Guides
order: 2
---

# Database

OPC Stack uses Cloudflare D1 as database and uses Drizzle ORM for queries.

## Schema definition

```typescript
// src/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatar: text('avatar'),
  betaCode: text('beta_code'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
})

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  content: text('content'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
})
```

## Migration

### Generate migration

```bash
pnpm drizzle-kit generate
```

SQL files are generated in `src/db/migrations/`.

### Apply migration

`pre-build.mjs` applies migration automatically:

```bash
# local
wrangler d1 migrations apply DB --local

# remote
wrangler d1 migrations apply DB --remote
```

## Query data

```typescript
import { db } from './db'
import { users, posts } from './db/schema'
import { eq, and, desc } from 'drizzle-orm'

// Query single row
const user = await db.query.users.findFirst({
  where: eq(users.id, userId)
})

// Query multiple rows
const userPosts = await db.query.posts.findMany({
  where: eq(posts.userId, userId),
  orderBy: [desc(posts.createdAt)]
})

// Relation query
const postsWithUser = await db.query.posts.findMany({
  with: {
    user: true
  }
})
```

## Insert data

```typescript
// Insert one row
await db.insert(users).values({
  id: nanoid(),
  email: 'user@example.com',
  name: 'User',
  createdAt: new Date()
})

// Insert multiple rows
await db.insert(posts).values([
  { id: nanoid(), userId, title: 'Post 1', createdAt: new Date() },
  { id: nanoid(), userId, title: 'Post 2', createdAt: new Date() }
])
```

## Update data

```typescript
// Update
await db.update(users)
  .set({ name: 'New Name' })
  .where(eq(users.id, userId))

// Update multiple fields
await db.update(users)
  .set({
    name: 'New Name',
    avatar: 'https://example.com/avatar.jpg'
  })
  .where(eq(users.id, userId))
```

## Delete data

```typescript
// Delete one row
await db.delete(posts)
  .where(eq(posts.id, postId))

// Delete multiple rows
await db.delete(posts)
  .where(eq(posts.userId, userId))
```

## Batch operations

D1 does not support transactions but batch insert can still improve efficiency:

```typescript
// Batch insert
await db.insert(posts).values([
  { id: nanoid(), userId, title: 'Post 1', createdAt: new Date() },
  { id: nanoid(), userId, title: 'Post 2', createdAt: new Date() }
])
```

## Raw SQL

```typescript
// Query
const result = await db.run(sql`
  SELECT * FROM users WHERE email = ${email}
`)

// Execute
await db.run(sql`
  UPDATE users SET name = ${name} WHERE id = ${userId}
`)
```

## Local development

Local development uses SQLite file:

```bash
# View local database
sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/xxx.sqlite

# Run SQL
sqlite> SELECT * FROM users;
```

## FAQ

**Q: What should I do if migration fails**

Check SQL syntax and run `wrangler d1 migrations list DB` to verify applied migrations.

**Q: How to rollback migration**

D1 does not support automatic rollback. Write rollback SQL manually and execute it.

**Q: Local and remote data are inconsistent**

Local and remote are separate databases. You need to apply migrations in both environments.
