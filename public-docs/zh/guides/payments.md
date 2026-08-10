---
title: 支付
description: Dodo 和 Creem 的 checkout、订阅、webhook、退款与争议
group: Guides
group_order: 1
order: 8
---

# 支付

OPCStack 支持两个支付 provider：Dodo 和 Creem。两者都实现了相同的 `PaymentProvider` 接口，因此其上层的业务逻辑不需要按 provider 名称分支。支付状态存在 Meta DB，积分授予存在 Tenant Shard DB，webhook 通过 saga 模式连接两者。

`PAYMENT_ENABLED` 控制整个系统。当为 `false` 时，`listPaymentProducts` 返回空数组，`createPaymentCheckout` 抛出 `PAYMENT_DISABLED`，订阅操作仍然对已有订阅生效，但不能创建新订阅。

## 支付架构

```
PaymentService (src/backend/payment/index.ts)
  |
  +-- PaymentConfig (config.ts)
  |     解析 PAYMENT_PRODUCTS、PAYMENT_PROVIDER、国家覆盖
  |
  +-- PaymentProviderRouter
  |     根据请求国家选择 provider
  |
  +-- PaymentProvider map
  |     dodo: DodoPaymentProvider (dodo.ts)
  |     creem: CreemPaymentProvider (creem.ts)
  |
  +-- CreditsService factory
        打开用户的 tenant shard DB 并创建 CreditsService
```

当 `PAYMENT_ENABLED=false` 时，provider map 为空 `{}`。service 仍然提供 `listPaymentProducts`（返回 `[]`）和 `getSubscription`（返回已有行或 free plan），但 checkout 会抛错。

Meta DB 表：

| 表 | 用途 |
| --- | --- |
| `checkout_orders` | 每次 checkout 一行。记录产品、provider、金额、状态、provider session/payment id |
| `payment_transactions` | 每次 provider 支付一行。在 `(provider, provider_payment_id)` 上唯一。记录已支付/已退款/已争议状态 |
| `user_subscriptions` | 每个用户一行（在 `userId` 上 upsert）。记录当前方案、周期、状态、provider 订阅 id |
| `payment_webhook_events` | 幂等日志。在 `(provider, webhook_id)` 上唯一 |

## 产品配置

`PAYMENT_PRODUCTS` 是 `.env.dev` 或 `.env.prod` 中的 JSON 数组。每条定义一个产品：

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

两种 provider 产品配置类型：

- **`remote_product`**：引用已在 provider dashboard 中创建的产品。service 在请求时调用 `provider.listProducts` 获取名称、描述、价格和货币。
- **`inline_product`**：自描述产品。service 使用配置中的名称、描述、金额和货币，不调用 `provider.listProducts`。

当前 Dodo 和 Creem 的 checkout 实现要求使用 `remote_product`。`inline_product` 由配置层解析，但 `DodoPaymentProvider.createCheckout` 和 `CreemPaymentProvider.createCheckout` 会以 `PAYMENT_PROVIDER_PRODUCT_CONFIG_INVALID` 拒绝它。真实 checkout 请使用 dashboard 产品。

`parsePaymentConfig` 在 service 构建时运行。如果配置无效，立即抛出 `PaymentConfigError`，没有默认产品的回退。

## Provider 路由

`PaymentProviderRouter` 根据请求的国家码选择使用哪个 provider。国家来自 `request.cf.country`，由 Cloudflare 在边缘设置。

选择顺序：

1. 如果 `PAYMENT_PROVIDER_COUNTRY_OVERRIDES` 中有请求国家的条目，使用该 provider。
2. 否则，使用 `PAYMENT_PROVIDER`。

`PAYMENT_PROVIDER_COUNTRY_OVERRIDES` 是 JSON 字符串：

```json
[{"country":"CN","provider":"dodo"}]
```

所选 provider 在 `PAYMENT_PRODUCTS` 中必须至少配置了一个产品，否则该产品会在列表中被跳过。

## 平台配置

以 provider dashboard 产品作为价格的事实来源。`PAYMENT_PRODUCTS` 负责内部产品 id、积分金额、订阅方案名称和 provider 路由。Provider dashboard 负责价格、货币、计费模式、checkout、退款和争议事件。

Webhook URL 固定为：

```text
https://<APP_DOMAIN>/api/webhook/dodo
https://<APP_DOMAIN>/api/webhook/creem
```

本地开发的 return URL 使用 `http://localhost:5173`，但支付 webhook 通常需要公共 HTTPS URL。仅在手动测试 webhook 时使用隧道。不要将隧道 URL 放入已提交的 env 文件。

### Dodo

当所选 provider 为 `dodo` 时使用 Dodo。

Dashboard 步骤：

1. 打开 Dodo Payments dashboard。
2. 完成账号和业务验证。
3. 为每个可售商品创建一个产品。
4. 积分包创建一次性产品。
5. 方案创建定期订阅产品。
6. 复制每个 Dodo `product_id`。
7. 为同一测试或正式环境创建 API key。
8. 创建 webhook 端点：

```text
https://<APP_DOMAIN>/api/webhook/dodo
```

9. 仅订阅运行时处理的事件：

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

10. 复制 webhook 密钥。
11. 设置 env：

```bash
PAYMENT_ENABLED=true
PAYMENT_PROVIDER=dodo
PAYMENT_DODO_TEST_MODE=true
PAYMENT_PRODUCTS=[{"product_id":"credits_100","type":"one_time","credits_amount":"100","providers":{"dodo":{"kind":"remote_product","product_id":"prod_xxx"}}}]
```

12. 将密钥放入 secret env 文件：

```bash
PAYMENT_DODO_API_KEY=
PAYMENT_DODO_WEBHOOK_SECRET=
```

13. 运行 `pnpm prepare:cloudflare:dev` 或 `pnpm prepare:cloudflare:prod`。

`PAYMENT_DODO_TEST_MODE=true` 选择 Dodo 测试环境。只有在正式产品、正式 API key、正式 webhook 密钥和正式 checkout 都验证后，才将其设置为 `false`。

文档：[Dodo products](https://docs.dodopayments.com/features/products)、[Dodo webhooks](https://docs.dodopayments.com/developer-resources/webhooks)、[Dodo API reference](https://docs.dodopayments.com/api-reference/introduction)

### Creem

当所选 provider 为 `creem` 时使用 Creem。

Dashboard 步骤：

1. 打开 Creem dashboard。
2. 完成账号和 store 配置。
3. 如果配置测试产品，切换到 Test Mode。
4. 为每个可售商品创建一个产品。
5. 积分包创建一次性产品。
6. 方案创建定期订阅产品。
7. 复制每个 Creem 产品 id。
8. 从同一测试或正式环境创建或复制 API key。
9. 创建 webhook 端点：

```text
https://<APP_DOMAIN>/api/webhook/creem
```

10. 仅订阅运行时处理的事件：

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

11. 复制 webhook 密钥。
12. 设置 env：

```bash
PAYMENT_ENABLED=true
PAYMENT_PROVIDER=creem
PAYMENT_CREEM_TEST_MODE=true
PAYMENT_PRODUCTS=[{"product_id":"pro_monthly","type":"subscription","subscription_plan":"pro","upgrade_rank":20,"period_credits_amount":"3000","providers":{"creem":{"kind":"remote_product","product_id":"prod_xxx"}}}]
```

13. 将密钥放入 secret env 文件：

```bash
PAYMENT_CREEM_API_KEY=
PAYMENT_CREEM_WEBHOOK_SECRET=
```

14. 运行 `pnpm prepare:cloudflare:dev` 或 `pnpm prepare:cloudflare:prod`。

`PAYMENT_CREEM_TEST_MODE=true` 选择 Creem 的测试 API。测试和生产数据是隔离的，API key 不可互换。

文档：[Creem API reference](https://docs.creem.io/api-reference/introduction)、[Creem webhooks](https://docs.creem.io/code/webhooks)

### 产品映射

每个业务产品保持一个稳定的内部 `product_id`。Provider 产品 id 可以不同。

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

规则：

- `type` 必须与 provider 计费模式匹配。一次性 provider 产品对应 `one_time`；定期 provider 产品对应 `subscription`。
- `price_amount` 是 provider 的货币最小单位，不是积分。
- `credits_amount` 和 `period_credits_amount` 是以十进制字符串表示的产品积分。
- `upgrade_rank` 必须随方案强度递增。等于或低于当前 rank 的方案不能升级。
- `PAYMENT_PROVIDER_COUNTRY_OVERRIDES` 只能选择在至少一个产品配置中出现的 provider。

## Checkout 流程

`createPaymentCheckout` 同时处理一次性购买和初始订阅 checkout：

```
用户选择产品
  |
  v
createPaymentCheckout(productId)
  -- 解析产品配置
  -- 根据请求国家选择 provider
  -- 解析远端 provider 产品
  -- 生成 checkoutOrderId（UUID）
  -- 插入 status=pending 的 checkout_order
  |
  v
provider.createCheckout({...})
  -- return_url: https://app-domain/{return_path}?checkout_order_id={id}
  -- metadata: { checkout_order_id: id }
  |
  v
用 providerCheckoutSessionId + checkoutUrl 更新 checkout_order
  |
  v
返回 checkoutUrl 给前端
```

`checkout_order_id` 作为 metadata 传给 provider。当 webhook 到达时，provider 返回这个 metadata，service 用它找到原始订单。

Webhook 端点注册在 provider dashboard 中完成。当前 provider SDK 调用不会传递每次 checkout 的 webhook URL。

`return_path` 默认为 `/`。它必须以单个 `/` 开头，不能以 `//` 开头，否则 service 抛出 `PAYMENT_RETURN_PATH_INVALID`。

## Webhook 流程

两个 provider 都将 webhook 发送到 `/api/webhook/{provider}`。处理器读取原始 body 和 headers，然后调用 `service.processWebhook`：

```
POST /api/webhook/dodo 或 /api/webhook/creem
  |
  v
provider.unwrapWebhook(rawBody, headers)
  -- 验证签名
  -- 返回 PaymentEvent
  |
  v
检查 payment_webhook_events 中的 (provider, webhookId)
  -- 如果存在：去重，返回
  |
  v
按 event.type 分发
  -- payment_succeeded    -> handlePaymentSucceeded
  -- payment_failed       -> handlePaymentFailed
  -- subscription_paid    -> handleSubscriptionPaid
  -- refund_succeeded     -> handleRefundSucceeded
  -- dispute_opened       -> handleDisputeOpened
  -- subscription_cancel_at_period_end -> 更新订阅状态
  -- subscription_past_due / subscription_ended -> 更新订阅状态
  |
  v
插入 payment_webhook_events 行
```

如果 provider 签名无效，处理器返回 400，错误码为 `DODO_WEBHOOK_SIGNATURE_INVALID` 或 `CREEM_WEBHOOK_SIGNATURE_INVALID`。其他所有错误传播为 500。

Webhook 是公开的。`/api/webhook/*` 上不运行 auth 中间件。安全性依赖 provider 内部的签名验证。

## 一次性购买

当 `payment_succeeded` 到达，对应 `credits_purchase` 类型的 checkout 订单时：

```
handlePaymentSucceeded
  -> 通过 event.checkoutOrderId 查找 checkout_order
  -> 如果 order.type === credits_purchase -> applyCreditsPurchase
     |
     +-> 验证金额和货币匹配
     +-> 插入 payment_transaction（通过 provider + providerPaymentId 唯一）
     +-> 如果 creditsAmount > 0：在 tenant shard 中授予积分
     +-> 更新 checkout_order status = completed
```

来自 webhook 的金额和货币必须与订单匹配。如果不匹配，事件被记录并忽略。这防止配置错误的 provider 产品授予错误金额。

积分授予使用 `sourceType: 'payment_transaction'` 和 `sourceId: transaction.id`。如果 webhook 重试，`ensurePaymentTransaction` 通过 `(provider, providerPaymentId)` 找到已有交易并返回它。分片中的积分授予通过 `source_type + source_id` 保证幂等。

## 订阅生命周期

### 初始订阅

当 `subscription_paid` webhook 到达，对应 `subscription_initial` 类型的 checkout 订单时：

```
handleSubscriptionPaid
  -> 查找 checkout_order
  -> order.type === subscription_initial -> applySubscriptionInitial
     |
     +-> 验证金额和货币
     +-> 插入 payment_transaction
     +-> upsert user_subscription（在 userId 上 onConflictDoUpdate）
     +-> 在 tenant shard 中授予 periodCreditsAmount
     +-> 更新 checkout_order status = completed
```

`user_subscriptions` 每个用户一行。upsert 会替换任何已有订阅。如果用户在不取消旧订阅的情况下开始新订阅，新的会覆盖旧的。

### 续订

当 `subscription_paid` 到达但没有匹配的 checkout 订单时（续订是 provider 发起的，不是从我们的 checkout 来的）：

```
handleSubscriptionPaid
  -> 未找到 checkout_order
  -> applySubscriptionRenewal
     |
     +-> 通过 providerSubscriptionId 查找 user_subscription
     +-> 插入 payment_transaction（type = subscription_renewal）
     +-> 授予 periodCreditsAmount
     +-> 延长 currentPeriodStart / currentPeriodEnd
     +-> 设置 status = active，清除 canceledAt
```

续订将 `canceledAt` 重置为 null，status 重置为 active。已取消后又续订的用户会恢复其订阅。

### 升级

`upgradeSubscription` 是用户发起的 API 调用，不是 webhook 事件：

```
POST /api/upgrade_subscription { product_id }
  |
  v
验证目标 upgradeRank > 当前 upgradeRank
  -- 否则：SUBSCRIPTION_UPGRADE_NOT_ALLOWED
  |
  v
插入 checkout_order（type = subscription_upgrade）
  |
  v
provider.changeSubscriptionPlan
  -- Dodo: prorated_immediately
  -- Creem: proration-charge-immediately
  |
  v
返回 status = pending
```

实际方案变更在携带升级 checkout 订单的 `subscription_paid` webhook 到达时发生。`applySubscriptionUpgrade` 授予积分差值：

```
creditsDiff = max(target.periodCreditsAmount - current.periodCreditsAmount, 0)
```

只授予差额。用户本周期已收到较低方案的积分。

### 取消

```
POST /api/cancel_subscription
  |
  v
验证订阅存在且未已取消
  -- SUBSCRIPTION_NOT_FOUND / SUBSCRIPTION_ALREADY_CANCELED
  |
  v
provider.cancelSubscription
  -- Dodo: cancel_at_next_billing_date = true
  -- Creem: scheduled cancel
  |
  v
更新 user_subscription
  status = cancel_at_period_end
  canceledAt = now
```

用户保留访问权限直到 `current_period_end`。service 不立即撤销。Provider 发送 `subscription_cancel_at_period_end` webhook，相应更新状态。

### 逾期与结束

当 provider 发送 `subscription_past_due` 或 `subscription_ended` 时，service 将订阅状态设置为 `past_due`。如果当前时间超过 `current_period_end` 加上宽限期，用户的订阅方案恢复为 `free`。

## 宽限期

`SUBSCRIPTION_GRACE_MS` 为 `2 * 60 * 60 * 1000`（2 小时）。`getSubscription` 检查订阅是否有效时，满足以下条件视为有效：

- `now <= currentPeriodEnd`，或
- `status === active` 且 `now <= currentPeriodEnd + 2h`

这涵盖了续订 webhook 延迟而周期在技术上已到期的情况。宽限期后，`subscriptionPlan` 返回 `free`。

## 退款与争议

### 退款

当 `refund_succeeded` 到达时：

```
handleRefundSucceeded
  -> 通过 (provider, providerPaymentId) 查找 payment_transaction
  -> 标记 status = refunded，设置 refundedAt
  -> 如果 creditsGranted > 0 且 creditsReversedAt === null：
     -> 在 tenant shard 中扣减积分
        type: payment_refund
        sourceType: payment_refund
        sourceId: "{provider}:{providerRefundId}"
     -> 设置 creditsReversedAt = now
```

扣减使用 `CreditsService.deduct`，不是负数授予。`sourceId` 为 `provider:refundId`，使其幂等：如果 webhook 重试，`creditsReversedAt` 已设置，扣减被跳过。

### 争议

```
handleDisputeOpened
  -> 查找 payment_transaction
  -> 标记 status = disputed，设置 disputedAt
```

争议不自动扣减积分。运营者审查并决定。交易被标记，以便管理员查询可按 `status = disputed` 过滤。

## API

### 获取产品列表

```http
POST /api/list_payment_products
```

公开，无需认证。返回请求国家可用的产品。`PAYMENT_ENABLED=false` 时返回空数组。

### 创建 Checkout

```http
POST /api/create_payment_checkout
```

需要认证。请求：`{ "product_id": "credits_100", "return_path": "/dashboard" }`。返回 `{ "checkout_order_id": "...", "checkout_url": "https://..." }`。

### 获取订阅

```http
POST /api/get_subscription
```

需要认证。返回用户当前订阅状态：

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

用户无订阅或订阅超过宽限期时，返回 `subscription_plan: "free"` 和 `subscription: null`。

### 取消订阅

```http
POST /api/cancel_subscription
```

需要认证。返回更新后的状态和周期结束时间。抛出 `SUBSCRIPTION_NOT_FOUND`（404）或 `SUBSCRIPTION_ALREADY_CANCELED`（409）。

### 升级订阅

```http
POST /api/upgrade_subscription
```

需要认证。请求：`{ "product_id": "pro_yearly" }`。返回 `{ "status": "pending" }`。provider webhook 到达后升级完成。

### 获取交易列表

```http
POST /api/list_payment_transactions
```

需要认证。请求：`{ "page": 1, "page_size": 20, "type": "credits_purchase", "status": "paid" }`。返回 `items` 和 `total`。

### 管理员获取交易列表

```http
POST /api/admin/list_payment_transactions
```

仅管理员。响应与用户列表相同，但包含 `user_id` 并支持按用户过滤。

在浏览器中筛选和查看交易的流程参阅[管理控制台](admin-console.md)。

### Webhooks

```http
POST /api/webhook/dodo
POST /api/webhook/creem
```

公开，无需认证。由 provider SDK 验证签名。成功返回 `{}`，签名验证失败返回 400。

## 配置

### 公共 env（.env.dev / .env.prod）

```bash
# 主开关
PAYMENT_ENABLED=false

# 默认 provider，必须在 PAYMENT_PRODUCTS 中出现
PAYMENT_PROVIDER=creem

# 基于国家的 provider 路由
PAYMENT_PROVIDER_COUNTRY_OVERRIDES=[{"country":"CN","provider":"dodo"}]

# 产品目录（JSON 数组）
PAYMENT_PRODUCTS=[]

# Dodo 测试模式
PAYMENT_DODO_TEST_MODE=true

# Creem 测试模式
PAYMENT_CREEM_TEST_MODE=true
```

### 密钥 env（.env.secret.dev / .env.secret.prod）

```bash
PAYMENT_DODO_API_KEY=
PAYMENT_DODO_WEBHOOK_SECRET=
PAYMENT_CREEM_API_KEY=
PAYMENT_CREEM_WEBHOOK_SECRET=
```

只有当 `PAYMENT_ENABLED=true` 且 provider 在 `PAYMENT_PRODUCTS` 中被使用时，才需要 provider 密钥。

## 常见错误

**`PAYMENT_PRODUCTS=[]` 意味着没有可购买的产品。** 即使 `PAYMENT_ENABLED=true`，产品列表也是空的。这是默认值。

**`PAYMENT_PROVIDER` 必须在 `PAYMENT_PRODUCTS` 中出现。** 如果没有产品使用配置的默认 provider，`parsePaymentConfig` 抛出 `PAYMENT_PROVIDER_INVALID`。

**退款使用 `deduct`，不是负数 `grant`。** `CreditsService.deduct` 创建 `payment_refund` 交易类型，使用 `sourceType: payment_refund`。负数授予不具有幂等性。

**Webhook 金额不匹配会被静默忽略。** 如果 provider 发送的 webhook 金额与 checkout 订单不匹配，service 记录 `payment_amount_mismatch` 并跳过处理。这是有意的防御措施，针对配置错误的产品。

**`user_subscriptions` 每个用户一行。** 在 `userId` 上的 upsert 意味着新订阅会覆盖旧订阅。系统不支持每个用户同时存在多个订阅。

**取消不会立即撤销。** 用户保留访问权限直到 `current_period_end`。检查订阅响应中的 `canceled_at` 以显示待取消状态。
