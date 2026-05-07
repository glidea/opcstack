---
title: Credits
description: Credit balance, checkin, referral, redemption code, and expiration
group: Guides
order: 10
---

# Credits

OPC Stack includes a credit system for AI calls, generation jobs, free quota, and simple usage based billing.

Credit API amounts use decimal strings with 6 decimal places. The database stores integer units where `1 credit = 1_000_000 units`.

## Features

- Credit balance
- Credit transaction history
- Signup reward
- Daily checkin reward
- Referral reward
- Redemption code top up
- Admin credit grant
- Credit expiration
- Old transaction cleanup

## Configuration

```bash
# Signup reward
CREDITS_SIGNUP_ENABLED=true
CREDITS_SIGNUP_AMOUNT=100

# Daily checkin reward
CREDITS_DAILY_CHECKIN_ENABLED=true
CREDITS_DAILY_CHECKIN_AMOUNT=10

# Referral reward
CREDITS_REFERRAL_ENABLED=true
CREDITS_REFERRAL_INVITER_AMOUNT=50
CREDITS_REFERRAL_INVITEE_AMOUNT=20

# Cleanup old credit_transactions
CREDITS_HISTORY_RETENTION_DAYS=90

# Expire credits every 10 minutes
CRONS=*/10 * * * *
```

## Data model

The credit system uses three main records:

- `user.credit_balance`: current balance. It can be negative
- `credit_entries`: positive credit batches with remaining expirable amount
- `credit_transactions`: balance change history

The paid business flow is:

```text
check balance
  ↓
execute business
  ↓
deduct credits after success
```

Failed business operations do not deduct credits. Concurrent requests may make the balance negative. Later signup rewards, checkins, referrals, redemption codes, or admin grants first offset the negative balance.

## API

### Get balance

```http
POST /api/get_credit_summary
```

Response:

```json
{
  "balance": "100.000000",
  "daily_checked_in": false,
  "daily_checkin_amount": "10.000000",
  "referral_enabled": true,
  "referral_code": "ABC12345",
  "invited_count": 2
}
```

### List transactions

```http
POST /api/list_credit_transactions
```

Request:

```json
{
  "page": 1,
  "page_size": 20,
  "type": "signup",
  "source_type": "signup",
  "source_id": "user_id",
  "created_at_start": 1767139200000,
  "created_at_end": 1767225600000
}
```

Response:

```json
{
  "items": [
    {
      "id": "tx_1",
      "type": "signup",
      "amount": "100.000000",
      "balance_after": "100.000000",
      "source_type": "signup",
      "source_id": "user_id",
      "description": "Signup reward",
      "expires_at": null,
      "created_at": 1767139200000
    }
  ],
  "total": 1
}
```

### Daily checkin

```http
POST /api/daily_checkin
```

Repeated checkin returns `409 DAILY_CHECKIN_ALREADY_DONE`.

### Bind referral

```http
POST /api/bind_referral
```

Request:

```json
{
  "referral_code": "ABC12345"
}
```

Each user can bind one referral only.

### Redeem credit code

```http
POST /api/redeem_credit_code
```

Request:

```json
{
  "code": "FREE100"
}
```

Used code returns `409 CREDIT_CODE_USED`. Missing or expired code returns `400 INVALID_CREDIT_CODE`.

### Generate credit codes

```http
POST /api/admin/generate_credit_codes
```

Request:

```json
{
  "count": 10,
  "amount": "100",
  "expires_at": 1767139200000
}
```

This endpoint requires `ADMIN_SECRET`.

### List credit codes

```http
POST /api/admin/list_credit_codes
```

Request:

```json
{
  "page": 1,
  "page_size": 20,
  "code": "FREE100",
  "used_by": "user_id",
  "used": false,
  "amount": "100",
  "created_at_start": 1767139200000,
  "created_at_end": 1767225600000,
  "expires_at_start": 1767139200000,
  "expires_at_end": 1769817600000
}
```

Response:

```json
{
  "items": [
    {
      "id": "code_1",
      "code": "FREE100",
      "amount": "100.000000",
      "expires_at": null,
      "used_by": null,
      "used_at": null,
      "created_at": 1767139200000
    }
  ],
  "total": 1
}
```

This endpoint requires `ADMIN_SECRET`.

### Admin grant credits

```http
POST /api/admin/grant_credits
```

Request:

```json
{
  "user_id": "user_id",
  "amount": "100",
  "source_id": "manual-2026-001",
  "description": "Manual grant",
  "expires_at": null
}
```

This endpoint requires `ADMIN_SECRET`. `source_id` prevents duplicate grants for the same operation.

## Signup reward

Signup reward is attached to Better Auth user creation:

```text
user.create.before
  ↓
generate referral_code
  ↓
insert user
  ↓
user.create.after
  ↓
grant signup credits
```

Email signup and Google first sign in use the same user creation flow.

## Daily checkin deduplication

Checkin writes a `credit_transactions` record and uses `source_type=daily_checkin` with `source_id=user_id:yyyy-mm-dd` as the idempotency key.

A second checkin on the same day does not grant credits again.

## Redemption code deduplication

Redemption does not rely on a separate read before write check. Core writes are placed in one D1 `batch()`, and SQL conditional insert expresses "insert only when the code is usable":

```sql
INSERT OR IGNORE INTO credit_entries (...)
SELECT ...
FROM credit_redemption_codes
WHERE code = ?
  AND used_by IS NULL
  AND (expires_at IS NULL OR expires_at > ?)
```

The following user balance update, code used marker, and transaction insert all use `WHERE EXISTS` to check whether this entry was inserted.

D1 does not support traditional transactions. Core credit writes use `batch()` to keep the D1 writes atomic.

## Expiration

Cron runs every 10 minutes:

```bash
CRONS=*/10 * * * *
```

Each run processes 20 expired `credit_entries`:

```text
find 20 expired entries
  ↓
deduct user.credit_balance
  ↓
insert expired transactions
  ↓
set credit_entries.remaining_amount = 0
```

`credit_entries` are not deleted because they preserve idempotency for credit grants. Old `credit_transactions` records are cleaned up by `CREDITS_HISTORY_RETENTION_DAYS`.
