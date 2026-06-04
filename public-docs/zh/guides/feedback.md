---
title: 用户反馈
description: 用户反馈提交和后台查看
group: 指南
order: 11
---

# 用户反馈

OPC Stack 内置用户反馈 API，登录用户可以提交反馈，后台可以查看反馈列表。

## 能力范围

- 登录用户提交反馈
- 后台查看用户反馈

## 认证

提交反馈需要登录态：

```http
Authorization: Bearer <session-token>
```

后台查看反馈需要管理员密钥：

```http
Authorization: Bearer <ADMIN_API_TOKEN>
```

## 数据模型

反馈使用 `feedbacks` 表：

- `user_id`：提交反馈的用户
- `type`：反馈类型，前端可以传任意非空字符串，例如 `bug`、`suggestion`、`other`
- `content`：反馈内容
- `created_at`：提交时间

## API

### 提交反馈

```http
POST /api/submit_feedback
```

请求：

```json
{
  "type": "bug",
  "content": "The upload button does not respond"
}
```

返回：

```json
{
  "id": "feedback_id"
}
```

### 后台查看反馈

```http
POST /api/admin/list_feedbacks
```

请求：

```json
{
  "page": 1,
  "page_size": 20,
  "user_id": "user_id",
  "type": "bug",
  "created_at_start": 1767139200000,
  "created_at_end": 1767225600000
}
```

返回：

```json
{
  "items": [
    {
      "id": "feedback_id",
      "user_id": "user_id",
      "type": "bug",
      "content": "The upload button does not respond",
      "created_at": 1767139200000
    }
  ],
  "total": 1
}
```
