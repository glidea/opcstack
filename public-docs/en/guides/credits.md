---
title: Credits
description: Credit wallet, ledger, grants, redemption codes, expiration, and admin operations
group: Guides
group_order: 1
order: 10
---

# Credits

Credits are the product quota unit. They are used by AI calls, generation jobs, signup rewards, affiliate rewards, redemption codes, payment products, and manual admin grants.

Do not confuse credits with payment money. Credits use `1 credit = 1_000_000 units`. Payment `price_amount` uses provider minor currency units such as cents.

## Model

The credit system has one current balance and two history layers:

```text
credit_balances
  current balance per user

credit_entries
  positive grant batches
  remaining amount used for expiration

credit_transactions
  append-only balance changes
```

`credit_balances.balance` is the current wallet value. It can become negative when concurrent paid actions pass the pre-check and then deduct.

`credit_entries` tracks positive credit batches. It is not the user-visible ledger. Its `remaining_amount` is the part of a grant that can still expire. If a grant first offsets a negative balance, only the remaining positive balance is expirable.

`credit_transactions` is the visible ledger. It records every grant, consume, refund reversal, and expiration with `amount`, `balance_after`, `source_type`, and `source_id`.

## Data Ownership

Credit state is split by responsibility:

```text
META_DB
  credit_redemption_codes
  checkout_orders
  payment_transactions
  user_subscriptions

Tenant Shard DB
  credit_balances
  credit_entries
  credit_transactions
```

Current-user credit reads and writes must use `ctx.get('tenantDb')`. This keeps the request's tenant bookmark aligned with the write.

Admin operations and payment webhooks may need to credit another user. Those flows resolve the user's shard through Meta DB and then open that shard with `createTenantShardAccess(...).openUserDb(userId)`.

There is no cross-DB transaction between Meta DB and Tenant Shard DB. Any flow that touches both databases must be treated as a saga with idempotent side effects.

## Amount Rules

API requests use decimal strings:

```json
{
  "amount": "100.500000"
}
```

Internal services use integer units:

```text
1 credit      = 1_000_000 units
100 credits  = 100_000_000 units
0.5 credits  = 500_000 units
```

Responses always format credit amounts with 6 decimal places:

```json
{
  "balance": "100.000000"
}
```

Only positive amounts are accepted for grants, deductions, generated codes, daily checkin, and admin grant input. Negative balance is a state, not an input format.

## Transaction Types

The built-in transaction types are:

| Type | Writer | Meaning |
| --- | --- | --- |
| `signup` | Better Auth user creation hook | Signup reward |
| `daily_checkin` | `POST /api/daily_checkin` | Daily checkin reward |
| `redemption_code` | `POST /api/redeem_credit_code` | Redeemed credit code |
| `manual_grant` | `POST /api/admin/grant_credits` | Admin grant |
| `payment_purchase` | Payment webhook | Credits granted by paid product or subscription |
| `payment_refund` | Payment webhook | Credits reversed after refund |
| `affiliate_inviter` | Affiliate flow | Inviter reward |
| `affiliate_invitee` | Affiliate flow | Invitee reward |
| `consume` | Paid product feature | Feature usage deduction |
| `expired` | Cron job | Expired grant amount |

For custom paid features, use `consume` unless the feature needs its own reporting category.

## Idempotency

Every grant and deduction must have a stable `source_type + source_id`.

The uniqueness key is not scoped by `user_id`. If two users may share the same external id, include the user id in `source_id`.

Examples:

```text
signup                user_id
daily_checkin         user_id:yyyy-mm-dd
redemption_code       credit_redemption_codes.id
manual_grant          operator provided source_id
payment_transaction   payment_transactions.id
payment_refund        provider:provider_refund_id
ai_image              task_id
```

Do not use a random `source_id` for retryable business operations. A retry must hit the same idempotency key.

## Grant Flow

Use `CreditsService.grant` for positive credits.

The service writes one D1 batch:

```text
insert credit_balances if missing
  ↓
insert credit_entries when source_type + source_id is new
  ↓
increase credit_balances.balance
  ↓
set credit_entries.remaining_amount
  ↓
insert credit_transactions
```

If the same `source_type + source_id` already exists, the call returns `duplicated: true` and does not grant credits again.

Granting into a negative balance is allowed. Example:

```text
balance before grant = -30 credits
grant amount         = 100 credits
balance after grant  = 70 credits
remaining_amount     = 70 credits
```

Only the actual positive remainder can expire later.

## Deduct Flow

Paid actions should use this shape:

```text
ensure enough credits
  ↓
run business operation
  ↓
deduct credits after success
```

`CreditsService.runPaidAction` implements that pattern:

```ts
import { CreditsService } from '../../credits'
import { parseDecimal } from '../../lib/decimal'

type GenerateResult = {
  taskId: string
}

type GenerateRequest = {
  idempotencyKey: string
}

const request: GenerateRequest = await parseGenerateRequest(ctx)
const credits: CreditsService = new CreditsService(ctx.get('tenantDb'))
const result: GenerateResult = await credits.runPaidAction<GenerateResult>({
  userId: ctx.get('userId'),
  amount: parseDecimal('5'),
  sourceType: 'ai_image',
  sourceId: request.idempotencyKey,
  description: 'AI image generation',
  execute: async (): Promise<GenerateResult> => {
    return createImageTask(request)
  }
})
```

If `execute` throws, credits are not deducted.

`deduct` consumes `credit_entries.remaining_amount` in expiration order:

```text
earliest expires_at first
then non-expiring entries
then created_at
then id
```

The balance deduction itself is idempotent by `source_type + source_id`. A duplicate deduction returns `duplicated: true`.

This is not a hard reservation system. `ensureEnough` and `deduct` are separate operations. Concurrent paid actions can make the balance negative. That is intentional for the current template because it keeps the D1 write path simple.

## Signup Reward

Better Auth user creation creates the tenant credit balance first:

```text
user.create.after
  ↓
open user's tenant shard
  ↓
create credit balance
  ↓
grant signup credits when enabled
```

The Credits configuration in Meta D1 controls whether the reward is enabled and its amount. The hook reads one configuration snapshot after user creation.

The grant uses:

```text
type        signup
sourceType  signup
sourceId    user_id
```

Email signup and first OAuth sign-in share the same user creation hook.

## Daily Checkin

Daily checkin is a normal grant with a date-based idempotency key:

```text
type        daily_checkin
sourceType  daily_checkin
sourceId    user_id:yyyy-mm-dd
```

The Credits configuration in Meta D1 controls whether daily check-in is enabled and its amount.

The date is UTC. A second checkin on the same UTC day returns `409 DAILY_CHECKIN_ALREADY_DONE`.

If daily checkin is disabled, `POST /api/daily_checkin` returns an empty JSON response and does not grant credits.

## Redemption Codes

Redemption codes live in Meta DB because they are global inventory, not tenant ledger state.

The flow crosses Meta DB and Tenant Shard DB:

```text
claim code in META_DB
  status: unused -> claimed
  claimed_by = user_id
  ↓
grant credits in user's Tenant Shard DB
  sourceType = redemption_code
  sourceId = credit_redemption_codes.id
  ↓
mark code granted in META_DB
  status: granted
  granted_at = now
```

If the Meta claim succeeds but the tenant grant fails, the API returns `202 CREDIT_GRANT_PENDING`. The code remains `claimed` by that user. Retrying the same code by the same user can continue the grant.

Code status values:

| Status | Meaning |
| --- | --- |
| `unused` | Can be claimed |
| `claimed` | Claimed in Meta DB, tenant grant may still be pending |
| `granted` | Tenant grant completed |

Expired codes cannot be claimed.

## Payment Credits

Payment products can grant credits through `credits_amount` or `period_credits_amount`.

Successful payment webhook:

```text
payment transaction in META_DB
  ↓
grant credits in user's Tenant Shard DB
  type        payment_purchase
  sourceType  payment_transaction
  sourceId    payment_transactions.id
```

Refund webhook:

```text
mark payment transaction refunded in META_DB
  ↓
deduct granted credits in user's Tenant Shard DB
  type        payment_refund
  sourceType  payment_refund
  sourceId    provider:provider_refund_id
```

Refund uses `deduct`, not a negative grant. Negative grants do not exist.

## Expiration And Cleanup

The built-in cron is:

```bash
CRONS=*/10 * * * *
```

The scheduled job runs every 10 minutes. For each tenant shard it:

```text
expire up to 20 credit_entries
  ↓
delete up to 100 old credit_transactions
```

Expiration writes a negative `expired` transaction and sets the entry's `remaining_amount` to `0`.

Transaction cleanup reads `historyRetentionDays` from the Credits configuration in Meta D1 once per cron execution.

`credit_entries` are not deleted. They preserve grant idempotency and expiration state.

## API

User endpoints require an authenticated session and beta gate access.

### Get Summary

```http
POST /api/get_credit_summary
```

Response:

```json
{
  "balance": "100.000000",
  "daily_checked_in": false,
  "daily_checkin_amount": "10.000000"
}
```

### List Transactions

```http
POST /api/list_credit_transactions
```

Request:

```json
{
  "page": 1,
  "page_size": 20,
  "type": "consume",
  "source_type": "ai_image",
  "source_id": "task_123",
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
      "type": "consume",
      "amount": "-5.000000",
      "balance_after": "95.000000",
      "source_type": "ai_image",
      "source_id": "task_123",
      "description": "AI image generation",
      "expires_at": null,
      "created_at": 1767139200000
    }
  ],
  "total": 1
}
```

### Daily Checkin

```http
POST /api/daily_checkin
```

Response:

```json
{
  "balance": "110.000000",
  "checked_in": true,
  "amount": "10.000000"
}
```

### Redeem Code

```http
POST /api/redeem_credit_code
```

Request:

```json
{
  "code": "FREE100"
}
```

Response:

```json
{
  "balance": "200.000000",
  "amount": "100.000000"
}
```

Errors:

| Code | Status |
| --- | --- |
| `INVALID_CREDIT_CODE` | `400` |
| `CREDIT_CODE_USED` | `409` |
| `CREDIT_GRANT_PENDING` | `202` |

## Admin API

Admin endpoints require `administratorMiddleware`, which verifies the authenticated user's current D1 administrator role for browser sessions and OAuth access.

For generating credit codes or granting credits through the browser, see [Admin Console](admin-console.md).

### Generate Codes

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

`count` defaults to `1` and maxes at `200`.

### List Codes

```http
POST /api/admin/list_credit_codes
```

Request:

```json
{
  "page": 1,
  "page_size": 20,
  "code": "FREE100",
  "claimed_by": "user_id",
  "status": "claimed",
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
      "status": "unused",
      "expires_at": null,
      "claimed_by": null,
      "claimed_at": null,
      "granted_at": null,
      "created_at": 1767139200000
    }
  ],
  "total": 1
}
```

### Grant Credits

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

Response:

```json
{
  "balance": "300.000000"
}
```

Use a stable `source_id` for the operator action. Include the user id or grant id if the operator source can collide. Reusing the same `source_id` for `manual_grant` in the same tenant shard returns `409 CREDIT_GRANT_DUPLICATED`.

## Configuration

Credits settings are managed in the Credits tab under System settings and stored in Meta D1. API amounts are decimal strings: `100` and `100.000000` both mean 100 credits. D1 stores the same value as `100000000` integer units.

`CRONS=*/10 * * * *` remains deployment topology configuration and is required for expiration and cleanup jobs.

## Common Mistakes

**Mixing credit units and payment units.** `credits_amount` is credits. `price_amount` is provider minor currency units.

**Writing the current user's credits with `openUserDb`.** Use `ctx.get('tenantDb')` inside authenticated user requests.

**Using random idempotency keys.** Retries must reuse the same `source_type + source_id`.

**Charging before the business operation succeeds.** Use `runPaidAction` or deduct after success.

**Expecting redemption claim to mean grant completed.** `claimed` means Meta DB accepted the code. `granted` means the Tenant Shard grant completed.

**Deleting `credit_entries`.** They are part of idempotency and expiration state.

**Forgetting the cron.** Without `CRONS=*/10 * * * *`, credits do not expire and transaction cleanup does not run.
