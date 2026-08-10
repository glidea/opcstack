---
title: 运营
description: 用户反馈与系统通知
group: Guides
group_order: 1
order: 11
---

# 运营

本页面涵盖两个轻量级运营功能：用户反馈和系统通知。两者都是简单的管理员驱动 CRUD，没有复杂的业务逻辑，不需要单独的文件。

在浏览器中查看反馈和发布公告的操作流程参阅[管理控制台](admin-console.md)。

## 数据归属

| 表 | 数据库 | 作用域 |
| --- | --- | --- |
| `feedbacks` | Tenant Shard DB | 每个用户一行，存在用户自己的分片中 |
| `notifications` | Meta DB | 全局，管理员发布，对所有用户或指定用户可见 |
| `notification_reads` | Tenant Shard DB | 每用户已读状态，存在用户自己的分片中 |

反馈是随用户规模增长的用户级数据，因此放在分片中。通知是管理员写入、所有用户读取的全局状态，因此放在 Meta 中。已读状态是每用户级别的，因此放在分片中。

`notifications` 表有一个 `target_user_id` 列，关联 `user.id` 并设置了 `onDelete: cascade`。删除用户时，该用户的定向通知也会被级联删除。全局通知（`target_user_id IS NULL`）不受影响。

## 反馈

### 提交反馈

```http
POST /api/submit_feedback
```

需要登录。通过 `ctx.get('tenantDb')` 直接写入当前用户的 Tenant Shard DB：

```json
{
  "type": "bug",
  "content": "上传按钮没有响应"
}
```

`type` 是来自客户端的自由格式字符串。后端不会校验其是否在枚举范围内。`content` 不能为空。返回 `{ "id": "feedback_id" }`。

### 管理员列出反馈

```http
POST /api/admin/list_feedbacks
```

仅限管理员。此接口会向所有 Tenant Shard 扇出查询：

```
createTenantShardAccess(metaDb, env).listShardDbs()
  -> 从 d1_shards 查询所有活跃和排空中的分片
  -> 打开每个分片的 DB binding
  |
  v
对每个分片：
  feedback.findMany({ where, orderBy: createdAt desc })
  |
  v
收集所有行，按 createdAt 全局降序排序
  |
  v
在内存中对 page 和 page_size 进行切片
```

该接口查询每个分片，收集匹配的行，合并排序后在内存中对 `page` 和 `page_size` 进行切片。`total` 是过滤后的 `rows.length`，而非 SQL count。

这种方式适用于分片数量较少、反馈量合理的场景。不适合高吞吐量的列表场景。如果分片数增长到数百个，则需要在 Meta DB 中建立全局聚合表。

过滤条件：`user_id`、`type`、`created_at_start`、`created_at_end`。

## 通知

### 管理员创建通知

```http
POST /api/admin/create_notification
```

仅限管理员。写入 Meta DB：

```json
{
  "type": "system",
  "title": "维护公告",
  "content": "今晚服务将进行升级",
  "target_user_id": null
}
```

`type` 省略时默认为 `system`。`target_user_id` 控制可见性：

- `null` 或省略：全局公告，对所有用户可见
- 设置为某个用户 ID：定向通知，仅对该用户可见

返回 `{ "id": "notification_id" }`。

### 用户列出通知

```http
POST /api/list_notifications
```

需要登录。这是一次跨数据库读取。接口先从 Meta DB 查询可见通知，再从用户的 Tenant Shard 查询已读状态，最后在内存中合并：

```
步骤 1：Meta DB
  SELECT * FROM notifications
  WHERE (target_user_id IS NULL OR target_user_id = current_user)
    AND [可选的 type、created_at 过滤]
  ORDER BY created_at DESC

步骤 2：Tenant Shard DB
  SELECT notification_id FROM notification_reads
  WHERE user_id = current_user AND notification_id IN (步骤 1 的 ids)

步骤 3：构建响应，read = (id in readIds)
```

`read` 过滤需要特殊处理。由于 `read` 不是 `notifications` 的列（它存在于 Shard DB），无法放入 SQL `WHERE`。接口会先获取所有可见行，从 Shard 查询计算 `read`，再在内存中过滤：

```
如果设置了 read 过滤：
  获取所有可见行（无限制）
  计算每行的 read
  按 read === req.read 过滤
  在内存中切片分页
  total = 过滤后的长度

如果没有设置 read 过滤：
  使用 SQL limit + offset 获取
  计算每行的 read（用于展示）
  total = SQL count
```

这意味着 `read=true` 或 `read=false` 的查询效率低于不过滤的查询，因为需要加载所有可见行。对于通知量来说这是可接受的。

### 标记已读

```http
POST /api/read_notification
```

需要登录。写入当前用户的 Tenant Shard DB：

```json
{
  "id": "notification_id"
}
```

插入使用 `onConflictDoNothing`，主键为 `(notification_id, user_id)`。重复调用不会创建重复行，也不会报错。返回 `{}`。

接口不校验通知 ID 是否存在，直接插入已读状态。这是有意为之：已读状态纯粹是客户端关注的事项，在标记已读时没有业务价值去校验通知 ID。

## API 汇总

| 接口 | 认证 | 数据库 |
| --- | --- | --- |
| `POST /api/submit_feedback` | 用户 | Tenant Shard |
| `POST /api/admin/list_feedbacks` | 管理员 | 所有分片（扇出） |
| `POST /api/admin/create_notification` | 管理员 | Meta |
| `POST /api/list_notifications` | 用户 | Meta + Tenant Shard |
| `POST /api/read_notification` | 用户 | Tenant Shard |

## 常见错误

**管理员反馈列表会扇出到所有分片。** 接口循环每个活跃分片，并行查询，收集，排序，在内存中分页。`total` 是 `rows.length`，不是 SQL count。分片数量增长到数百时，此方案不具备扩展性，需要全局索引。

**`read` 过滤无法下推到 SQL。** `read` 布尔值是从 Shard DB 计算得出的，不存储在 Meta 中。请求中设置了 `read` 时，接口会先获取所有可见行，再在内存中过滤。不要假设 SQL `LIMIT` 在 `read` 过滤之前生效。

**重复标记已读不会报错。** `(notification_id, user_id)` 上的 `onConflictDoNothing` 意味着重复调用被静默忽略。这是设计如此。

**`target_user_id` 与 `user.id` 共享外键。** 删除用户会级联删除其定向通知。全局通知不受影响。

**反馈的 `type` 是自由格式。** 后端不校验其是否在固定枚举范围内。如需统一类型，在前端校验或添加 schema 约束。
