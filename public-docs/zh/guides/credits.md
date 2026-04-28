---
title: 积分系统
description: 积分余额、签到、邀请、兑换码和过期配置
group: 指南
order: 10
---

# 积分系统

OPC Stack 内置积分系统，适合 AI 调用、生成任务、额度赠送等按量计费场景。

## 能力范围

- 查询积分余额
- 查询积分流水
- 注册赠送积分
- 每日签到赠送积分
- 邀请奖励
- 兑换码充值
- 后台补发积分
- 积分过期
- 历史流水清理

## 配置

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

## 核心模型

积分系统使用三类数据：

- `user.credit_balance`：用户当前余额，允许为负数
- `credit_entries`：正向积分批次，记录剩余可过期数量
- `credit_transactions`：积分流水，记录每次余额变化

余额允许为负数。业务扣费流程是：

```text
check balance
  ↓
execute business
  ↓
deduct credits after success
```

业务失败不会扣积分。并发请求可能让余额扣成负数，后续注册赠送、签到、邀请、兑换码或后台补发会先抵消负余额。

## API

### 查询余额

```http
POST /api/get_credit_summary
```

返回：

```json
{
  "balance": 100,
  "daily_checked_in": false,
  "daily_checkin_amount": 10,
  "referral_enabled": true,
  "referral_code": "ABC12345",
  "invited_count": 2
}
```

### 查询流水

```http
POST /api/list_credit_transactions
```

请求：

```json
{
  "limit": 20,
  "offset": 0
}
```

### 每日签到

```http
POST /api/daily_checkin
```

重复签到返回 `409 DAILY_CHECKIN_ALREADY_DONE`。

### 绑定邀请关系

```http
POST /api/bind_referral
```

请求：

```json
{
  "referral_code": "ABC12345"
}
```

一个用户只能绑定一次邀请关系。

### 兑换码充值

```http
POST /api/redeem_credit_code
```

请求：

```json
{
  "code": "FREE100"
}
```

兑换码已使用返回 `409 CREDIT_CODE_USED`，不存在或过期返回 `400 INVALID_CREDIT_CODE`。

### 生成兑换码

```http
POST /api/admin/generate_credit_codes
```

请求：

```json
{
  "count": 10,
  "amount": 100,
  "expires_at": 1767139200000
}
```

该接口需要 `ADMIN_SECRET`。

### 查询兑换码

```http
POST /api/admin/list_credit_codes
```

该接口需要 `ADMIN_SECRET`。

### 后台补发积分

```http
POST /api/admin/grant_credits
```

请求：

```json
{
  "user_id": "user_id",
  "amount": 100,
  "source_id": "manual-2026-001",
  "description": "Manual grant",
  "expires_at": null
}
```

该接口需要 `ADMIN_SECRET`。`source_id` 用于保证同一次补发不会重复入账。

## 注册赠送

注册赠送接在 Better Auth 的用户创建流程里：

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

邮箱注册和 Google 首次登录都会走同一套用户创建逻辑。

## 每日签到去重

签到记录写入 `credit_transactions`，并使用 `source_type=daily_checkin` 和 `source_id=user_id:yyyy-mm-dd` 做幂等约束。

同一天重复签到不会再次发放积分。

## 兑换码去重

兑换码兑换不依赖“先查再写”的两步判断。核心写入放在同一个 D1 `batch()` 中，并用 SQL 条件插入表达“兑换码可用才入账”：

```sql
INSERT OR IGNORE INTO credit_entries (...)
SELECT ...
FROM credit_redemption_codes
WHERE code = ?
  AND used_by IS NULL
  AND (expires_at IS NULL OR expires_at > ?)
```

后续更新用户余额、标记兑换码已使用、写流水时，都用 `WHERE EXISTS` 判断本次入账记录是否存在。

D1 不支持传统事务，积分核心写入必须使用 `batch()` 保证同一批 D1 写入原子执行。

## 积分过期

Cron 每 10 分钟执行一次：

```bash
CRONS=*/10 * * * *
```

每次固定处理 20 条过期的 `credit_entries`：

```text
find 20 expired entries
  ↓
deduct user.credit_balance
  ↓
insert expired transactions
  ↓
set credit_entries.remaining_amount = 0
```

`credit_entries` 不删除，因为它承担发放来源幂等约束。历史 `credit_transactions` 会按 `CREDITS_HISTORY_RETENTION_DAYS` 定期清理。

