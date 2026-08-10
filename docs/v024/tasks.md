！！！每完成一个任务并且验证通过之后就commit一下！！固定提醒

# Task-001: 建立渠道 ENV 配置契约

## 描述
先用测试定义渠道前缀发现、评分权重和任务保留期的配置规则，再修改 Cloudflare 准备流程。这个提交只让配置可被严格校验并进入 Worker Env，不接入运行时路由。

## 不包含
- Channel Router 和 D1 指标
- Consumer 与 Provider 行为变更
- 读取或修改真实 secret env

## TODO 清单
- [x] 1. 在 `scripts/prepare-cloudflare.test.mjs` 增加渠道发现、字段完整性、权重、价格系数、默认模型覆盖和动态 secret 校验的失败测试
- [x] 2. 修改 `scripts/prepare-cloudflare.mjs` 与 `wrangler.jsonc.tpl`，将固定权重和保留期、动态渠道 public 字段及动态 API key 写入生成配置
- [x] 3. 在 `.env.dev`、`.env.prod` 为现有异步 provider 增加初始渠道组，在 `.env.secret.example` 增加对应密钥占位和完整注释
- [x] 4. 更新 `template-docs/guides/ai.md` 的渠道 ENV 契约
- [ ] 5. 用户在真实 secret env 中补齐新增的渠道密钥，Agent 不读取密钥内容

## 验收测试步骤
1. 运行 `pnpm exec vitest run scripts/prepare-cloudflare.test.mjs`
2. 确认合法渠道进入生成的 vars 与 required secrets，缺字段、非法价格、全零权重和默认模型无渠道时测试失败
3. 用户补齐真实渠道密钥后运行 `pnpm prepare:cloudflare:dev`，确认准备流程成功并生成动态渠道配置

# Task-002: 新增渠道指标与任务执行字段

## 描述
为 Tenant Shard 增加 1 分钟渠道指标桶，并为三类 AI 任务增加设计中确认的执行字段和清理索引。该提交只建立持久化能力，不改变现有任务执行流程。

## 不包含
- Router 查询和评分
- Consumer 指标写入
- Cron 数据清理

## TODO 清单
- [x] 1. 扩展 `src/backend/db/schema.shard.test.ts`，写出指标表主键、清理索引和三张任务表新增字段及索引的失败测试
- [x] 2. 修改 `src/backend/db/schema.shard.ts`，新增 `ai_channel_metric_buckets`、任务 channel 字段、Video 执行字段和 `(status, updated_at)` 索引
- [x] 3. 生成 Tenant Shard migration，并检查只包含本任务的数据结构变更
- [x] 4. 确认任务创建函数无需传入 channel，新增字段依靠 nullable 或数据库默认值

## 验收测试步骤
1. 运行 `pnpm exec vitest run src/backend/db/schema.shard.test.ts src/backend/ai/image/task.test.ts src/backend/ai/tts/task.test.ts src/backend/ai/video/task.test.ts`
2. 确认新任务创建后 channel 为空，Video 的 `failed_channels_json` 为 `[]`
3. 对空 Tenant Shard 应用 migration，确认新表、联合主键和索引均存在

# Task-003: 实现 Channel Router

## 描述
实现独立的 Channel Router，负责从 Env 解析渠道、查询当前 Tenant Shard 最近一小时指标并稳定排序。指标 UPSERT query 也放在该模块，Consumer 只负责编排和批量提交。

## 不包含
- 上游 Provider 调用
- Consumer 状态机修改
- 跨 Shard 聚合、缓存、熔断和随机探索

## TODO 清单
- [x] 1. 创建 `src/backend/ai/channel-routing.test.ts`，覆盖候选过滤、5m/1h 70/30 聚合、全冷启动 `0.5`、归一化、权重和稳定平局
- [x] 2. 在同一测试中覆盖排除渠道、无基础候选报错以及成功和失败分钟桶 UPSERT
- [x] 3. 创建 `src/backend/ai/channel-routing.ts`，实现已确认的导出类型、`rankAIChannels`、`resolveAIChannel` 和 `createAIChannelMetricQuery`
- [x] 4. 在现有 `AIError` 中增加 `AI_CHANNEL_NOT_FOUND` 与 `AI_CHANNEL_CONFIG_INVALID`，不新增错误基类
- [x] 5. 更新 `template-docs/guides/ai.md`，说明 Router 边界、评分公式、Shard 局部指标和分钟桶

## 验收测试步骤
1. 运行 `pnpm exec vitest run src/backend/ai/channel-routing.test.ts`
2. 使用设计验收数据确认 `OFFICIAL score=33.3`、`RESELLER_A score=17.0` 且 OFFICIAL 排在第一
3. 删除所有匹配模型的渠道后确认返回 `AI_CHANNEL_NOT_FOUND`，只排除现有候选时确认返回空数组

# Task-004: Provider 支持精确 Endpoint

## 描述
让现有 Image、TTS 和 SeedDance Provider 可以接受 Router 选中的单个 `AIEndpoint`。未传 endpoint 的同步调用使用当前 provider 主 endpoint，异步路径传入 endpoint 后只请求该 endpoint。

## 不包含
- Consumer 调用 Router
- channel、分数或指标进入 Provider
- 修改同步调用的外部行为

## TODO 清单
- [x] 1. 扩展各 Image 与 TTS Provider 测试，证明传入 endpoint 时只请求该地址
- [x] 2. 为 `AISimpleImageClientOptions` 与 `AISimpleTTSClientOptions` 增加 `endpoint?: AIEndpoint`，在各 Provider 内显式选择单 endpoint
- [x] 3. 扩展 SeedDance 测试，让创建和查询远程任务的函数接受明确 endpoint
- [x] 4. 保持任务创建 API、Simple Client 方法和 Chat、Realtime 代码不变

## 验收测试步骤
1. 运行 `pnpm exec vitest run src/backend/ai/image src/backend/ai/tts src/backend/ai/video/seedance/index.test.ts`
2. 给 Provider 传入测试 endpoint，确认请求只触达该地址
3. 不传 endpoint，确认同步调用使用当前 provider 主 endpoint

# Task-005: Image 异步任务接入渠道路由

## 描述
完成第一个可端到端验收的智能路由垂直切片。Image Consumer 在执行时评分、按顺序尝试渠道，并用一个 D1 batch 提交任务终态和本次所有渠道指标。

## 不包含
- TTS 与 Video Consumer
- 同步 Image `generate`
- 修改 Queue payload 或任务 HTTP API

## TODO 清单
- [x] 1. 先扩展 `src/backend/consumers/ai-image.test.ts`，写出高分优先、首选失败后次选成功、全部失败重试和非上游错误不计指标的失败测试
- [x] 2. 在 `src/backend/consumers/ai-image.ts` 调用 Router，并向 Provider 传入排序结果中的 endpoint
- [x] 3. 使用 `createAIChannelMetricQuery` 与任务更新构造同一个 `runRawD1Batch`，成功任务记录实际 channel
- [x] 4. 结构化错误日志增加 channel，保持现有最大尝试次数和 Queue ack/retry 规则

## 验收测试步骤
1. 运行 `pnpm exec vitest run src/backend/consumers/ai-image.test.ts src/backend/ai/channel-routing.test.ts`
2. 配置两个同 provider/model 渠道，确认 Consumer 首先请求高分渠道
3. 让首选渠道失败，确认同一次消费使用次选渠道完成，任务记录次选 channel，两个分钟桶分别增加 error 和 success

# Task-006: TTS 异步任务接入渠道路由

## 描述
将 Image 已验证的路由边界接入 TTS Consumer，同时覆盖普通语音和 Seed source/podcast 两条现有路径。TTS 只复用 Router 与指标 query，不抽取跨 Consumer 编排基类。

## 不包含
- Video 状态机
- 同步 TTS 调用
- 改变 Gemini 与 Seed 的输入能力约束

## TODO 清单
- [x] 1. 先扩展 `src/backend/consumers/ai-tts.test.ts`，覆盖高分优先、渠道故障转移、source 任务和全部失败重试
- [x] 2. 在 `src/backend/consumers/ai-tts.ts` 调用 Router，并向对应 Provider 传入唯一 endpoint
- [x] 3. 使用一个 D1 batch 写任务终态、实际 channel 和本次分钟桶增量
- [x] 4. 保持现有 TTS 任务 API、Queue payload、最大尝试次数和模型能力校验不变

## 验收测试步骤
1. 运行 `pnpm exec vitest run src/backend/consumers/ai-tts.test.ts src/backend/ai/tts`
2. 分别执行普通 TTS 与 source 任务测试，确认都按同 provider/model 候选池选路
3. 让首选渠道失败，确认次选成功且任务、指标和 Queue ack 状态一次提交完成

# Task-007: Video 异步任务接入渠道路由

## 描述
为 Video Consumer 实现“创建新远程任务时动态路由，已有远程任务时沿原渠道轮询”的状态机。只有上游明确返回终态 failed 才清除远程执行字段，并在下一次消费选择未失败渠道。

## 不包含
- 轮询网络错误时切换渠道
- 渠道配置被删除时的特殊恢复
- 修改视频 R2 下载与流式上传方式

## TODO 清单
- [x] 1. 先扩展 `src/backend/consumers/ai-video.test.ts`，覆盖首次动态路由、已有 `provider_task_id` 不调用 Router、运行中重试和完成指标
- [x] 2. 增加明确终态失败测试，证明同一 batch 写错误桶、追加 failed channel 并清空 `channel + channel_started_at + provider_task_id`
- [x] 3. 在 `src/backend/consumers/ai-video.ts` 接入 `rankAIChannels` 与 `resolveAIChannel`，创建远程任务成功后持久化实际执行字段
- [x] 4. 下一次消费排除 `failed_channels_json` 中的渠道，没有剩余渠道或达到最大尝试次数时结束本地任务
- [x] 5. 更新 `template-docs/guides/ai.md`，明确 channel 只是已创建远程任务的查询地址，不是任务创建输入

## 验收测试步骤
1. 运行 `pnpm exec vitest run src/backend/consumers/ai-video.test.ts src/backend/ai/video/seedance/index.test.ts`
2. 让远程任务连续返回 running、running、completed，确认三次查询始终使用创建该任务的同一渠道且 Router 只调用一次
3. 让远程任务明确 failed，确认下一次消费动态选择其他渠道；让轮询网络报错，确认不清空远程执行字段

# Task-008: 清理渠道指标与历史 AI 任务

## 描述
复用现有每 10 分钟 Scheduled Job，清理每个 Tenant Shard 中 24 小时前的渠道指标和超过配置保留期的终态 AI 任务。业务层不读取 `result_json`，也不访问或删除 R2 对象。

## 不包含
- 清理 processing 任务
- R2 Lifecycle 配置或对象删除
- 新增 Cron、Queue 或独立清理服务

## TODO 清单
- [x] 1. 先扩展 `src/backend/jobs/index.test.ts`，覆盖指标截止时间、三张任务表、终态过滤、processing 保留和多 Shard 遍历
- [x] 2. 在 `src/backend/jobs/index.ts` 读取严格校验后的 `AI_TASK_RETENTION_DAYS`，执行索引条件 DELETE
- [x] 3. 保持指标保留期固定 24 小时，不增加额外 ENV 或运行时默认值
- [x] 4. 更新 `template-docs/guides/queues-cron.md` 与 `template-docs/guides/ai.md` 的保留和清理规则

## 验收测试步骤
1. 运行 `pnpm exec vitest run src/backend/jobs/index.test.ts`
2. 构造截止时间前后的 completed、failed、processing 记录，确认只删除过期终态记录和 24 小时前指标
3. 确认测试中没有 R2 调用，Cron 名称仍为现有 `*/10 * * * *`

# Task-009: 完成全量验收与项目文档

## 描述
对完整智能路由链路执行配置生成、类型检查、全量单测和现有 E2E。最后更新项目级架构说明，确保代码、技术设计和 Agent 开发指南使用同一套 channel 术语与边界。

## 不包含
- 新增功能、兼容层或性能优化
- 管理 API、管理页面和全局指标
- 同步 Image/TTS、Chat 或 Realtime 路由

## TODO 清单
- [ ] 1. 更新 `AGENTS.md` 的 AI、Database、Queues 与 Runtime Config 规则，记录 Channel Router、分钟桶和任务清理机制
- [ ] 2. 检查 `template-docs/`、`.env.secret.example`、Schema 和实现命名一致，删除实现过程中残留的旧方案或临时代码
- [ ] 3. 用户确认真实 secret env 已包含全部渠道密钥后，重新生成 Cloudflare config 与 `Env` 类型
- [ ] 4. 运行全量测试并按技术设计 5.2 完成 Image 故障转移、Video 固定轮询渠道和 Cron 清理验收
- [ ] 5. 确认每个前置任务均已有独立提交，再提交本任务的文档与最终回归修正

## 验收测试步骤
1. 运行 `pnpm prepare:cloudflare:dev`，再运行 `pnpm exec wrangler types --config .wrangler/wrangler.types.jsonc --env-file .wrangler/runtime-secrets.env --strict-vars false`
2. 运行 `pnpm test` 与 `pnpm test:e2e`，确认全部通过
3. 按 `docs/v024/tech-design.md` 5.2 验证确定评分、同次故障转移、分钟聚合、Video 原渠道轮询和无 R2 业务删除
