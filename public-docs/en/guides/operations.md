---
title: Operations
description: User feedback and system notifications
group: Guides
group_order: 1
order: 11
---

# Operations

Two lightweight operational features share this page: user feedback and system notifications. Both are simple admin-driven CRUD with no complex business logic, so they do not warrant separate files.

## Data Ownership

| Table | Database | Scoping |
| --- | --- | --- |
| `feedbacks` | Tenant Shard DB | One row per user, in the user's own shard |
| `notifications` | Meta DB | Global, admin-published, visible by all or targeted user |
| `notification_reads` | Tenant Shard DB | Per-user read state, in the user's own shard |

Feedback is user-scoped data that grows with the user base, so it lives in the shard. Notifications are global state that the admin writes and all users read, so they live in Meta. The read state is per-user, so it lives in the shard.

The `notifications` table has a `target_user_id` column with a foreign key to `user.id` and `onDelete: cascade`. If an admin deletes a user, targeted notifications for that user are removed. Global notifications (`target_user_id IS NULL`) are unaffected.

## Feedback

### Submit Feedback

```http
POST /api/submit_feedback
```

Authenticated. Writes directly to the current user's tenant shard DB via `ctx.get('tenantDb')`:

```json
{
  "type": "bug",
  "content": "The upload button does not respond"
}
```

`type` is a free-form string from the client. The backend does not validate it against an enum. `content` must be non-empty. Returns `{ "id": "feedback_id" }`.

### Admin List Feedbacks

```http
POST /api/admin/list_feedbacks
```

Admin only. This endpoint fans out across all tenant shards:

```
createTenantShardAccess(metaDb, env).listShardDbs()
  -> queries all active and draining shards from d1_shards
  -> opens each shard DB binding
  |
  v
for each shard:
  feedback.findMany({ where, orderBy: createdAt desc })
  |
  v
collect all rows, sort by createdAt desc globally
  |
  v
in-memory slice for pagination
```

The handler queries every shard, collects matching rows, sorts the combined result, and slices in memory for `page` and `page_size`. `total` is `rows.length` after filtering, not a SQL count.

This approach works for a small number of shards and reasonable feedback volume. It is not suitable for high-throughput listing. If the shard count grows into the hundreds, a global aggregation table in Meta DB would be needed.

Filters: `user_id`, `type`, `created_at_start`, `created_at_end`.

## Notifications

### Admin Create Notification

```http
POST /api/admin/create_notification
```

Admin only. Writes to Meta DB:

```json
{
  "type": "system",
  "title": "Maintenance",
  "content": "The service will be upgraded tonight",
  "target_user_id": null
}
```

`type` defaults to `system` when omitted. `target_user_id` controls visibility:

- `null` or omitted: global announcement, visible to all users
- set to a user ID: targeted notification, visible only to that user

Returns `{ "id": "notification_id" }`.

### User List Notifications

```http
POST /api/list_notifications
```

Authenticated. This is a cross-database read. The handler first queries Meta DB for visible notifications, then queries the user's tenant shard for read states, and joins them in memory:

```
Step 1: Meta DB
  SELECT * FROM notifications
  WHERE (target_user_id IS NULL OR target_user_id = current_user)
    AND [optional type, created_at filters]
  ORDER BY created_at DESC

Step 2: Tenant Shard DB
  SELECT notification_id FROM notification_reads
  WHERE user_id = current_user AND notification_id IN (step 1 ids)

Step 3: Build response items with read = (id in readIds)
```

The `read` filter requires special handling. Since `read` is not a column in `notifications` (it lives in the shard DB), it cannot be part of the SQL `WHERE`. The handler fetches all visible rows first, computes `read` from the shard lookup, then filters in memory:

```
if read filter is set:
  fetch all visible rows (no limit)
  compute read for each
  filter by read === req.read
  in-memory slice for pagination
  total = filtered length

if read filter is not set:
  fetch with SQL limit + offset
  compute read for each (for display)
  total = SQL count
```

This means `read=true` or `read=false` queries are less efficient than unfiltered queries because they load all visible rows. This is acceptable for notification volume.

### Mark as Read

```http
POST /api/read_notification
```

Authenticated. Writes to the current user's tenant shard DB:

```json
{
  "id": "notification_id"
}
```

The insert uses `onConflictDoNothing` on the primary key `(notification_id, user_id)`. Repeated calls do not create duplicate rows and do not error. Returns `{}`.

The handler does not verify that the notification id exists. It inserts the read state regardless. This is intentional: the read state is purely a client-side concern and there is no business value in validating the notification id on mark-as-read.

## API Summary

| Endpoint | Auth | Database |
| --- | --- | --- |
| `POST /api/submit_feedback` | User | Tenant Shard |
| `POST /api/admin/list_feedbacks` | Admin | All Shards (fan-out) |
| `POST /api/admin/create_notification` | Admin | Meta |
| `POST /api/list_notifications` | User | Meta + Tenant Shard |
| `POST /api/read_notification` | User | Tenant Shard |

## Common Mistakes

**Admin feedback listing fans out across all shards.** The handler loops every active shard, queries in parallel, collects, sorts, and paginates in memory. Total is `rows.length`, not a SQL count. This does not scale to hundreds of shards without a global index.

**`read` filter cannot be pushed to SQL.** The `read` boolean is computed from the shard DB, not stored in Meta. When `read` is set in the request, the handler fetches all visible rows first, then filters in memory. Do not assume the SQL `LIMIT` applies before the `read` filter.

**Repeated mark-as-read does not error.** `onConflictDoNothing` on `(notification_id, user_id)` means duplicate calls are silently ignored. This is by design.

**`target_user_id` shares a foreign key with `user.id`.** Deleting a user cascades to remove their targeted notifications. Global notifications are not affected.

**Feedback `type` is free-form.** The backend does not validate it against a fixed enum. If you need consistent types, validate on the frontend or add a schema constraint.
