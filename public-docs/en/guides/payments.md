---
title: Payments
description: Dodo and Creem checkout, subscriptions, webhooks, refunds, and disputes
group: Guides
group_order: 1
order: 8
---

# Payments

OPCStack supports two payment providers: Dodo and Creem. Both implement the same `PaymentProvider` interface, so the business logic above them does not branch on provider name. Payment state lives in Meta DB, credit grants live in the Tenant Shard DB, and the webhook connects them as a resumable saga.

`PAYMENT_ENABLED` controls the entire system. When `false`, `listPaymentProducts` returns an empty array, `createPaymentCheckout` throws `PAYMENT_DISABLED`, and subscription operations still work for existing subscriptions but cannot create new ones.

## Payment Architecture

```
PaymentService (src/backend/payment/index.ts)
  |
  +-- PaymentConfig (config.ts)
  |     parses PAYMENT_PRODUCTS, PAYMENT_PROVIDER, country overrides
  |
  +-- PaymentProviderRouter
  |     selects provider by request country
  |
  +-- PaymentProvider map
  |     dodo: DodoPaymentProvider (dodo.ts)
  |     creem: CreemPaymentProvider (creem.ts)
  |
  +-- CreditsService factory
        opens user's tenant shard DB and creates CreditsService
```

When `PAYMENT_ENABLED=false`, the provider map is empty `{}`. The service still serves `listPaymentProducts` (returns `[]`) and `getSubscription` (returns existing row or free plan), but checkout throws.

Meta DB tables:

| Table | Purpose |
| --- | --- |
| `checkout_orders` | One row per checkout attempt. Tracks product, provider, amount, status, provider session/payment ids |
| `payment_transactions` | One row per provider payment. Unique on `(provider, provider_payment_id)`. Tracks paid/refunded/disputed status |
| `user_subscriptions` | One row per user (upsert on `userId`). Tracks current plan, period, status, provider subscription id |
| `payment_webhook_events` | Idempotency log. Unique on `(provider, webhook_id)` |

## Product Config

`PAYMENT_PRODUCTS` is a JSON array in `.env.dev` or `.env.prod`. Each entry defines one product:

```json
[
  {
    "product_id": "credits_100",
    "type": "one_time",
    "credits_amount": "100",
    "providers": {
      "creem": {
        "kind": "remote_product",
        "product_id": "prod_abc123"
      },
      "dodo": {
        "kind": "remote_product",
        "product_id": "prod_def456"
      }
    }
  },
  {
    "product_id": "pro_monthly",
    "type": "subscription",
    "subscription_plan": "pro",
    "upgrade_rank": 1,
    "period_credits_amount": "500",
    "providers": {
      "creem": {
        "kind": "remote_product",
        "product_id": "prod_xyz789"
      }
    }
  }
]
```

Two provider product config kinds:

- **`remote_product`**: references a product already created in the provider's dashboard. The service calls `provider.listProducts` to fetch the name, description, price, and currency at request time.
- **`inline_product`**: self-describes the product. The service uses the name, description, amount, and currency from the config. No call to `provider.listProducts`.

Current Dodo and Creem checkout implementations require `remote_product`. `inline_product` is parsed by the config layer, but `DodoPaymentProvider.createCheckout` and `CreemPaymentProvider.createCheckout` reject it with `PAYMENT_PROVIDER_PRODUCT_CONFIG_INVALID`. Use dashboard products for real checkout.

`parsePaymentConfig` runs at service construction. If the config is invalid, it throws `PaymentConfigError` immediately. There is no fallback to a default product.

## Provider Router

`PaymentProviderRouter` selects which provider to use based on the request's country code. The country comes from `request.cf.country`, which Cloudflare sets at the edge.

Selection order:

1. If `PAYMENT_PROVIDER_COUNTRY_OVERRIDES` contains an entry for the request country, use that provider.
2. Otherwise, use `PAYMENT_PROVIDER`.

`PAYMENT_PROVIDER_COUNTRY_OVERRIDES` is a JSON string:

```json
[{"country":"CN","provider":"dodo"}]
```

The selected provider must have at least one product configured in `PAYMENT_PRODUCTS`, or the product is skipped in the listing.

## Platform Setup

Use provider dashboard products as the source of price truth. `PAYMENT_PRODUCTS` owns the internal product ids, credit amounts, subscription plan names, and provider routing. Provider dashboards own price, currency, billing mode, checkout, refund, and dispute events.

Webhook URLs are fixed:

```text
https://<APP_DOMAIN>/api/webhook/dodo
https://<APP_DOMAIN>/api/webhook/creem
```

Local dev uses `http://localhost:5173` for return URLs, but payment webhooks normally need a public HTTPS URL. Use a tunnel only for manual webhook testing. Do not put tunnel URLs into committed env files.

### Dodo

Use Dodo when the selected provider is `dodo`.

Dashboard steps:

1. Open Dodo Payments dashboard.
2. Complete account and business verification.
3. Create one product per sellable item.
4. For credit packs, create a one-time product.
5. For plans, create recurring subscription products.
6. Copy each Dodo `product_id`.
7. Create an API key for the same test or live environment you will run.
8. Create a webhook endpoint:

```text
https://<APP_DOMAIN>/api/webhook/dodo
```

9. Subscribe only to the events this runtime handles:

```text
payment.succeeded
payment.failed
refund.succeeded
dispute.opened
subscription.active
subscription.renewed
subscription.cancelled
subscription.failed
subscription.expired
```

10. Copy the webhook secret key.
11. Set env:

```bash
PAYMENT_ENABLED=true
PAYMENT_PROVIDER=dodo
PAYMENT_DODO_TEST_MODE=true
PAYMENT_PRODUCTS=[{"product_id":"credits_100","type":"one_time","credits_amount":"100","providers":{"dodo":{"kind":"remote_product","product_id":"prod_xxx"}}}]
```

12. Put secrets in the secret env file:

```bash
PAYMENT_DODO_API_KEY=
PAYMENT_DODO_WEBHOOK_SECRET=
```

13. Run `pnpm prepare:cloudflare:dev` or `pnpm prepare:cloudflare:prod`.

`PAYMENT_DODO_TEST_MODE=true` selects the Dodo test environment. Set it to `false` only after live products, live API key, live webhook secret, and live checkout are verified.

Docs: [Dodo products](https://docs.dodopayments.com/features/products), [Dodo webhooks](https://docs.dodopayments.com/developer-resources/webhooks), [Dodo API reference](https://docs.dodopayments.com/api-reference/introduction)

### Creem

Use Creem when the selected provider is `creem`.

Dashboard steps:

1. Open Creem dashboard.
2. Complete account and store setup.
3. Toggle Test Mode if you are configuring test products.
4. Create one product per sellable item.
5. For credit packs, create a one-time product.
6. For plans, create recurring subscription products.
7. Copy each Creem product id.
8. Create or copy an API key from the same test or live environment.
9. Create a webhook endpoint:

```text
https://<APP_DOMAIN>/api/webhook/creem
```

10. Subscribe only to the events this runtime handles:

```text
checkout.completed
subscription.paid
refund.created
dispute.created
subscription.canceled
subscription.scheduled_cancel
subscription.past_due
subscription.unpaid
subscription.expired
```

11. Copy the webhook secret.
12. Set env:

```bash
PAYMENT_ENABLED=true
PAYMENT_PROVIDER=creem
PAYMENT_CREEM_TEST_MODE=true
PAYMENT_PRODUCTS=[{"product_id":"pro_monthly","type":"subscription","subscription_plan":"pro","upgrade_rank":20,"period_credits_amount":"3000","providers":{"creem":{"kind":"remote_product","product_id":"prod_xxx"}}}]
```

13. Put secrets in the secret env file:

```bash
PAYMENT_CREEM_API_KEY=
PAYMENT_CREEM_WEBHOOK_SECRET=
```

14. Run `pnpm prepare:cloudflare:dev` or `pnpm prepare:cloudflare:prod`.

`PAYMENT_CREEM_TEST_MODE=true` selects Creem's test API. Test and production data are isolated, and API keys are not interchangeable.

Docs: [Creem API reference](https://docs.creem.io/api-reference/introduction), [Creem webhooks](https://docs.creem.io/code/webhooks)

### Product Mapping

Keep one stable internal `product_id` per business product. Provider product ids can differ.

```json
[
  {
    "product_id": "credits_100",
    "type": "one_time",
    "credits_amount": "100",
    "providers": {
      "creem": {
        "kind": "remote_product",
        "product_id": "prod_creem_credits_100"
      },
      "dodo": {
        "kind": "remote_product",
        "product_id": "prod_dodo_credits_100"
      }
    }
  },
  {
    "product_id": "pro_monthly",
    "type": "subscription",
    "subscription_plan": "pro",
    "upgrade_rank": 20,
    "period_credits_amount": "3000",
    "providers": {
      "creem": {
        "kind": "remote_product",
        "product_id": "prod_creem_pro_monthly"
      },
      "dodo": {
        "kind": "remote_product",
        "product_id": "prod_dodo_pro_monthly"
      }
    }
  }
]
```

Rules:

- `type` must match provider billing mode. One-time provider product maps to `one_time`; recurring provider product maps to `subscription`.
- `price_amount` is provider minor currency units, not credits.
- `credits_amount` and `period_credits_amount` are product credits as decimal strings.
- `upgrade_rank` must increase with plan strength. Equal or lower rank cannot be upgraded to.
- `PAYMENT_PROVIDER_COUNTRY_OVERRIDES` can only select providers present in at least one product config.

## Checkout Flow

`createPaymentCheckout` handles both one-time purchases and initial subscription checkout:

```
User picks product
  |
  v
createPaymentCheckout(productId)
  -- resolve product config
  -- select provider by request country
  -- resolve remote provider product
  -- generate checkoutOrderId (UUID)
  -- insert checkout_order with status=pending
  |
  v
provider.createCheckout({...})
  -- return_url: https://app-domain/{return_path}?checkout_order_id={id}
  -- metadata: { checkout_order_id: id }
  |
  v
Update checkout_order with providerCheckoutSessionId + checkoutUrl
  |
  v
Return checkoutUrl to frontend
```

The `checkout_order_id` is passed to the provider as metadata. When the webhook arrives, the provider returns this metadata, and the service uses it to find the original order.

Webhook endpoint registration is done in the provider dashboard. The current provider SDK calls do not pass a per-checkout webhook URL.

`return_path` defaults to `/`. It must start with a single `/` and not `//`, otherwise the service throws `PAYMENT_RETURN_PATH_INVALID`.

## Webhook Flow

Both providers send webhooks to `/api/webhook/{provider}`. The handler reads the raw body and headers, then calls `service.processWebhook`:

```
POST /api/webhook/dodo or /api/webhook/creem
  |
  v
provider.unwrapWebhook(rawBody, headers)
  -- validates signature
  -- returns PaymentEvent
  |
  v
Check payment_webhook_events for (provider, webhookId)
  -- if exists: deduplicate, return
  |
  v
Dispatch by event.type
  -- payment_succeeded    -> handlePaymentSucceeded
  -- payment_failed       -> handlePaymentFailed
  -- subscription_paid    -> handleSubscriptionPaid
  -- refund_succeeded     -> handleRefundSucceeded
  -- dispute_opened       -> handleDisputeOpened
  -- subscription_cancel_at_period_end -> update subscription status
  -- subscription_past_due / subscription_ended -> update subscription status
  |
  v
Insert payment_webhook_events row
```

If the provider signature is invalid, the handler returns 400 with `DODO_WEBHOOK_SIGNATURE_INVALID` or `CREEM_WEBHOOK_SIGNATURE_INVALID`. All other errors propagate as 500.

The webhook is public. No auth middleware runs on `/api/webhook/*`. Security relies on signature validation inside the provider.

## One-time Purchase

When `payment_succeeded` arrives for a `credits_purchase` checkout order:

```
handlePaymentSucceeded
  -> find checkout_order by event.checkoutOrderId
  -> if order.type === credits_purchase -> applyCreditsPurchase
     |
     +-> validate amount + currency match
     +-> insert payment_transaction (unique on provider + providerPaymentId)
     +-> if creditsAmount > 0: grant credits in tenant shard
     +-> update checkout_order status = completed
```

Amount and currency from the webhook must match the order. If they differ, the event is logged and ignored. This prevents a misconfigured provider product from granting wrong amounts.

The credit grant is `sourceType: 'payment_transaction'` and `sourceId: transaction.id`. If the webhook retries, `ensurePaymentTransaction` finds the existing transaction by `(provider, providerPaymentId)` and returns it. The credit grant in the shard is idempotent by `source_type + source_id`.

## Subscription Lifecycle

### Initial Subscription

When a `subscription_paid` webhook arrives with a checkout order of type `subscription_initial`:

```
handleSubscriptionPaid
  -> find checkout_order
  -> order.type === subscription_initial -> applySubscriptionInitial
     |
     +-> validate amount + currency
     +-> insert payment_transaction
     +-> upsert user_subscription (onConflictDoUpdate on userId)
     +-> grant periodCreditsAmount in tenant shard
     +-> update checkout_order status = completed
```

`user_subscriptions` has one row per user. The upsert replaces any existing subscription. If a user somehow starts a new subscription without canceling the old one, the new one overwrites.

### Renewal

When `subscription_paid` arrives without a matching checkout order (renewal is provider-initiated, not from our checkout):

```
handleSubscriptionPaid
  -> no checkout_order found
  -> applySubscriptionRenewal
     |
     +-> find user_subscription by providerSubscriptionId
     +-> insert payment_transaction (type = subscription_renewal)
     +-> grant periodCreditsAmount
     +-> extend currentPeriodStart / currentPeriodEnd
     +-> set status = active, clear canceledAt
```

Renewal resets `canceledAt` to null and status to active. A user who canceled but then renews gets their subscription back.

### Upgrade

`upgradeSubscription` is a user-initiated API call, not a webhook event:

```
POST /api/upgrade_subscription { product_id }
  |
  v
validate target upgradeRank > current upgradeRank
  -- if not: SUBSCRIPTION_UPGRADE_NOT_ALLOWED
  |
  v
insert checkout_order (type = subscription_upgrade)
  |
  v
provider.changeSubscriptionPlan
  -- Dodo: prorated_immediately
  -- Creem: proration-charge-immediately
  |
  v
Return status = pending
```

The actual plan change happens when the `subscription_paid` webhook arrives with the upgrade checkout order. `applySubscriptionUpgrade` grants the credit diff:

```
creditsDiff = max(target.periodCreditsAmount - current.periodCreditsAmount, 0)
```

Only the difference is granted. The user already received the lower plan's credits for this period.

### Cancel

```
POST /api/cancel_subscription
  |
  v
validate subscription exists and not already canceled
  -- SUBSCRIPTION_NOT_FOUND / SUBSCRIPTION_ALREADY_CANCELED
  |
  v
provider.cancelSubscription
  -- Dodo: cancel_at_next_billing_date = true
  -- Creem: scheduled cancel
  |
  v
update user_subscription
  status = cancel_at_period_end
  canceledAt = now
```

The user retains access until `current_period_end`. The service does not immediately revoke. The provider sends a `subscription_cancel_at_period_end` webhook which updates the status accordingly.

### Past Due and Ended

When the provider sends `subscription_past_due` or `subscription_ended`, the service sets the subscription status to `past_due`. The user's subscription plan reverts to `free` if the current time exceeds `current_period_end` plus the grace period.

## Grace Period

`SUBSCRIPTION_GRACE_MS` is `2 * 60 * 60 * 1000` (2 hours). When `getSubscription` checks whether a subscription is active, it considers the subscription valid if:

- `now <= currentPeriodEnd`, or
- `status === active` and `now <= currentPeriodEnd + 2h`

This covers the gap between a renewal webhook being delayed and the period technically expiring. After the grace period, `subscriptionPlan` returns `free`.

## Refund and Dispute

### Refund

When `refund_succeeded` arrives:

```
handleRefundSucceeded
  -> find payment_transaction by (provider, providerPaymentId)
  -> mark status = refunded, set refundedAt
  -> if creditsGranted > 0 and creditsReversedAt === null:
     -> deduct credits in tenant shard
        type: payment_refund
        sourceType: payment_refund
        sourceId: "{provider}:{providerRefundId}"
     -> set creditsReversedAt = now
```

The deduction uses `CreditsService.deduct`, not a negative grant. The `sourceId` is `provider:refundId`, making it idempotent: if the webhook retries, `creditsReversedAt` is already set and the deduction is skipped.

### Dispute

```
handleDisputeOpened
  -> find payment_transaction
  -> mark status = disputed, set disputedAt
```

Disputes do not automatically deduct credits. The operator reviews and decides. The transaction is marked so admin queries can filter by `status = disputed`.

## API

### List Products

```http
POST /api/list_payment_products
```

Public, no auth. Returns products available for the request country. Empty array when `PAYMENT_ENABLED=false`.

### Create Checkout

```http
POST /api/create_payment_checkout
```

Authenticated. Request: `{ "product_id": "credits_100", "return_path": "/dashboard" }`. Returns `{ "checkout_order_id": "...", "checkout_url": "https://..." }`.

### Get Subscription

```http
POST /api/get_subscription
```

Authenticated. Returns the user's current subscription state:

```json
{
  "subscription_plan": "pro",
  "subscription": {
    "product_id": "pro_monthly",
    "status": "active",
    "current_period_start": 1767139200000,
    "current_period_end": 1769817600000,
    "canceled_at": null
  }
}
```

Returns `subscription_plan: "free"` and `subscription: null` when the user has no subscription or it expired past the grace period.

### Cancel Subscription

```http
POST /api/cancel_subscription
```

Authenticated. Returns the updated status and period end. Throws `SUBSCRIPTION_NOT_FOUND` (404) or `SUBSCRIPTION_ALREADY_CANCELED` (409).

### Upgrade Subscription

```http
POST /api/upgrade_subscription
```

Authenticated. Request: `{ "product_id": "pro_yearly" }`. Returns `{ "status": "pending" }`. The upgrade completes when the provider webhook arrives.

### List Transactions

```http
POST /api/list_payment_transactions
```

Authenticated. Request: `{ "page": 1, "page_size": 20, "type": "credits_purchase", "status": "paid" }`. Returns `items` and `total`.

### Admin List Transactions

```http
POST /api/admin/list_payment_transactions
```

Admin only. Same response as user list, but includes `user_id` and supports filtering by user.

For filtering and inspecting transactions in the browser, see [Admin Console](admin-console.md).

### Webhooks

```http
POST /api/webhook/dodo
POST /api/webhook/creem
```

Public, no auth. Signature validated by provider SDK. Returns `{}` on success, 400 on signature failure.

## Config

### Public env (.env.dev / .env.prod)

```bash
# Master switch
PAYMENT_ENABLED=false

# Default provider, must appear in PAYMENT_PRODUCTS
PAYMENT_PROVIDER=creem

# Country-based provider routing
PAYMENT_PROVIDER_COUNTRY_OVERRIDES=[{"country":"CN","provider":"dodo"}]

# Product catalog (JSON array)
PAYMENT_PRODUCTS=[]

# Dodo test mode
PAYMENT_DODO_TEST_MODE=true

# Creem test mode
PAYMENT_CREEM_TEST_MODE=true
```

### Secret env (.env.secret.dev / .env.secret.prod)

```bash
PAYMENT_DODO_API_KEY=
PAYMENT_DODO_WEBHOOK_SECRET=
PAYMENT_CREEM_API_KEY=
PAYMENT_CREEM_WEBHOOK_SECRET=
```

Provider secrets are only required when `PAYMENT_ENABLED=true` and the provider is used in `PAYMENT_PRODUCTS`.

## Common Mistakes

**`PAYMENT_PRODUCTS=[]` means no purchasable products.** Even with `PAYMENT_ENABLED=true`, the product list is empty. This is the default.

**`PAYMENT_PROVIDER` must appear in `PAYMENT_PRODUCTS`.** If no product uses the configured default provider, `parsePaymentConfig` throws `PAYMENT_PROVIDER_INVALID`.

**Refund uses `deduct`, not negative `grant`.** `CreditsService.deduct` creates a `payment_refund` transaction type and uses `sourceType: payment_refund`. A negative grant would not be idempotent.

**Webhook amount mismatch is silently ignored.** If the provider sends a webhook with an amount that does not match the checkout order, the service logs `payment_amount_mismatch` and skips processing. This is intentional defense against misconfigured products.

**`user_subscriptions` is one row per user.** The upsert on `userId` means a new subscription overwrites the old one. The system does not support multiple concurrent subscriptions per user.

**Cancel does not revoke immediately.** The user keeps access until `current_period_end`. Check `canceled_at` in the subscription response to show the pending cancellation state.
