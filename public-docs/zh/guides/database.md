---
title: 数据库
description: D1 数据库使用和 Drizzle ORM
group: 指南
order: 2
---

# 数据库

OPC Stack 使用 Cloudflare D1 作为数据库，通过 Drizzle ORM 操作。

## Schema 定义

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

### 生成 Migration

```bash
pnpm drizzle-kit generate
```

会在 `src/db/migrations/` 生成 SQL 文件。

### 应用 Migration

`pre-build.mjs` 会自动执行 migration：

```bash
# 本地
wrangler d1 migrations apply DB --local

# 远程
wrangler d1 migrations apply DB --remote
```

## 查询数据

```typescript
import { db } from './db'
import { users, posts } from './db/schema'
import { eq, and, desc } from 'drizzle-orm'

// 查询单条
const user = await db.query.users.findFirst({
  where: eq(users.id, userId)
})

// 查询多条
const userPosts = await db.query.posts.findMany({
  where: eq(posts.userId, userId),
  orderBy: [desc(posts.createdAt)]
})

// 关联查询
const postsWithUser = await db.query.posts.findMany({
  with: {
    user: true
  }
})
```

## 插入数据

```typescript
// 插入单条
await db.insert(users).values({
  id: nanoid(),
  email: 'user@example.com',
  name: 'User',
  createdAt: new Date()
})

// 插入多条
await db.insert(posts).values([
  { id: nanoid(), userId, title: 'Post 1', createdAt: new Date() },
  { id: nanoid(), userId, title: 'Post 2', createdAt: new Date() }
])
```

## 更新数据

```typescript
// 更新
await db.update(users)
  .set({ name: 'New Name' })
  .where(eq(users.id, userId))

// 更新多个字段
await db.update(users)
  .set({
    name: 'New Name',
    avatar: 'https://example.com/avatar.jpg'
  })
  .where(eq(users.id, userId))
```

## 删除数据

```typescript
// 删除
await db.delete(posts)
  .where(eq(posts.id, postId))

// 删除多条
await db.delete(posts)
  .where(eq(posts.userId, userId))
```

## 批量操作

D1 不支持事务，但可以使用批量操作提高性能：

```typescript
// 批量插入
await db.insert(posts).values([
  { id: nanoid(), userId, title: 'Post 1', createdAt: new Date() },
  { id: nanoid(), userId, title: 'Post 2', createdAt: new Date() }
])
```

## 原始 SQL

```typescript
// 查询
const result = await db.run(sql`
  SELECT * FROM users WHERE email = ${email}
`)

// 执行
await db.run(sql`
  UPDATE users SET name = ${name} WHERE id = ${userId}
`)
```

## 本地开发

本地开发使用 SQLite 文件：

```bash
# 查看本地数据库
sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/xxx.sqlite

# 执行 SQL
sqlite> SELECT * FROM users;
```

## 常见问题

**Q: Migration 失败怎么办？**

检查 SQL 语法是否正确，查看 `wrangler d1 migrations list DB` 确认已应用的 migration。

**Q: 如何回滚 Migration？**

D1 不支持自动回滚，需要手动编写回滚 SQL 并执行。

**Q: 本地和远程数据不一致？**

本地和远程是独立的数据库，需要分别执行 migration。
