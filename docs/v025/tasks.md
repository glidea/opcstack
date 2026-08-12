！！！每完成一个任务并且验证通过之后就commit一下！！固定提醒

# Task-001: 建立 D1 配置存储与加密内核

## 描述
在 Meta D1 建立 `system_settings`、`payment_products`、`ai_channels` 及通用 OAuth API Access 数据表。实现按业务域读取、版本化原子更新和 AES-GCM 密钥加解密，为后续业务迁移提供唯一配置内核。

## 不包含
- 不迁移任何现有业务模块的 ENV 读取
- 不实现配置 Admin API 和管理后台页面

## TODO 清单
- [x] 1. 先增加初始化、业务域快照、版本冲突、密钥加解密和密钥完整性失败的测试并确认失败
- [x] 2. 按技术设计修改 Meta Schema，生成并检查 D1 Migration
- [x] 3. 实现结构化配置存储、请求内快照、乐观锁更新和 AES-GCM SecretMutation
- [x] 4. 在初始化流程写入明确的禁用配置、内置 AI Provider 和 `opc-cli` Public Client
- [x] 5. 更新 `CONFIG_ENCRYPTION_KEY` 固定 ENV 契约、生成类型和相关架构文档

## 验收测试步骤
1. 启动本地环境并应用 Meta Migration，确认所有配置表和初始化记录存在
2. 运行配置内核测试，确认同一业务域读写、版本递增和过期版本冲突均符合设计
3. 替换一个敏感值后检查 D1 只保存不同 IV 的密文，错误根密钥读取时明确失败且不泄露敏感内容

# Task-002: 迁移 General 与 Storage 配置

## 描述
实现 General、Storage 配置契约和 Admin API，并将 Web 首屏、文档入口、设计系统和 R2 上传限制切换到 D1。切换完成后删除这些配置的 ENV 定义、生成字段和运行时读取。

## 不包含
- 不实现后台配置页面
- 不迁移认证、邮件、支付或 AI 配置

## TODO 清单
- [x] 1. 先增加配置 API、公开首屏快照和 R2 限制的失败测试
- [x] 2. 实现 General、Storage API 契约、Handler、校验和按域版本更新
- [x] 3. 在 SvelteKit 请求中读取一次 `PublicRuntimeConfig` 并下发 General 字段
- [x] 4. 将 R2 运行时读取切换到 Storage 快照
- [x] 5. 删除 `DESIGN_SYSTEM`、`DOCS_ENABLED` 和上传限制的 ENV、模板、生成字段及旧读取

## 验收测试步骤
1. 调用 General 和 Storage 更新接口并携带返回 bookmark，确认随后读取立即得到新值
2. 刷新页面确认设计系统和文档入口按 D1 配置变化，上传接口按新的类型和大小限制校验
3. 搜索仓库并运行配置准备与测试，确认对应配置只存在于 D1 契约而不再来自 ENV

# Task-003: 迁移 Authentication 与 Email 配置

## 描述
实现 Authentication、Email 配置 API，并让 Better Auth、Turnstile、外部 OAuth 和邮件发送按请求读取 D1 快照。启用开关、依赖字段与敏感凭据在一次原子保存中校验，旧 ENV 配置同时彻底删除。

## 不包含
- 不实现 OAuth API Access 设备授权
- 不实现后台配置页面

## TODO 清单
- [x] 1. 先增加启用条件、派生 Callback URL、密钥操作和邮件 Provider 的失败测试
- [x] 2. 实现 Authentication、Email API 契约、Handler 和脱敏响应
- [x] 3. 将 Better Auth、注册流程、Turnstile 和外部 OAuth 切换到请求内 D1 配置快照
- [x] 4. 将邮件模块切换到 D1 Provider 配置，保持 `SEND_EMAIL` 为固定 Binding
- [x] 5. 调整 Cloudflare 初始化并删除对应业务 ENV、Secret 和旧读取逻辑

## 验收测试步骤
1. 在禁用状态启动项目并使用固定管理员身份登录，确认未配置的注册和第三方登录入口隐藏
2. 保存一套完整认证和邮件配置，确认新请求立即使用新 Provider，Callback URL 由应用地址派生
3. 尝试在缺少必填凭据时启用功能，确认保存失败且旧配置完整保留

# Task-004: 迁移 Credits 与 Affiliate 配置

## 描述
实现 Credits、Affiliate 配置 API，并将注册赠送、每日签到、账本保留和邀请奖励规则切换到 D1。每次业务操作只读取一次相关配置快照，不保留 ENV 默认值或回退。

## 不包含
- 不修改 Credits 记账模型和 Affiliate 关系模型
- 不实现后台配置页面

## TODO 清单
- [ ] 1. 先增加额度转换、开关行为、保留期和邀请奖励的失败测试
- [ ] 2. 实现 Credits、Affiliate API 契约、Handler 和跨字段校验
- [ ] 3. 迁移注册赠送、签到、清理任务和邀请奖励的配置读取
- [ ] 4. 删除对应 ENV 定义、准备脚本字段和旧解析函数
- [ ] 5. 更新模块文档中的配置来源和操作流程

## 验收测试步骤
1. 保存新的赠送额度和邀请奖励后创建测试用户，确认实际账本金额来自 D1
2. 关闭签到或邀请功能后调用对应 API，确认新请求按关闭状态执行
3. 运行模块测试并搜索旧 ENV 名称，确认没有运行时读取或隐式默认值残留

# Task-005: 迁移 Payment 配置与商品

## 描述
实现 Payment 单例配置和 Product 集合 API，将 Provider 路由、凭据、Webhook 校验和 Checkout 商品来源全部切换到 D1。商品与 Provider 配置保持独立版本，删除仍被有效订阅引用的商品时返回冲突。

## 不包含
- 不改变现有支付订单、订阅和积分发放业务模型
- 不实现 Payment 后台页面

## TODO 清单
- [ ] 1. 先增加 Provider 启用、国家路由、商品约束、Webhook 和删除冲突的失败测试
- [ ] 2. 实现 Payment 配置及 Product CRUD 契约、Handler 和版本冲突处理
- [ ] 3. 将支付 Service、Checkout 和 Webhook 切换到 D1 快照与加密凭据
- [ ] 4. 删除 Payment ENV 商品解析、Provider Secret 和所有回退逻辑
- [ ] 5. 更新支付模块文档与测试数据构造方式

## 验收测试步骤
1. 创建商品并启用一个支付 Provider，确认 Checkout 使用 D1 商品和 Provider 配置
2. 更新 Webhook Secret 后用旧签名和新签名请求，确认只有新签名通过
3. 尝试删除被有效订阅引用的商品及使用过期版本更新，确认均返回 `CONFIG_CONFLICT`

# Task-006: 迁移 AI Provider 与 Channel 配置

## 描述
实现 AI 单例配置和 Channel 集合 API，将同步 Provider、异步 Channel Router、Queue Consumer 和清理任务全部切换到 D1。Channel 继续保留现有身份、路由指标和 Video 固定执行渠道语义，但不再从 ENV 发现渠道。

## 不包含
- 不改变 AI 任务表、队列消息格式和现有 Provider 能力
- 不实现 AI 后台页面

## TODO 清单
- [ ] 1. 先增加固定 Provider、Channel CRUD、路由权重、密钥替换和 Consumer 快照的失败测试
- [ ] 2. 实现 AI 配置及 Channel CRUD 契约、Handler、校验和加密凭据处理
- [ ] 3. 将同步 AI Provider 和异步 Channel Router 切换到 D1 配置
- [ ] 4. 迁移 Image、TTS、Video Consumer 与保留任务，保持一次执行只使用一份配置快照
- [ ] 5. 删除所有 AI 业务 ENV、Channel ENV 发现、解析器和兼容逻辑

## 验收测试步骤
1. 新建并启用 Channel 后提交对应 AI 任务，确认 Consumer 使用该 Channel 且指标仍按 Channel ID 记录
2. 更新路由权重或停用 Channel 后提交新任务，确认新执行读取新配置，已开始的 Video 任务仍使用持久化渠道
3. 运行 AI、Consumer 和 Cron 测试并搜索旧 AI ENV，确认运行时只从 D1 读取配置

# Task-007: 用通用 OAuth API Access 替换 Agent 授权

## 描述
保留供受信任管理员脚本使用的固定 `ADMIN_API_TOKEN`，删除所有 Agent 命名授权逻辑，建立基于 Better Auth OAuth Provider、PKCE、设备授权适配层和业务 Scope Registry 的通用 API Access。CLI 一次性切换为按连接名保存多项目凭据的新格式，Agent 不读取或保存 `ADMIN_API_TOKEN`。

## 不包含
- 不开放第三方 OAuth Client 动态注册
- 不保留旧路由、表、类型、页面或凭据文件兼容读取

## TODO 清单
- [ ] 1. 先增加设备授权、PKCE、Grant 撤销、Scope Registry 完整性和多项目 CLI 的失败测试
- [ ] 2. 实现 OAuth Authorization Request、Grant、Token Claim 和撤销流程
- [ ] 3. 为所有受保护 JSON 业务路由显式注册 scope，并统一 Session 与 Bearer Token 授权
- [ ] 4. 实现 `opc auth connect/status/disconnect` 与 `opc api request` 的新连接存储和同源限制
- [ ] 5. 删除旧 Agent Schema、路由、中间件、Context、页面、CLI 和文档，保留独立的 `ADMIN_API_TOKEN` 管理员认证路径

## 验收测试步骤
1. 分别对两个本地项目连接执行 `opc auth connect`，在浏览器批准不同 scope，确认凭据互不覆盖
2. 使用连接调用获批业务 API、未获批 API 和管理员 API，确认结果分别为成功、`FORBIDDEN` 和按管理员身份校验
3. 在后台撤销 Grant 后再次调用和刷新 Token，确认立即失效，并确认仓库不存在旧 Agent 授权且 Agent 凭据不含 `ADMIN_API_TOKEN`

# Task-008: 实现基础 Configuration 管理界面

## 描述
在后台增加单一 `Configuration` 入口和顶部水平业务 Tab，先实现 General、Authentication、Email、Storage、Credits、Affiliate 六个单例域。表单使用显式保存、脏状态切换拦截、启用后展开配置和字段级错误，不增加草稿或发布概念。

## 不包含
- 不实现 Payment Product 和 AI Channel 集合编辑
- 不增加自动保存、统一 Save All 或移动端吸底保存栏

## TODO 清单
- [ ] 1. 先增加路由、Tab、显式保存、脏状态和配置错误的前端失败测试
- [ ] 2. 实现 Configuration 布局、水平 Tab、默认重定向和 Admin 导航入口
- [ ] 3. 实现六个单例域表单，复用现有 UI Primitive 和 API Contract 类型
- [ ] 4. 实现 Secret 的 keep、replace、remove 交互及脱敏配置状态
- [ ] 5. 补齐英文 UI 文案、i18n、SEO 和 Admin Console 文档

## 验收测试步骤
1. 登录后台进入 Configuration，逐个切换六个 Tab，确认路由稳定且当前业务域清晰
2. 修改字段后切换 Tab，确认出现保存、放弃、取消选择；保存后刷新仍显示新值
3. 开启缺少配置的功能并保存，确认字段旁显示可操作错误，关闭后相关字段收起

# Task-009: 实现 Payment 与 AI 集合配置界面

## 描述
完成 Payment、AI 两个复杂 Tab，在单例表单下方分别管理 Product 和 Channel 集合。集合实体使用独立新建、编辑、删除流程，保存后只替换对应实体，不触发整个业务域重读。

## 不包含
- 不增加批量编辑、拖拽排序或跨实体 Save All
- 不展示任何密钥明文、密文或 IV

## TODO 清单
- [ ] 1. 先增加 Product、Channel 新建编辑删除、版本冲突和 Secret 操作的前端失败测试
- [ ] 2. 实现 Payment Provider 配置、派生 Webhook URL 和 Product 管理界面
- [ ] 3. 实现 AI 路由配置、固定 Provider 配置和 Channel 管理界面
- [ ] 4. 处理实体级 loading、empty、error、冲突刷新和删除确认状态
- [ ] 5. 同步 Admin Console、Payment 和 AI 操作文档

## 验收测试步骤
1. 在 Payment Tab 保存 Provider 后新建、编辑和删除 Product，确认每次只更新目标实体
2. 在 AI Tab 保存 Provider 和路由权重后管理 Channel，确认密钥只显示已配置状态
3. 用两个页面并发编辑同一实体，确认后保存页面收到 `CONFIG_CONFLICT` 且不会覆盖新版本

# Task-010: 收口初始化引导与端到端验收

## 描述
清理所有旧配置来源和文档，重写创建项目、本地运行、Cloudflare 部署、首次后台配置及 OAuth API Access 用户旅程。以本地完整用户流程和远程只读安全场景验证项目壳子可先启动，业务配置可随后保存并立即生效。

## 不包含
- 不增加新的配置域、兼容开关或迁移工具
- 不让远程 E2E 创建资源、执行迁移或直接写 D1

## TODO 清单
- [ ] 1. 先写完整 E2E 验收场景并确认能暴露尚未收口的用户流程问题
- [ ] 2. 更新 `CREATE_OPCSTACK_APP.md`、`QUICK_START.md`、README、模板文档、公开中英文文档和 `AGENTS.md`
- [ ] 3. 清理 ENV 文件、Wrangler 模板、准备脚本、生成配置和文档中的全部旧业务配置残留
- [ ] 4. 验证本地壳子启动、管理员登录、按域配置、前台生效、OAuth Client 授权调用和撤销流程
- [ ] 5. 运行完整类型检查、单元测试、构建、配置准备和 E2E 测试

## 验收测试步骤
1. 仅填写技术设计规定的固定 ENV，从空数据库启动项目，确认可登录后台且所有可选业务能力明确禁用
2. 通过后台配置一个业务域并通过 OAuth Client 配置另一个业务域，确认保存后新请求立即生效且旧操作快照不变
3. 按 `QUICK_START.md` 和 `CREATE_OPCSTACK_APP.md` 分别走本地与 Cloudflare 引导，确认没有要求填写已迁入 D1 的业务 ENV
4. 全仓搜索旧 ENV、Agent 授权和兼容关键词，确认没有旧逻辑残留
