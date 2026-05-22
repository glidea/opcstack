---
title: Database
description: D1 database usage with Drizzle ORM
group: Guides
order: 2
---

# Database

OPC Stack uses Cloudflare D1 with Drizzle ORM.

The database is split into two groups:

```text
Meta DB
  global identity
  global config
  payment orders
  redemption codes
  shard registry

Tenant Shard DB
  user credit ledger
  user feedback
  notification read state
```

## Bindings

`META_DB` is the global metadata database.

`TENANT_DB_0000..N` are tenant shard databases.

Shard count is controlled by:

```env
D1_SHARD_COUNT=1
```

## Schema

Meta schema:

```text
src/db/schema.meta.ts
src/db/meta-migrations/
```

Tenant Shard schema:

```text
src/db/schema.shard.ts
src/db/shard-migrations/
```

`src/db/schema.ts` is only the combined export. Do not add new tables there directly.

## Migration

`pre-build.mjs` generates and applies both migration sets automatically.

```text
Meta migration  -> META_DB
Shard migration -> every TENANT_DB_xxxx
```

For local development:

```bash
pnpm dev
```

For deployment:

```bash
pnpm deploycf
```

## Request Scoped DB

API handlers read databases from the request context.

```typescript
const metaDb = ctx.get('metaDb')
const tenantDb = ctx.get('tenantDb')
```

Use `metaDb` for global data.

Use `tenantDb` for user-owned high-write data.

Do not add a unified `db` wrapper that hides table ownership.

## Table Ownership

Use Meta DB for:

```text
data required before login
global unique constraints
cross-user relationships
payment orders and webhook state
redemption code state
```

Use Tenant Shard DB for:

```text
single-user data
high-write user data
data routable by user_id
```

## Cross-DB Writes

D1 does not support cross-database transactions.

Cross-DB flows must be modeled as eventual consistency.

Redemption code flow:

```text
Meta DB: unused -> claimed
Tenant DB: grant credits with source_type + source_id
Meta DB: claimed -> granted
```

If tenant credit grant fails, the API returns `202 CREDIT_GRANT_PENDING`. A background job retries with the same `source_type + source_id`.

## FAQ

**Q: Does scaling out migrate existing users**

No. Scaling out only adds shards. Existing users keep their current shard in `user_shards`.

**Q: Is scaling in supported**

No by default. The template only provides scale-out.
