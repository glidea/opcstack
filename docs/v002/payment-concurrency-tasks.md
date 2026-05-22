！！！每完成一个任务并且验证通过之后就commit一下！！固定提醒

# 支付并发一致性任务拆分

## 执行顺序

1. `Task-001` 先收紧 webhook 完成标记语义
2. `Task-002` 先确认积分原子增减和 source 幂等
3. `Task-003` 到 `Task-006` 分事件类型修复支付业务状态推进
4. `Task-007` 检查 provider adapter 的事件字段契约
5. `Task-008` 做整体验收和文档同步

## 统一完成标准

1. 每个任务内部先写失败测试，再写刚好通过的生产代码
2. 任务内 `TODO 清单` 全部打勾
3. 任务内 `验收测试步骤` 全部通过
4. 运行 `pnpm test` 通过
5. 提交一次独立 commit

# Task-001: 收紧 Webhook 完成标记语义

## 描述
把 `payment_webhook_events` 明确为“业务完整处理成功”的标记。字段缺失、业务资源缺失、处理失败时不能写入 webhook event。

## 不包含
- 不改具体支付成功、退款、订阅业务规则
- 不改 provider adapter
- 不改数据库结构

## TODO 清单
- [x] 1. 在 `src/payment/index.test.ts` 增加字段缺失时不写 webhook event 的失败测试
- [x] 2. 在 `src/payment/index.test.ts` 增加业务处理抛错时不写 webhook event 的失败测试
- [x] 3. 调整 `PaymentService.processWebhook` 或事件处理返回值，让 ignored 事件不会伪装成 processed
- [x] 4. 保留已完成 webhook event 重复投递直接跳过的行为
- [x] 5. 确认日志只记录 ignored 原因，不吞掉内部错误

## 验收测试步骤
1. [x] 运行 `pnpm test -- src/payment/index.test.ts`
2. [x] 缺少 `providerPaymentId` 的权益事件不写 `payment_webhook_events`
3. [x] 业务处理抛错时不写 `payment_webhook_events`
4. [x] 已存在 `payment_webhook_events` 的重复投递不再执行业务逻辑

# Task-002: 确认积分发放和扣回的原子幂等

## 描述
确认 `CreditsService.grant` 和 `CreditsService.deduct` 都以 source 为幂等键，并用 SQL 算术更新 `user.credit_balance`。支付业务后续只能依赖这个接口，不能自己读余额再写余额。

## 不包含
- 不改支付事件处理流程
- 不改积分消费策略
- 不新增积分表

## TODO 清单
- [x] 1. 在 `src/credits/index.test.ts` 增加不同 source 连续发放后余额累加的测试
- [x] 2. 在 `src/credits/index.test.ts` 增加相同 source 重复发放不重复加余额的测试
- [x] 3. 在 `src/credits/index.test.ts` 增加相同 refund source 重复扣回不重复减余额的测试
- [x] 4. 检查 `grant` 使用 `credit_balance = credit_balance + amount`
- [x] 5. 检查 `deduct` 使用 `credit_balance = credit_balance - amount`

## 验收测试步骤
1. [x] 运行 `pnpm test -- src/credits/index.test.ts`
2. [x] 两个不同 payment source 都能发放成功
3. [x] 同一个 payment source 重试不会重复发放
4. [x] 同一个 refund source 重试不会重复扣回

# Task-003: 修复一次性积分包购买重试

## 描述
一次性积分包购买必须按目标状态推进：paid transaction、credit grant、checkout completed、webhook event。重试时即使 transaction 已存在，也必须继续补齐积分和 checkout。

## 不包含
- 不处理订阅初购
- 不处理订阅续费
- 不处理退款
- 不改 checkout 创建流程

## TODO 清单
- [x] 1. 在 `src/payment/index.test.ts` 增加半完成购买重试测试
- [x] 2. 测试覆盖 transaction 已存在、credit grant 缺失、checkout pending
- [x] 3. 调整 `applyCreditsPurchase`，transaction 已存在时继续调用积分发放
- [x] 4. 调整 `applyCreditsPurchase`，积分发放成功后再完成 checkout
- [x] 5. 确认 `payment_webhook_events` 最后写入

## 验收测试步骤
1. [x] 运行 `pnpm test -- src/payment/index.test.ts`
2. [x] 半完成购买重试后 checkout 变为 `completed`
3. [x] 积分只按 `payment_transaction` source 发放一次
4. [x] webhook event 只在 checkout completed 后写入

# Task-004: 修复订阅初购和续费重试

## 描述
订阅初购和续费必须依赖 `providerPaymentId` 记录每次钱流动，并用 transaction id 作为积分 source。续费不能用本地周期时间拼幂等键。

## 不包含
- 不处理订阅升级
- 不处理订阅取消
- 不处理支付失败

## TODO 清单
- [x] 1. 在 `src/payment/index.test.ts` 增加订阅初购半完成重试测试
- [x] 2. 在 `src/payment/index.test.ts` 增加订阅续费重复 webhook 测试
- [x] 3. 确认缺少 `providerPaymentId` 的续费不会发积分，也不会写 webhook event
- [x] 4. 调整 `applySubscriptionInitial`，transaction 已存在时继续补齐 subscription、grant、checkout
- [x] 5. 调整 `applySubscriptionRenewal`，transaction 已存在时继续补齐 grant 和 subscription period

## 验收测试步骤
1. [x] 运行 `pnpm test -- src/payment/index.test.ts`
2. [x] 初购半完成重试后 subscription active、checkout completed、积分已发放
3. [x] 续费重复投递只产生一条 payment transaction 和一次积分 source
4. [x] 缺少 `providerPaymentId` 的续费不发权益

# Task-005: 修复订阅升级重试

## 描述
订阅升级必须按 target plan 推进，并只在 credits diff 大于 0 时发放差额积分。upgrade checkout 已经完成不能成为重复发权益的依据，幂等仍然看 payment transaction 和 credit source。

## 不包含
- 不处理初购和续费
- 不改升级 API 的 checkout 创建逻辑
- 不处理退款

## TODO 清单
- [ ] 1. 在 `src/payment/index.test.ts` 增加升级半完成重试测试
- [ ] 2. 在 `src/payment/index.test.ts` 增加 credits diff 为 0 时不调用积分发放的测试
- [ ] 3. 调整 `applySubscriptionUpgrade`，transaction 已存在时继续补齐 subscription 和 checkout
- [ ] 4. 确认 checkout completed 后重复 webhook 不会重复发放积分
- [ ] 5. 确认 webhook event 最后写入

## 验收测试步骤
1. 运行 `pnpm test -- src/payment/index.test.ts`
2. 升级半完成重试后用户订阅变为目标 plan
3. 差额积分只发放一次
4. credits diff 为 0 时不调用 `CreditsService.grant`

# Task-006: 修复退款、争议和支付失败状态推进

## 描述
退款必须以 `providerRefundId` 和 `creditsReversedAt` 判断扣回是否完成。争议只改支付流水状态。支付失败只能让 pending checkout 失败，不能覆盖已经成功的订单。

## 不包含
- 不处理积分包购买成功
- 不处理订阅成功
- 不改 provider adapter

## TODO 清单
- [ ] 1. 在 `src/payment/index.test.ts` 增加半完成退款重试测试
- [ ] 2. 在 `src/payment/index.test.ts` 增加相同退款重复投递不重复扣积分的测试
- [ ] 3. 在 `src/payment/index.test.ts` 增加支付失败不覆盖 completed checkout 的测试
- [ ] 4. 调整 `handleRefundSucceeded`，`creditsReversedAt` 不为空才跳过扣回
- [ ] 5. 调整 `handlePaymentFailed`，只更新 pending checkout
- [ ] 6. 确认争议事件只设置 disputed 状态和 dispute id

## 验收测试步骤
1. 运行 `pnpm test -- src/payment/index.test.ts`
2. 半完成退款重试后 `creditsReversedAt` 被设置
3. 同一 `providerRefundId` 不会重复扣余额
4. completed checkout 收到失败事件后仍为 `completed`

# Task-007: 校验 Provider 事件字段契约

## 描述
Dodo 和 Creem adapter 必须把 provider 原始事件转换成统一 `PaymentEvent`，并尽量带上业务必需字段。业务层不应该 import provider 原始类型。

## 不包含
- 不改支付业务状态推进
- 不改数据库
- 不调用真实 provider API

## TODO 清单
- [ ] 1. 在 `src/payment/dodo.test.ts` 覆盖支付成功、订阅付款、退款、争议事件字段
- [ ] 2. 在 `src/payment/creem.test.ts` 覆盖支付成功、订阅付款、退款、争议事件字段
- [ ] 3. 确认 `providerPaymentId`、`providerRefundId`、`providerDisputeId` 映射正确
- [ ] 4. 确认 adapter 不写业务状态
- [ ] 5. 确认 `PaymentService` 只依赖 `PaymentEvent`

## 验收测试步骤
1. 运行 `pnpm test -- src/payment/dodo.test.ts src/payment/creem.test.ts`
2. Dodo webhook 原始事件能转换为统一事件
3. Creem webhook 原始事件能转换为统一事件
4. 业务层没有 provider SDK 类型泄漏

# Task-008: 支付并发一致性整体验收

## 描述
把设计文档中的验收场景全部落到自动化测试或人工验收清单。最后同步项目文档，确保后续开发不会把 webhook event 当业务幂等锁。

## 不包含
- 不新增支付产品能力
- 不接入新的 payment provider
- 不做前端页面调整

## TODO 清单
- [ ] 1. 在 `e2e/payment.test.ts` 增加 webhook 重试恢复的可控边界测试
- [ ] 2. 汇总并确认 `docs/v002/payment-concurrency-design.md` 的 5.x 场景都有覆盖
- [ ] 3. 运行全量 `pnpm test`
- [ ] 4. 需要 HTTP 边界时运行 `pnpm test:e2e`
- [ ] 5. 如实现规则形成新约定，同步更新 `AGENTS.md`

## 验收测试步骤
1. 运行 `pnpm test`
2. 运行 `pnpm test:e2e`
3. 半完成购买、半完成退款、重复续费 webhook 都有测试覆盖
4. `AGENTS.md` 和设计文档没有互相矛盾的支付规则
