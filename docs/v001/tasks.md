！！！每完成一个任务并且验证通过之后就commit一下！！固定提醒

# Task-001: 积分数据模型

## 描述
增加积分系统需要的数据库结构。这个任务只处理 Drizzle schema 和迁移文件，让后续核心逻辑有稳定的数据基础。

## 不包含
- 不实现积分发放逻辑
- 不实现 HTTP 接口
- 不接入 Better Auth hook
- 不实现 Cron

## TODO 清单
- [x] 1. 在 `src/db/schema.ts` 给 `user` 表增加 `referral_code` 和 `credit_balance`
- [x] 2. 新增 `credit_entries` 表
- [x] 3. 新增 `credit_transactions` 表
- [x] 4. 新增 `credit_referrals` 表
- [x] 5. 新增 `credit_redemption_codes` 表
- [x] 6. 生成并检查迁移文件

## 验收测试步骤
1. 运行 `pnpm dev` 触发迁移生成和应用
2. 检查生成 SQL 包含唯一约束 `credit_entries(source_type, source_id)`
3. 运行 `pnpm test`

！！！每完成一个任务并且验证通过之后就commit一下！！固定提醒

# Task-002: 核心发放函数

## 描述
实现 `src/credits/index.ts` 的 `grantCredits`。它负责所有正向积分入账，包括注册赠送、签到、邀请奖励、兑换码和后台补发。

## 不包含
- 不实现具体业务入口
- 不读取环境变量
- 不处理 HTTP 响应
- 不生成邀请码

## TODO 清单
- [x] 1. 新增 `src/credits/index.ts`
- [x] 2. 定义 `CreditTransactionType` 和 `GrantCreditsInput`
- [x] 3. 编写 `grantCredits` 单元测试
- [x] 4. 使用 D1 `batch()` 同时更新 `user.credit_balance`、写入 `credit_entries`、写入 `credit_transactions`
- [x] 5. 支持负余额先抵债
- [x] 6. 通过 `source_type + source_id` 保证幂等

## 验收测试步骤
1. 运行 `pnpm test -- src/credits/index.test.ts`
2. 验证正常发放后余额增加并写入流水
3. 验证负余额用户发放时先抵债
4. 验证相同 `source_type + source_id` 不会重复发放

！！！每完成一个任务并且验证通过之后就commit一下！！固定提醒

# Task-003: 注册邀请码与注册赠送

## 描述
接入 Better Auth 的 user create hook。新用户创建前生成 `referral_code`，新用户创建后按配置发放注册积分。

## 不包含
- 不实现邀请绑定
- 不实现每日签到
- 不实现积分查询接口
- 不处理 OAuth 之外的自定义注册流程

## TODO 清单
- [x] 1. 在 `src/api/auth/index.ts` 接入 `user.create.before`
- [x] 2. 实现 `createReferralCode()` 并写入用户表
- [x] 3. 在 `user.create.after` 按 `CREDITS_SIGNUP_ENABLED` 调用 `grantCredits`
- [x] 4. 使用 `source_type=signup` 和 `source_id=user_id`
- [x] 5. 在 `POST /api/get_public_config` 增加注册和邀请相关配置字段

## 验收测试步骤
1. 使用邮箱注册新用户
2. 使用 Google 首次登录创建新用户
3. 验证两个路径创建出的用户都有 `referral_code`
4. 开启 `CREDITS_SIGNUP_ENABLED` 后验证新用户获得注册积分

！！！每完成一个任务并且验证通过之后就commit一下！！固定提醒

# Task-004: 积分概览和流水查询

## 描述
实现用户查看积分余额和流水列表的接口。接口只做查询和响应格式转换，不写积分规则。

## 不包含
- 不实现签到
- 不实现邀请绑定
- 不实现兑换码
- 不返回 `referral_url`
- 不返回 `expiring_credits`

## TODO 清单
- [x] 1. 实现 `getCreditSummary`
- [x] 2. 实现 `listCreditTransactions`
- [x] 3. 新增 `getCreditSummaryHandler`
- [x] 4. 新增 `listCreditTransactionsHandler`
- [x] 5. 注册 `/api/get_credit_summary` 和 `/api/list_credit_transactions`
- [x] 6. 补充 handler 测试

## 验收测试步骤
1. 调用 `POST /api/get_credit_summary`
2. 验证响应只包含余额、签到状态、签到金额、邀请开关、邀请码、已邀请人数
3. 调用 `POST /api/list_credit_transactions`
4. 验证流水按创建时间倒序返回

！！！每完成一个任务并且验证通过之后就commit一下！！固定提醒

# Task-005: 每日签到

## 描述
实现每日签到发放积分。重复签到靠 `source_type=daily_checkin` 和 `source_id=user_id:yyyy-mm-dd` 幂等约束处理。

## 不包含
- 不实现用户时区签到
- 不实现连续签到奖励
- 不实现补签
- 不修改注册赠送逻辑

## TODO 清单
- [x] 1. 实现 `dailyCheckin(userId)`
- [x] 2. 使用 UTC 日期生成 `source_id`
- [x] 3. 通过 `grantCredits` 发放签到积分
- [x] 4. 新增 `dailyCheckinHandler`
- [x] 5. 注册 `/api/daily_checkin`
- [x] 6. 补充重复签到测试

## 验收测试步骤
1. 开启 `CREDITS_DAILY_CHECKIN_ENABLED`
2. 调用 `POST /api/daily_checkin` 后余额增加
3. 同一天再次调用返回 `DAILY_CHECKIN_ALREADY_DONE`
4. 调用 `POST /api/get_credit_summary` 后 `daily_checked_in=true`

！！！每完成一个任务并且验证通过之后就commit一下！！固定提醒

# Task-006: 邀请绑定

## 描述
实现用户输入邀请码后绑定邀请关系。绑定成功后给邀请人和被邀请人发积分，邀请关系和两笔发放必须在同一个 D1 `batch()` 中完成。

## 不包含
- 不实现注册时自动绑定邀请码
- 不返回邀请奖励金额
- 不允许自邀请
- 不允许重复绑定

## TODO 清单
- [x] 1. 实现 `bindReferral(inviteeUserId, referralCode)`
- [x] 2. 插入 `credit_referrals`
- [x] 3. 给邀请人发 `referral_inviter` 积分
- [x] 4. 给被邀请人发 `referral_invitee` 积分
- [x] 5. 新增 `bindReferralHandler`
- [x] 6. 注册 `/api/bind_referral`

## 验收测试步骤
1. 用户 B 调用 `/api/bind_referral` 绑定用户 A 的邀请码
2. 验证用户 A 和用户 B 的余额都增加
3. 用户 B 再次绑定返回 `REFERRAL_ALREADY_BOUND`
4. 用户绑定自己的邀请码返回 `INVALID_REFERRAL_CODE`

！！！每完成一个任务并且验证通过之后就commit一下！！固定提醒

# Task-007: 兑换码管理和兑换

## 描述
实现后台生成兑换码、后台查询兑换码和用户兑换码充值。兑换时使用 D1 `batch()` 配合 `INSERT ... SELECT ... WHERE` 抢占兑换码。

## 不包含
- 不实现支付入账
- 不实现兑换码批量导入
- 不实现兑换码删除
- 不实现多次兑换同一个码

## TODO 清单
- [x] 1. 实现 `generateCreditCodes`
- [x] 2. 实现 `listCreditCodes`
- [x] 3. 实现 `redeemCreditCode`
- [x] 4. 兑换时用 `source_type=redemption_code` 和 `source_id=credit_redemption_codes.id`
- [x] 5. 新增三个 handler
- [x] 6. 注册 `/api/admin/generate_credit_codes`、`/api/admin/list_credit_codes`、`/api/redeem_credit_code`

## 验收测试步骤
1. 管理员生成 10 个兑换码
2. 管理员查询兑换码列表能看到未使用状态
3. 用户兑换有效兑换码后余额增加
4. 同一个兑换码再次兑换返回 `CREDIT_CODE_USED`
5. 过期兑换码返回 `INVALID_CREDIT_CODE`

！！！每完成一个任务并且验证通过之后就commit一下！！固定提醒

# Task-008: 后台补发积分

## 描述
实现 `POST /api/admin/grant_credits`。这个接口只用于特殊情况下后台补发，不用于支付入账，也不接外部支付回调。

## 不包含
- 不实现支付系统
- 不实现审批流
- 不实现后台 UI
- 不允许缺少 `source_id` 的补发

## TODO 清单
- [x] 1. 新增 `grantCreditsHandler`
- [x] 2. 校验 `user_id`、`amount`、`source_id`、`description`、`expires_at`
- [x] 3. 调用 `grantCredits` 并设置 `type=manual_grant`
- [x] 4. 设置 `source_type=manual_grant`
- [x] 5. 注册 `/api/admin/grant_credits`
- [x] 6. 补充重复 `source_id` 返回 `CREDIT_GRANT_DUPLICATED` 的测试

## 验收测试步骤
1. 管理员调用 `/api/admin/grant_credits` 给用户补发积分
2. 验证用户余额增加
3. 验证流水类型为 `manual_grant`
4. 使用同一个 `source_id` 再次请求返回 `CREDIT_GRANT_DUPLICATED`

！！！每完成一个任务并且验证通过之后就commit一下！！固定提醒

# Task-009: 业务扣减能力

## 描述
实现业务发起前检查和业务成功后扣减。扣减时允许余额变成负数，失败业务不扣分。

## 不包含
- 不实现积分冻结
- 不实现退款补偿
- 不把业务调用放进 D1 `batch()`
- 不为具体 AI 业务改造接口

## TODO 清单
- [x] 1. 实现 `ensureEnoughCredits`
- [x] 2. 实现 `deductCredits`
- [x] 3. 扣减 `credit_entries` 时优先扣快过期积分
- [x] 4. 使用 D1 `batch()` 同时更新余额、更新 entries、写入负数流水
- [x] 5. 编写一个最小调用示例或测试 helper 展示 `ensure -> business -> deduct` 顺序

## 验收测试步骤
1. 余额不足时 `ensureEnoughCredits` 返回 `INSUFFICIENT_CREDITS`
2. 余额充足时模拟业务成功后调用 `deductCredits`
3. 验证余额可以扣成负数
4. 验证业务失败路径没有写入扣减流水

！！！每完成一个任务并且验证通过之后就commit一下！！固定提醒

# Task-010: 积分过期和最终验收

## 描述
实现积分过期 Cron 和历史流水清理。Cron 每 10 分钟执行一次，每次固定处理 20 条过期 entry，不在单次 Cron 内循环追赶历史数据。

## 不包含
- 不做动态批大小配置
- 不做手动补偿任务
- 不做复杂监控面板
- 不删除 `credit_entries`

## TODO 清单
- [x] 1. 实现 `expireCredits(now, limit=20)`
- [x] 2. 过期后写入 `expired` 流水并把 `remaining_amount` 置 0
- [x] 3. 实现 `cleanupCreditTransactions`
- [x] 4. 在 `src/jobs/index.ts` 接入过期任务和清理任务
- [x] 5. 确认 `CRONS` 包含 `*/10 * * * *`
- [x] 6. 补齐 E2E 验收场景并跑通全量测试

## 验收测试步骤
1. 准备 21 条已过期且 `remaining_amount > 0` 的 entry
2. 触发一次 Cron 后只处理 20 条
3. 验证用户余额被扣减并写入 `expired` 流水
4. 验证第 21 条留到下一轮 Cron
5. 运行 `pnpm test`
