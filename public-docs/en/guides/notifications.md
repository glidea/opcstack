---
title: Notifications
description: Announcement publishing, user listing, and read state
group: Guides
order: 12
---

# Notifications

OPC Stack includes a system announcement API. Admins can publish announcements, and users can list visible announcements and mark them as read.

## Features

- Admin publishes system announcements
- Users list visible announcements
- Users mark announcements as read

User to user notifications are not implemented in this version. The data model keeps `type` and `target_user_id` so notification types and targeted notifications can be extended later.

## Authentication

Listing notifications and marking them as read require a signed in user:

```http
Authorization: Bearer <session-token>
```

Publishing notifications requires the admin API token:

```http
Authorization: Bearer <ADMIN_API_TOKEN>
```

## Data model

Notifications use the `notifications` and `notification_reads` tables:

- `type`: notification type, defaults to `system`
- `title`: notification title
- `content`: notification body
- `target_user_id`: target user. `null` means visible to all users
- `notification_reads`: per-user read state

## API

### Admin create notification

```http
POST /api/admin/create_notification
```

Request:

```json
{
  "type": "system",
  "title": "Maintenance",
  "content": "The service will be upgraded tonight",
  "target_user_id": null
}
```

Omit `target_user_id` or set it to `null` for a global announcement. Set it to a user ID for a targeted notification.

Response:

```json
{
  "id": "notification_id"
}
```

### User list notifications

```http
POST /api/list_notifications
```

Request:

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

Response:

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

The endpoint returns only notifications visible to the current user:

```text
target_user_id is null
  or
target_user_id = current_user_id
```

### Mark as read

```http
POST /api/read_notification
```

Request:

```json
{
  "id": "notification_id"
}
```

Response:

```json
{}
```

Repeated read marks do not create duplicate rows.
