---
title: 积分
description: 积分钱包、账本、授予、兑换码、过期与管理员操作
group: Guides
group_order: 1
order: 10
---

# 积分

积分是产品的配额单位，用于 AI 调用、生成任务、注册奖励、推广奖励、兑换码、支付产品和管理员手动授予。

不要将积分与支付金额混淆。积分使用 `1 credit = 1_000_000 units`。支付 `price_amount` 使用 provider 的最小货币单位（如分）。

## 模型

积分系统有一个当前余额和两个历史层：

```text
credit_balances
  每个用户的当前余额

credit_entries
  正向授予批次
  remaining_amount 用于过期计算

credit_transactions
  只追加的余额变更记录
```

`credit_balances.balance` 是当前钱包值。当并发付费操作通过前置检查后同时扣减时，余额可能变为负数。

`credit_entries` 追踪正向积分批次，不是用户可见的账本。其 `remaining_amount` 是一次授予中仍可过期的部分。如果一次授予先抵消了负余额，则只有剩余的正余额部分可以过期。

`credit_transactions` 是可见账本。它记录每次授予、消费、退款冲销和过期，包含 `amount`、`balance_after`、`source_type` 和 `source_id`。

## 数据归属

积分状态按职责划分：

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

当前用户的积分读写必须使用 `ctx.get('tenantDb')`，以确保请求的 tenant bookmark 与写入对齐。

管理员操作和支付 webhook 可能需要为其他用户授予积分。这些流程通过 Meta DB 解析目标用户的分片，然后用 `createTenantShardAccess(...).openUserDb(userId)` 打开该分片。

Meta DB 与 Tenant Shard DB 之间没有跨 DB 事务。任何同时写入两个数据库的流程必须作为具有幂等副作用的 saga 来处理。

## 金额规则

API 请求使用十进制字符串：

```json
{
  "amount": "100.500000"
}
```

内部服务使用整数单位：

```text
1 credit      = 1_000_000 units
100 credits  = 100_000_000 units
0.5 credits  = 500_000 units
```

响应始终以 6 位小数格式化积分金额：

```json
{
  "balance": "100.000000"
}
```

授予、扣减、生成码、每日签到和管理员授予输入只接受正数。负余额是一种状态，不是输入格式。

## 交易类型

内置交易类型：

| 类型 | 写入方 | 含义 |
| --- | --- | --- |
| `signup` | Better Auth 用户创建 hook | 注册奖励 |
| `daily_checkin` | `POST /api/daily_checkin` | 每日签到奖励 |
| `redemption_code` | `POST /api/redeem_credit_code` | 兑换积分码 |
| `manual_grant` | `POST /api/admin/grant_credits` | 管理员授予 |
| `payment_purchase` | 支付 webhook | 付费产品或订阅授予的积分 |
| `payment_refund` | 支付 webhook | 退款后冲销的积分 |
| `affiliate_inviter` | 推广流程 | 邀请人奖励 |
| `affiliate_invitee` | 推广流程 | 被邀请人奖励 |
| `consume` | 付费产品功能 | 功能使用扣减 |
| `expired` | Cron 任务 | 过期授予金额 |

对于自定义付费功能，使用 `consume`，除非该功能需要独立的报表分类。

## 幂等性

每次授予和扣减必须有稳定的 `source_type + source_id`。

唯一键不按 `user_id` 限定范围。如果两个用户可能共享相同的外部 id，则在 `source_id` 中包含 user id。

示例：

```text
signup                user_id
daily_checkin         user_id:yyyy-mm-dd
redemption_code       credit_redemption_codes.id
manual_grant          operator 提供的 source_id
payment_transaction   payment_transactions.id
payment_refund        provider:provider_refund_id
ai_image              task_id
```

不要对可重试的业务操作使用随机 `source_id`。重试必须命中相同的幂等键。

## 授予流程

正向积分使用 `CreditsService.grant`。

服务写入一个 D1 batch：

```text
如果不存在则插入 credit_balances
  ↓
当 source_type + source_id 是新的时插入 credit_entries
  ↓
增加 credit_balances.balance
  ↓
设置 credit_entries.remaining_amount
  ↓
插入 credit_transactions
```

如果相同的 `source_type + source_id` 已存在，调用返回 `duplicated: true` 且不再授予积分。

允许向负余额授予积分。示例：

```text
授予前余额  = -30 credits
授予金额    = 100 credits
授予后余额  = 70 credits
remaining_amount = 70 credits
```

只有实际的正余额部分才能在之后过期。

## 扣减流程

付费操作应使用以下模式：

```text
确保积分足够
  ↓
运行业务操作
  ↓
成功后扣减积分
```

`CreditsService.runPaidAction` 实现了该模式：

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

如果 `execute` 抛出异常，积分不会被扣减。

`deduct` 按过期顺序消费 `credit_entries.remaining_amount`：

```text
最早过期的条目优先
  -> 然后是不过期的条目
  -> 然后按 created_at
  -> 然后按 id
```

余额扣减本身通过 `source_type + source_id` 实现幂等。重复扣减返回 `duplicated: true`。

这不是硬预留系统。`ensureEnough` 和 `deduct` 是两个独立操作。并发付费操作可能使余额变为负数。这在当前模板中是有意为之，因为它保持了 D1 写入路径的简单性。

## 注册奖励

Better Auth 用户创建时首先创建 tenant 积分余额：

```text
user.create.after
  ↓
打开用户的 tenant shard
  ↓
创建积分余额
  ↓
启用时授予注册积分
```

配置：

```bash
CREDITS_SIGNUP_ENABLED=true
CREDITS_SIGNUP_AMOUNT=100
```

授予使用：

```text
type        signup
sourceType  signup
sourceId    user_id
```

邮箱注册和首次 OAuth 登录共用同一个用户创建 hook。

## 每日签到

每日签到是一次使用基于日期的幂等键的普通授予：

```text
type        daily_checkin
sourceType  daily_checkin
sourceId    user_id:yyyy-mm-dd
```

配置：

```bash
CREDITS_DAILY_CHECKIN_ENABLED=true
CREDITS_DAILY_CHECKIN_AMOUNT=10
```

日期为 UTC。同一 UTC 日的第二次签到返回 `409 DAILY_CHECKIN_ALREADY_DONE`。

如果每日签到被禁用，`POST /api/daily_checkin` 返回空 JSON 响应且不授予积分。

## 兑换码

兑换码存在 Meta DB 中，因为它们是全局库存，不是 tenant 账本状态。

该流程跨越 Meta DB 和 Tenant Shard DB：

```text
在 META_DB 中认领码
  status: unused -> claimed
  claimed_by = user_id
  ↓
在用户的 Tenant Shard DB 中授予积分
  sourceType = redemption_code
  sourceId = credit_redemption_codes.id
  ↓
在 META_DB 中标记码已授予
  status: granted
  granted_at = now
```

如果 Meta 认领成功但 tenant 授予失败，API 返回 `202 CREDIT_GRANT_PENDING`。该码保持被该用户 `claimed` 状态。同一用户重试同一码可以继续完成授予。

码状态值：

| 状态 | 含义 |
| --- | --- |
| `unused` | 可以被认领 |
| `claimed` | 已在 Meta DB 中认领，tenant 授予可能仍在待处理 |
| `granted` | Tenant 授予已完成 |

已过期的码无法被认领。

## 支付积分

支付产品可以通过 `credits_amount` 或 `period_credits_amount` 授予积分。

支付 webhook 成功：

```text
在 META_DB 写入 payment transaction
  ↓
在用户的 Tenant Shard DB 授予积分
  type        payment_purchase
  sourceType  payment_transaction
  sourceId    payment_transactions.id
```

退款 webhook：

```text
在 META_DB 标记 payment transaction 已退款
  ↓
在用户的 Tenant Shard DB 扣减已授予积分
  type        payment_refund
  sourceType  payment_refund
  sourceId    provider:provider_refund_id
```

退款使用 `deduct`，不是负向授予。负向授予不存在。

## 过期与清理

内置 cron：

```bash
CRONS=*/10 * * * *
```

定时任务每 10 分钟运行一次。对每个 tenant shard：

```text
过期最多 20 条 credit_entries
  ↓
删除最多 100 条旧的 credit_transactions
```

过期操作写入一条负向 `expired` 交易并将条目的 `remaining_amount` 设为 `0`。

交易清理使用：

```bash
CREDITS_HISTORY_RETENTION_DAYS=90
```

`credit_entries` 不会被删除。它们保留授予幂等性和过期状态。

## API

用户端点需要已认证的会话和 beta 门控访问权限。

### 获取摘要

```http
POST /api/get_credit_summary
```

响应：

```json
{
  "balance": "100.000000",
  "daily_checked_in": false,
  "daily_checkin_amount": "10.000000"
}
```

### 列出交易

```http
POST /api/list_credit_transactions
```

请求：

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

响应：

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

### 每日签到

```http
POST /api/daily_checkin
```

响应：

```json
{
  "balance": "110.000000",
  "checked_in": true,
  "amount": "10.000000"
}
```

### 兑换码

```http
POST /api/redeem_credit_code
```

请求：

```json
{
  "code": "FREE100"
}
```

响应：

```json
{
  "balance": "200.000000",
  "amount": "100.000000"
}
```

错误：

| 错误码 | 状态 |
| --- | --- |
| `INVALID_CREDIT_CODE` | `400` |
| `CREDIT_CODE_USED` | `409` |
| `CREDIT_GRANT_PENDING` | `202` |

## 管理员 API

管理员端点需要 `adminUserMiddleware`，只接受 `SYSTEM_EMAIL` 超级管理员会话。

在浏览器中生成兑换码或为用户发放积分的流程参阅[管理控制台](admin-console.md)。

### 生成码

```http
POST /api/admin/generate_credit_codes
```

请求：

```json
{
  "count": 10,
  "amount": "100",
  "expires_at": 1767139200000
}
```

`count` 默认为 `1`，最大为 `200`。

### 列出码

```http
POST /api/admin/list_credit_codes
```

请求：

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

响应：

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

### 授予积分

```http
POST /api/admin/grant_credits
```

请求：

```json
{
  "user_id": "user_id",
  "amount": "100",
  "source_id": "manual-2026-001",
  "description": "Manual grant",
  "expires_at": null
}
```

响应：

```json
{
  "balance": "300.000000"
}
```

为 operator 操作使用稳定的 `source_id`。如果 operator 的 source 可能产生碰撞，在其中包含 user id 或 grant id。在同一 tenant shard 中对 `manual_grant` 复用相同 `source_id` 会返回 `409 CREDIT_GRANT_DUPLICATED`。

## 配置

```bash
# 用户创建后授予注册积分
CREDITS_SIGNUP_ENABLED=true
CREDITS_SIGNUP_AMOUNT=100

# 允许已认证用户领取每日奖励
CREDITS_DAILY_CHECKIN_ENABLED=true
CREDITS_DAILY_CHECKIN_AMOUNT=10

# 超过此天数后删除旧的 credit_transactions
CREDITS_HISTORY_RETENTION_DAYS=90

# 过期和清理任务所必需
CRONS=*/10 * * * *
```

金额为积分十进制字符串。`100` 和 `100.000000` 都表示 100 积分。

## 常见错误

**混淆积分单位和支付单位。** `credits_amount` 是积分。`price_amount` 是 provider 的最小货币单位。

**用 `openUserDb` 写入当前用户的积分。** 在已认证用户请求中使用 `ctx.get('tenantDb')`。

**使用随机幂等键。** 重试必须复用相同的 `source_type + source_id`。

**在业务操作成功前扣费。** 使用 `runPaidAction` 或在成功后扣减。

**期望兑换码认领等同于授予完成。** `claimed` 表示 Meta DB 已接受该码。`granted` 表示 Tenant Shard 授予已完成。

**删除 `credit_entries`。** 它们是幂等性和过期状态的一部分。

**忘记配置 cron。** 没有 `CRONS=*/10 * * * *`，积分不会过期，交易清理也不会运行。
