# Payments

Payment settings and products are stored in Meta D1. Environment variables are not a payment configuration source.

## Configuration model

`system_settings.payment_config` owns:

- Payment enabled state
- Default provider
- Country provider overrides
- Dodo and Creem test mode
- AES-GCM encrypted API keys and webhook secrets

`payment_products` owns the product catalog. Each product has an independent version and maps one internal product ID to exactly one configured payment Provider and one remote product ID. Provider dashboards remain the source of truth for name, description, price, currency, and billing mode.

The product row snapshots the selected Provider's current test or live environment. Test and live products are separate records. Switching a Provider's environment does not rewrite existing products; checkout only lists products whose snapshot matches the current Provider environment.

The admin configuration API exposes derived webhook URLs:

```text
https://<APP_DOMAIN>/api/webhook/dodo
https://<APP_DOMAIN>/api/webhook/creem
```

Configure the matching URL in the provider dashboard, then save its signing secret in Configuration > Payment.

## Product rules

One-time products require a positive credit amount. Subscription products require a plan name, non-negative upgrade rank, and positive period credit amount. At least one provider product ID is required.

Product IDs are immutable after creation. Updates and deletes require `expected_version`. Deleting a product referenced by an active, cancel-at-period-end, or past-due subscription returns `CONFIG_CONFLICT`.

## Runtime flow

Every HTTP request reads one Payment snapshot from D1. The service selects the provider by request country, creates provider clients from decrypted credentials, and uses D1 products for listing and checkout. A request never falls back to ENV or rereads configuration midway.

Checkout orders snapshot provider product metadata, price, currency, credits, and subscription fields. Later configuration changes only affect new operations. Webhook verification uses the secret in the request snapshot, so a replaced secret takes effect on the next request.

## APIs

Public and user APIs:

```text
POST /api/list_payment_products
POST /api/create_payment_checkout
POST /api/get_subscription
POST /api/cancel_subscription
POST /api/upgrade_subscription
POST /api/list_payment_transactions
POST /api/webhook/dodo
POST /api/webhook/creem
```

Administrator configuration APIs:

```text
POST /api/admin/get_payment_config
POST /api/admin/update_payment_config
POST /api/admin/create_payment_product
POST /api/admin/update_payment_product
POST /api/admin/delete_payment_product
```

Provider secrets use `keep`, `replace`, and `remove` mutations. Read responses only expose whether a secret is configured.

## Admin workflow

Open **Admin > Configuration > Payment**. Enable payment, select the default provider, and optionally add `COUNTRY:provider` overrides. Each provider section exposes test mode, secret operations, and the derived read-only webhook URL. Saving this form changes only the Payment singleton.

Open **Admin > Payment products** to manage the catalog. The Provider selector contains only platforms with both an API key and webhook secret configured in **Admin > System settings > Payment**. Create, edit, and delete one Product at a time. Provider and environment are fixed after creation. A successful response replaces only that Product in the page. Deletion requires confirmation. When another page has changed the same Product, `CONFIG_CONFLICT` keeps the newer value and offers an explicit refresh.
