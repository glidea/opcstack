---
title: Feedback
description: User feedback submission and admin review
group: Guides
order: 11
---

# Feedback

OPC Stack includes a feedback API. Signed in users can submit feedback, and admins can list submitted feedback.

## Features

- Signed in users submit feedback
- Admin lists user feedback

## Authentication

Submitting feedback requires a signed in user:

```http
Authorization: Bearer <session-token>
```

Admin review requires the admin secret:

```http
Authorization: Bearer <ADMIN_SECRET>
```

## Data model

Feedback uses the `feedbacks` table:

- `user_id`: feedback author
- `type`: free non-empty string from the client, for example `bug`, `suggestion`, or `other`
- `content`: feedback body
- `created_at`: submit time

## API

### Submit feedback

```http
POST /api/submit_feedback
```

Request:

```json
{
  "type": "bug",
  "content": "The upload button does not respond"
}
```

Response:

```json
{
  "id": "feedback_id"
}
```

### Admin list feedback

```http
POST /api/admin/list_feedbacks
```

Request:

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

Response:

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
