---
title: 系统公告
description: 公告发布、用户拉取和已读状态
group: 指南
order: 12
---

# 系统公告

OPC Stack 内置系统公告 API，后台可以发布公告，用户端可以拉取公告并标记已读。

## 能力范围

- 后台发布系统公告
- 用户拉取可见公告
- 用户标记公告已读

这期没有实现用户之间的私信通知。数据模型保留了 `type` 和 `target_user_id`，后续可以继续扩展通知类型和指定用户通知。

## 认证

用户拉取公告和标记已读需要登录态：

```http
Authorization: Bearer <session-token>
```

后台发布公告需要管理员密钥：

```http
Authorization: Bearer <ADMIN_SECRET>
```

## 数据模型

公告使用 `notifications` 和 `notification_reads` 表：

- `type`：公告类型，默认 `system`
- `title`：公告标题
- `content`：公告内容
- `target_user_id`：目标用户，`null` 表示全体用户可见
- `notification_reads`：记录用户已读状态

## API

### 后台发布公告

```http
POST /api/admin/create_notification
```

请求：

```json
{
  "type": "system",
  "title": "Maintenance",
  "content": "The service will be upgraded tonight",
  "target_user_id": null
}
```

`target_user_id` 不传或传 `null` 表示全体公告。传用户 ID 表示只给该用户可见。

返回：

```json
{
  "id": "notification_id"
}
```

### 用户拉取公告

```http
POST /api/list_notifications
```

请求：

```json
{
  "page": 1,
  "page_size": 20,
  "type": "system",
  "read": false,
  "created_at_start": 1767139200000,
  "created_at_end": 1767225600000
}
```

返回：

```json
{
  "items": [
    {
      "id": "notification_id",
      "type": "system",
      "title": "Maintenance",
      "content": "The service will be upgraded tonight",
      "read": false,
      "created_at": 1767139200000
    }
  ],
  "total": 1
}
```

接口只返回当前用户可见的公告：

```text
target_user_id is null
  or
target_user_id = current_user_id
```

### 标记已读

```http
POST /api/read_notification
```

请求：

```json
{
  "id": "notification_id"
}
```

返回：

```json
{}
```

重复标记已读不会重复写入。
