！！！每完成一个任务并且验证通过之后就commit一下！！固定提醒

## 当前执行状态

- Task-001 至 Task-009 和 Task-006A 已实现、验证、提交并推送
- Task-010 的本地首次启动、浏览器、HTTP、OAuth、扩展构建和完整回归已通过
- Task-010 的本地与真实 Cloudflare 用户流程均已验收通过
- 未通过对应任务的行为测试、真实用户流程和完整回归前，不把已有局部代码视为完成

# Task-001: 建立 D1 配置存储与加密内核

## 描述
在 Meta D1 建立 `system_settings`、`payment_products`、`ai_providers` 及通用 OAuth API Access 数据表。实现按业务域读取、版本化原子更新和 AES-GCM 密钥加解密，为后续业务迁移提供唯一配置内核。

## 不包含
- 不迁移任何现有业务模块的 ENV 读取
- 不实现配置 Admin API 和管理后台页面

## TODO 清单
- [x] 1. 先增加初始化、业务域快照、版本冲突、密钥加解密和密钥完整性失败的测试并确认失败
- [x] 2. 按技术设计修改 Meta Schema，生成并检查 D1 Migration
- [x] 3. 实现结构化配置存储、请求内快照、乐观锁更新和 AES-GCM SecretMutation
- [x] 4. 在初始化流程写入明确的禁用配置、内置 AI Provider 和 `opc-cli` Public Client
- [x] 5. 更新系统密钥运行时契约、生成类型和相关架构文档

## 验收测试步骤
1. 启动本地环境并应用 Meta Migration，确认所有配置表和初始化记录存在
2. 运行配置内核测试，确认同一业务域读写、版本递增和过期版本冲突均符合设计
3. 替换一个敏感值后检查 D1 只保存不同 IV 的密文，错误根密钥读取时明确失败且不泄露敏感内容

# Task-002: 迁移 General 配置并固定 Storage 策略

## 描述
实现 General 配置契约和 Admin API，将 Web 首屏与文档入口切换到 D1。Design System 与 R2 上传策略保留为构建与部署级 ENV，确保静态页面、SSR 和上传边界各自只有一个配置来源。

## 不包含
- 不实现后台配置页面
- 不迁移认证、邮件、支付或 AI 配置

## TODO 清单
- [x] 1. 先增加 General 配置 API、公开首屏快照和 ENV R2 限制的失败测试
- [x] 2. 实现 General API 契约、Handler、校验和按域版本更新
- [x] 3. 在 SvelteKit 请求中读取一次 `PublicRuntimeConfig` 并下发 General 字段
- [x] 4. 将 R2 上传类型和大小限制收口到固定 ENV，删除 Storage D1 文档、API、Scope 和后台页面
- [x] 5. 删除 `DOCS_ENABLED` 的 ENV 和旧读取；保留 `DESIGN_SYSTEM` 与 R2 上传策略为各自唯一 ENV 来源

## 验收测试步骤
1. 调用 General 更新接口并携带返回 bookmark，确认随后读取立即得到新值
2. 刷新页面确认文档入口按 D1 配置变化，上传接口按 ENV 中的类型和大小限制校验
3. 修改 `DESIGN_SYSTEM` 后重新构建，确认 SSR 与客户端使用同一主题且后台 General 不再提供主题字段

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
- [x] 6. 删除 Email 独立开关，以 Provider 是否存在派生邮件可用性；未配置时隐藏忘记密码入口，注册仍由统一注册开关控制

## 验收测试步骤
1. 在禁用状态启动项目并使用固定管理员身份登录，确认未配置的注册和第三方登录入口隐藏
2. 保存一套完整认证和邮件配置，确认新请求立即使用新 Provider，Callback URL 由应用地址派生
3. 尝试在缺少必填凭据时启用功能，确认保存失败且旧配置完整保留

# Task-003A: 自动初始化系统密钥并删除静态管理员 Token

## 描述
由准备脚本首次生成 Better Auth、D1 配置加密和 R2 Origin 三个内部根密钥。本地持久化到本地 secret 状态，远程写入 Cloudflare Worker Secrets，后续启动和部署只复用、不覆盖。彻底删除 `ADMIN_API_TOKEN`，管理员暂时只使用浏览器 Session；程序化 OAuth API Access 由 Task-007 完整接替。

## TODO 清单
- [x] 1. 先增加本地生成复用、远程首次部署、密钥缺失和旧管理员 Token 失效的失败测试
- [x] 2. 实现三个内部根密钥的首次生成、失败重试复用和已有 Worker 完整性检查
- [x] 3. 删除 `ADMIN_API_TOKEN` 中间件、运行时类型、示例配置和测试调用
- [x] 4. 将管理员 E2E 改为真实 Better Auth Session
- [x] 5. 更新创建项目流程、技术设计和配置说明

## 验收测试步骤
1. 从空 D1 启动本地项目，确认脚本自动生成三个根密钥并在再次启动时保持不变
2. 首次远程部署确认三个值进入 Worker Secrets，后续部署不上传或覆盖已有值
3. 使用旧静态 Bearer Token 调用管理员接口确认返回 401，使用当前 D1 管理员浏览器 Session 确认成功
4. 模拟已有 D1 丢失根密钥，确认准备阶段明确失败而不是生成错误的新密钥

# Task-003B: 将管理员身份与首次凭据迁入 D1

## 描述
删除长期 `SUPER_ADMIN_PASSWORD` ENV。`SYSTEM_EMAIL` 只作为空 Meta D1 的初始化输入，准备脚本用它创建唯一管理员并随机生成一次性初始密码；后续准备和部署不得重置管理员邮箱或密码。管理员身份由 D1 角色判断，设置页允许管理员修改密码，但不允许修改邮箱。

## 不包含
- 不实现 OAuth API Access；程序化授权仍由 Task-007 负责
- 不拆分管理员邮箱、支持邮箱和发件地址；当前三者统一读取初始化后固定的 D1 管理员邮箱

## TODO 清单
- [x] 1. 先增加空库初始化、缺失邮箱、重复准备不重置、D1 管理员角色校验和修改密码的失败测试
- [x] 2. 在 Better Auth 用户模型中持久化管理员角色，并将管理 API 从邮箱 ENV 比较切换为 D1 角色校验
- [x] 3. 初始化缺失管理员时使用 `SYSTEM_EMAIL` 和随机一次性密码，只显示一次并保证后续准备不覆盖凭据
- [x] 4. 设置页只允许修改密码，并展示 OAuth 登录账号关联和 API Access Grant 管理；邮件发送和公开支持邮箱读取 D1 管理员邮箱
- [x] 5. 删除 `SUPER_ADMIN_PASSWORD` 和管理员邮箱修改 API；保留 `SYSTEM_EMAIL` 作为空库初始化的唯一输入

## 验收测试步骤
1. 从空 Meta D1 运行准备流程，确认缺失 `SYSTEM_EMAIL` 会失败，提供有效邮箱后终端只在首次显示该邮箱和随机密码，并可用它登录后台
2. 修改管理员密码后再次运行准备流程，确认 D1 邮箱和新密码仍有效、初始密码失效且没有再次显示密码
3. 使用普通用户 Session 调用管理员 API 确认返回 `403`，管理员 Session 成功

# Task-004: 迁移 Credits 与 Affiliate 配置

## 描述
实现 Credits、Affiliate 配置 API，并将注册赠送、每日签到、账本保留和邀请奖励规则切换到 D1。每次业务操作只读取一次相关配置快照，不保留 ENV 默认值或回退。

## 不包含
- 不修改 Credits 记账模型和 Affiliate 关系模型
- 不实现后台配置页面

## TODO 清单
- [x] 1. 先增加额度转换、开关行为、保留期和邀请奖励的失败测试
- [x] 2. 实现 Credits、Affiliate API 契约、Handler 和跨字段校验
- [x] 3. 迁移注册赠送、签到、清理任务和邀请奖励的配置读取
- [x] 4. 删除对应 ENV 定义、准备脚本字段和旧解析函数
- [x] 5. 更新模块文档中的配置来源和操作流程

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
- [x] 1. 先增加 Provider 启用、国家路由、商品约束、Webhook 和删除冲突的失败测试
- [x] 2. 实现 Payment 配置及 Product CRUD 契约、Handler 和版本冲突处理
- [x] 3. 将支付 Service、Checkout 和 Webhook 切换到 D1 快照与加密凭据
- [x] 4. 删除 Payment ENV 商品解析、Provider Secret 和所有回退逻辑
- [x] 5. 更新支付模块文档与测试数据构造方式

## 验收测试步骤
1. 创建商品并启用一个支付 Provider，确认 Checkout 使用 D1 商品和 Provider 配置
2. 更新 Webhook Secret 后用旧签名和新签名请求，确认只有新签名通过
3. 尝试删除被有效订阅引用的商品及使用过期版本更新，确认均返回 `CONFIG_CONFLICT`

# Task-006: 迁移 AI 配置

> 历史双轨方案已作废。最终系统只保留 `ai_providers`；Task-006A 是该任务的最终模型收口。

## 描述
实现 AI 单例配置和 Provider 集合 API，将同步调用、Provider Router、Queue Consumer 和清理任务全部切换到 D1。Provider 保留独立身份、路由指标和 Video 固定执行实体语义。

## 不包含
- 不改变 AI 任务表、队列消息格式和现有 Provider 能力
- 不实现 AI 后台页面

## TODO 清单
- [x] 1. 先增加 Provider CRUD、路由权重、密钥替换和 Consumer 快照的失败测试
- [x] 2. 实现 AI 配置及 Provider CRUD 契约、Handler、校验和加密凭据处理
- [x] 3. 将同步 AI 与 Provider Router 切换到 D1 配置
- [x] 4. 迁移 Image、TTS、Video Consumer 与保留任务，保持一次执行只使用一份配置快照
- [x] 5. 删除所有 AI 业务 ENV、旧端点发现、解析器和兼容逻辑

## 验收测试步骤
1. 新建并启用 Provider 后提交对应 AI 任务，确认 Consumer 使用该 Provider 且指标按 Provider ID 记录
2. 更新路由权重或停用 Provider 后提交新任务，确认新执行读取新配置，已开始的 Video 任务仍使用持久化 Provider
3. 运行 AI、Consumer 和 Cron 测试并搜索旧 AI ENV，确认运行时只从 D1 读取配置

# Task-006A: 将 AI 配置统一为 Provider

## 描述
删除固定 Provider 与 Channel 双轨模型，只保留 `ai_providers` 作为具体执行端点的唯一来源。Provider Type 使用 `image_openai`、`image_gemini`、`tts_seed` 等完整类型，不再拆分 `area`、`provider`、`capability` 或 `adapter`；路由器只负责对已经筛选好的 Provider 候选排序。

## 不包含
- 不实现跨 Provider Type 的模型映射，例如在 OpenAI 和 Gemini 模型之间自动转换
- 不保留 `ai_channels`、固定 Provider 配置、旧 API、旧字段或兼容读取

## TODO 清单
- [x] 1. 先修订 `docs/v025/tech-design.md` 并增加失败测试，明确 Provider 数据模型、同步调用选择、异步失败切换、Video 固定 Provider 和权重立即生效语义
- [x] 2. 将 `system_settings.ai_config` 收口为路由权重与任务保留期，将旧集合重建为 `ai_providers`；Provider 包含 `id`、`name`、`type`、`models`、`base_url`、`api_key`、`price_multiplier`、`enabled` 和独立版本
- [x] 3. 将 AI Contract、配置组件和 Admin API 统一为 Provider CRUD，删除旧双轨 CRUD、非法组合及对应错误码
- [x] 4. 配置组件按 `type + model + enabled` 解析候选；Router 只接收候选、指标和系统权重进行排序，不识别 Image、OpenAI 或具体 Provider Type
- [x] 5. 将 Chat、Image、TTS、Realtime、Video、Queue Consumer、任务字段和指标字段切换到 Provider Type 与 Provider ID；Video 创建远程任务后固定 Provider ID
- [x] 6. 删除源码、测试、Migration、文档和 `AGENTS.md` 中的旧双轨模型、`capability`、`adapter` 及旧命名残留

## 验收测试步骤
1. 创建两个 `image_openai` Provider，并让它们同时声明 `gpt-image-1`，确认任务只在这两个候选之间按权重排序
2. 修改错误率、延迟和价格权重后提交新任务，确认新执行立即使用新权重，已开始的执行仍使用自己的配置快照
3. 创建 Video 远程任务后停用其 Provider，确认后续轮询仍使用持久化 Provider ID；新任务不再选择已停用 Provider
4. 全仓搜索并检查最终 D1 Schema，确认不存在 `ai_channels`、固定 Provider 配置和 Channel 兼容逻辑

# Task-007: 用通用 OAuth API Access 替换 Agent 授权

## 描述
删除所有 Agent 命名授权逻辑，建立基于 Better Auth OAuth Provider、PKCE、设备授权适配层和业务 Scope Registry 的通用 API Access。CLI 一次性切换为按连接名保存多项目凭据的新格式，不提供静态管理员 Token。

## 不包含
- 不开放第三方 OAuth Client 动态注册
- 不保留旧路由、表、类型、页面或凭据文件兼容读取

## TODO 清单
- [x] 1. 先增加设备授权、PKCE、Grant 撤销、Scope Registry 完整性和多项目 CLI 的失败测试
- [x] 2. 实现 OAuth Authorization Request、Grant、Token Claim 和撤销流程
- [x] 3. 为所有受保护 JSON 业务路由显式注册 scope，并统一 Session 与 Bearer Token 授权；`admin:*` 和 `config:*` 同时校验 Grant 所属用户当前仍是 D1 管理员
- [x] 4. 实现 `opc auth connect/status/disconnect` 与 `opc api request` 的新连接存储和同源限制
- [x] 5. 删除旧 Agent Schema、路由、中间件、Context、页面、CLI 和文档

## 验收测试步骤
1. 分别对两个本地项目连接执行 `opc auth connect`，在浏览器批准不同 scope，确认凭据互不覆盖
2. 使用连接调用获批业务 API、未获批 API 和管理员 API，确认结果分别为成功、`FORBIDDEN` 和按管理员身份校验
3. 在后台撤销 Grant 后再次调用和刷新 Token，确认立即失效，并确认仓库不存在旧 Agent 授权或静态管理员 Token

# Task-008: 实现基础 Configuration 管理界面

## 描述
在后台增加单一 `System Settings` 入口和顶部水平业务 Tab，实现 General、Authentication、Email、Credits、Affiliate、Payment、AI 七个单例域。Storage 策略属于固定 ENV，不在后台出现。表单使用显式保存、脏状态切换拦截、启用后展开配置和字段级错误，不增加草稿或发布概念。

## 不包含
- 不实现 Payment Product 和 AI Provider 集合编辑
- 不增加自动保存或统一 Save All；业务域存在未保存修改时显示固定操作栏，移动端避开安全区域

## TODO 清单
- [x] 1. 用纯状态测试和真实浏览器测试覆盖路由、Tab、显式保存、脏状态、字段错误和冲突保留输入，删除读取 Svelte 源码并搜索字符串的弱测试
- [x] 2. 实现 Configuration 布局、水平 Tab、默认重定向和 Admin 导航入口
- [x] 3. 完成 General、Authentication、Email、Credits、Affiliate、Payment、AI 七个单例域表单；Storage 策略只保留 ENV，不存在第二份 D1 或 UI 配置
- [x] 4. 完成 Secret 的 keep、replace、remove、待删除和撤销交互；浏览器永远不接收已保存明文、密文、IV 或伪掩码值
- [x] 5. 完成脏状态固定操作栏和跨 Tab 离开确认；用户可选择保存后离开、放弃后离开或取消导航，保存失败时停留并保留输入
- [x] 6. 完成保存成功 Toast、首个字段错误聚焦、`CONFIG_CONFLICT` 保留输入与刷新入口，并通过双页面并发更新验证冲突
- [x] 7. 所有可关闭配置区默认收起、开启时展开、关闭时可独立展开预配置；完成 OAuth Callback URL 复制、英文 i18n、页面标题和 Admin Console 文档

## 验收测试步骤
1. 登录后台进入 System Settings，逐个切换七个 Tab，确认不存在 Storage Tab，路由稳定且当前业务域清晰
2. 修改字段后切换 Tab，确认出现保存、放弃、取消选择；保存后刷新仍显示新值
3. 开启缺少配置的功能并保存，确认字段旁显示可操作错误并聚焦首个错误；关闭后相关字段收起但可独立展开
4. 用两个浏览器页面读取同一版本后依次保存，确认后保存页面显示冲突、保留输入且可刷新最新配置

# Task-009: 实现 Payment Product 与 AI Provider 管理界面

## 描述
完成 Payment、AI 两个复杂 Tab，在单例表单下方分别管理 Product 和 Provider 集合。集合实体使用独立新建、编辑、删除流程，保存后只替换对应实体，不触发整个业务域重读；AI 路由权重保留在系统设置并显式暴露。

## 不包含
- 不增加批量编辑、拖拽排序或跨实体 Save All
- 不展示任何密钥明文、密文或 IV

## TODO 清单
- [x] 1. 用状态测试和真实浏览器测试覆盖 Product、Provider 新建、编辑、删除、停用、版本冲突和 Secret 操作，不使用源码字符串断言
- [x] 2. 完成 Payment 开关、默认 Provider、Provider 凭据、Webhook URL 复制和国家路由结构化行编辑；关闭时允许独立展开预配置
- [x] 3. 完成 Product 表格和右侧抽屉，只支持可执行的 `remote_product`，实体保存只替换目标 Product，不重置 Payment 单例草稿
- [x] 4. 基于 Task-006A 完成 AI Provider 表格和右侧抽屉，字段仅为 `id`、`name`、完整 `type`、`models`、`base_url`、`api_key`、`price_multiplier`、`enabled`，不展示 Area、Channel、Capability 或 Adapter
- [x] 5. 在 AI 系统设置中暴露错误率、延迟和价格三个非负相对权重并校验总和大于零；Task-006A 迁移时保持该配置与下一次选择立即生效语义
- [x] 6. Product 与 Provider 使用各自版本处理 loading、empty、error、删除确认和 `CONFIG_CONFLICT`；冲突不覆盖新版本且保留抽屉输入
- [x] 7. 同步 Admin Console、Payment 和 AI 操作文档，统一使用 Provider 术语

## 验收测试步骤
1. 在 Payment Tab 保存 Provider 后新建、编辑和删除 Product，确认每次只更新目标实体
2. 在 AI Tab 保存路由权重并新建、编辑和停用 Provider，确认密钥只显示已配置状态，页面不存在 Channel 或独立 Area 字段
3. 用两个页面并发编辑同一实体，确认后保存页面收到 `CONFIG_CONFLICT` 且不会覆盖新版本

# Task-010: 收口初始化引导与端到端验收

## 描述
清理所有旧配置来源和文档，重写创建项目、本地运行、Cloudflare 部署、首次后台配置及 OAuth API Access 用户旅程。以本地完整用户流程和远程可恢复安全场景验证项目壳子可先启动，业务配置可随后保存并立即生效。

## 不包含
- 不增加新的配置域、兼容开关或迁移工具
- 不让远程 E2E 部署、创建资源、执行迁移或直接写 D1

## TODO 清单
- [x] 1. 补齐真实本地首次安装、七个 Configuration 单例域、Payment Product、AI Provider 和 OAuth API Access E2E；禁止用单测、构建、mock 或直接数据库写入替代用户流程
- [x] 2. 更新 `CREATE_OPCSTACK_APP.md`、`QUICK_START.md`、README、模板文档、公开中英文文档和 `AGENTS.md`，统一初始化、首次后台配置、Provider 和 OAuth API Access 用户旅程
- [x] 3. 清理 ENV 文件、Wrangler 模板、准备脚本、生成配置和文档中的全部旧业务配置残留
- [x] 4. 从空本地数据通过真实浏览器验证初始密码只显示一次、管理员登录并修改密码、OAuth 账号关联与 API Access 内嵌管理、按域保存、刷新持久化和前台立即生效
- [x] 5. 通过公开 HTTP 验证 `opc-cli` PKCE / 设备授权、获批 scope 调用、未获批 scope 拒绝、Grant 撤销后 Access / Refresh Token 失效和两个不同名称、不同地址连接的凭据互不覆盖
- [x] 6. 修正并验证生产扩展 Host Permission；运行完整类型检查、单元测试、构建、配置准备、本地浏览器 E2E 和本地 HTTP E2E
- [x] 7. 对真实已部署 Cloudflare 实例执行只通过公开页面和 HTTP API 的管理员 Session、配置读写立即生效、OAuth 授权调用与撤销验收；不得部署、迁移、创建资源或直写远程 D1
- [x] 8. 清理测试名称和 Given 文案中的 `admin api token`，压平预发布 Migration 中旧 Agent 表与 AI 双轨历史，最终搜索确认无旧 API、旧 Schema、旧运行时 ENV 或兼容读取
- [x] 9. 将所有实际执行命令、目标地址、通过结果和无法执行的外部前置条件记录到验收文档；只有真实 Cloudflare 场景通过后才完成本任务

## 验收测试步骤
1. 填写技术设计规定的固定 ENV 与初始化邮箱，从空数据库启动项目，确认终端只显示一次初始凭据、可登录并修改管理员密码，所有可选业务能力明确禁用
2. 通过后台配置一个业务域并通过 OAuth Client 配置另一个业务域，确认保存后新请求立即生效且旧操作快照不变
3. 按 `QUICK_START.md` 和 `CREATE_OPCSTACK_APP.md` 分别走本地与 Cloudflare 引导，确认没有要求填写已迁入 D1 的业务 ENV
4. 全仓搜索旧 ENV、Agent 授权和兼容关键词，确认没有旧逻辑残留
5. 对真实 Cloudflare URL 运行远程 E2E，确认测试只使用公开页面和 HTTP API，且不执行部署、Migration、资源创建或直接 D1 写入

# Task-011: 收口主题来源与通知生命周期

## 描述
主题只由构建期 `DESIGN_SYSTEM` ENV 决定，不在动态配置中暴露。通知详情移除内部 ID，增加直接编辑与归档能力；归档通知对用户隐藏但保留在后台历史中。

## TODO 清单
- [x] 1. 删除 General D1 文档、API 和后台表单中的 Design System，改由公开 ENV 生成并在 SSR 与客户端统一使用
- [x] 2. 为通知增加 `archived_at`、更新与归档 API，用户列表只读取未归档通知
- [x] 3. 后台通知详情移除 ID，提供原位编辑和归档确认，列表显示生效或归档状态
- [x] 4. 同步模板文档、公开文档和本地 E2E 验收

## 验收测试步骤
1. 修改 `DESIGN_SYSTEM` 并重新构建，确认 SSR 与客户端主题一致，General API 和后台不存在主题字段
2. 发布通知后修改标题与内容，确认用户立即读取到修改结果
3. 归档通知，确认用户列表不再返回，后台列表仍保留并标记已归档
4. 打开通知详情，确认不显示内部通知 ID，已归档通知不能再编辑

# Task-012: 重构后台导航与高频配置实体工作区

## 描述
删除后台侧栏的运营和运维分组，将 Payment Product 与 AI Provider 从 System Settings 拆成独立工作区。Payment Product 只关联一个已完成凭据配置的支付 Provider，并记录创建时对应的测试或生产环境；Provider 的密钥和环境仍由 System Settings 统一管理。

## TODO 清单
- [x] 1. 增加导航、Payment Product 单 Provider 契约、Schema 和独立页面的失败测试
- [x] 2. 将 Payment Product 数据模型收口为 `provider + test_mode + provider_product_id`，删除 Dodo、Creem 双列及运行时兼容结构
- [x] 3. 创建 Payment Products 独立工作区，按 Provider 分区展示并只允许选择已配置 Provider
- [x] 4. 创建 AI Providers 独立工作区，将 System Settings 的 Payment、AI 页面分别收口为平台凭据和 AI 路由设置
- [x] 5. 删除侧栏分组，统一后台导航顺序、命名、表格、筛选栏和右侧编辑抽屉的视觉层级
- [x] 6. 重建预发布初始 Migration，同步技术设计、后台操作文档和 `AGENTS.md`
- [x] 7. 运行完整类型检查、单元测试、构建、本地 HTTP E2E 和真实浏览器 E2E，不部署线上

## 验收测试步骤
1. 登录后台，确认侧栏没有运营或运维分组，并能直接进入 Payment Products、AI Providers 和 System Settings
2. 在 System Settings 配置 Dodo 或 Creem 凭据后进入 Payment Products，确认创建时只能选择已配置 Provider，并自动绑定该 Provider 当前测试或生产环境
3. 切换 Provider 环境后确认旧环境商品不会进入当前 Checkout；新建商品使用新环境且不会覆盖旧记录
4. 在 AI Providers 独立页面完成创建、编辑、停用和删除，确认 AI Routing 草稿和 Provider 实体互不影响
5. 从空本地数据执行真实浏览器流程，确认导航、空状态、表格、抽屉、冲突和删除确认均可操作且布局一致

# Task-013: 收口认证设置与后台工作区交互

## 描述
根据后台验收反馈，收口认证配置层级、部署托管凭据边界、OAuth 回调展示和后台顶栏操作；同时统一通知、用户、积分、内测码、兑换码及配置工作区的视觉交互。

## TODO 清单
- [x] 1. 将开放注册作为账号准入父开关，邮箱域名、内测码和邮箱验证作为嵌套选项；关闭父开关时收起子配置
- [x] 2. Turnstile 仅保留动态启用开关，Site Key 和 Secret Key 由部署配置管理，后台不再编辑或回显
- [x] 3. OAuth Callback URL 改为只读文本和复制操作，不允许误编辑
- [x] 4. 删除配置页多余的账号/安全入口，Worker 日志移到后台顶栏左侧首个操作位
- [x] 5. 清理配置和 AI/邮件工作区不协调的小状态徽标，统一使用页面现有文本层级
- [x] 6. 通知详情移除内部 ID，支持编辑和归档；用户详情移除准入、验证、邀请码、数据库技术字段
- [x] 7. 统一用户、积分发放、内测码、兑换码和所有后台列表的筛选栏、间距、空状态和抽屉布局
- [x] 8. 通过真实浏览器首轮流程验证上述交互，并执行完整类型检查、单元测试和构建

## 验收测试步骤
1. 登录后台进入认证设置，确认开放注册下的子项层级正确，Turnstile 凭据不可编辑，OAuth 回调可复制但不是输入框
2. 确认配置页没有账号/安全重复入口，Worker 日志位于顶栏左侧首个操作
3. 创建、编辑、归档通知并查看用户、积分、内测码、兑换码页面，确认技术字段和小徽标已移除且布局一致
4. 从空本地数据执行 `pnpm test:e2e:first-run`，确认真实浏览器和 HTTP 验收通过

# Task-014: 收口管理员账号与存储策略来源

## 描述
管理员邮箱只在空 Meta D1 初始化时由 `SYSTEM_EMAIL` 提供，后续不可从设置页或管理 API 修改。设置页直接管理 OAuth 关联账号、密码和 API Grant。存储上传策略改为固定 ENV，删除 D1、管理 API、Scope 和后台 Storage Tab 的第二来源。

## TODO 清单
- [x] 1. 首次准备强制校验 `SYSTEM_EMAIL`，创建唯一管理员并生成一次性随机密码；后续准备不覆盖现有账号
- [x] 2. 删除管理员邮箱修改 API 和设置页表单，并在 Better Auth 与 Email OTP 中显式关闭邮箱修改
- [x] 3. 将 OAuth 关联账号、解除关联和 API Grant 管理直接放入设置页，删除独立 API Access 子页面
- [x] 4. 将上传 MIME 允许列表和最大上传大小迁至固定 ENV，删除 Storage D1 字段、API、Scope、后台 Tab 和旧测试
- [x] 5. 重建预发布 Meta Migration，同步创建引导、技术设计、模板文档、公开文档和 `AGENTS.md`
- [x] 6. 运行完整类型检查、单元测试、构建和真实本地首次运行 E2E，不部署线上

## 验收测试步骤
1. 从空 Meta D1 启动，确认缺少或填写非法 `SYSTEM_EMAIL` 时立即失败；填写合法邮箱后只在首次创建时输出随机密码
2. 登录设置页，确认没有修改邮箱入口，可修改密码、关联或解除 OAuth 账号，并可查看或撤销 API Grant
3. 打开 System Settings，确认不存在 Storage Tab；修改上传策略只能通过 ENV 并在重启或部署后生效
4. 全仓搜索 Storage 动态配置和管理员邮箱修改契约，确认没有兼容路由、D1 字段或双重来源
5. 执行 `pnpm test:e2e:first-run`，确认真实浏览器与 HTTP 流程通过且未触发线上部署

# Task-015: 完善后台业务工作区与统一操作布局

## 描述
按运营人员的真实工作流统一后台列表、筛选、详情和操作密度。用户列表增加剩余积分，详情只保留业务信息；新增积分流水和邀请记录两个独立工作区；通知、内测码、兑换码、支付及 AI 任务继续使用同一套页面骨架。

## TODO 清单
- [x] 1. 先增加后台导航、用户余额、积分流水和邀请记录的契约与页面行为测试并确认失败
- [x] 2. 用户列表移除准入状态并增加剩余积分；详情移除验证、邀请码、准入和数据库字段，显示邀请人
- [x] 3. 重做积分发放表单，提供永不过期、一周后、一个月后和自定义日期选项，并统一表单密度与错误布局
- [x] 4. 增加积分流水工作区，支持按用户和变动类型查询余额变化
- [x] 5. 增加邀请记录工作区，展示邀请人、被邀请人、奖励状态及创建时间
- [x] 6. 统一用户、内测码、兑换码、通知、支付和 AI 任务的筛选栏、表格、空状态、分页和抽屉布局
- [x] 7. 同步后台操作文档并完成类型检查、单测和真实浏览器验收

## 验收测试步骤
1. 登录后台进入用户列表，确认没有准入状态，剩余积分可见，搜索栏紧凑且无需额外标题
2. 打开用户详情，确认邮箱与 ID 不重复，不展示验证、邀请码、准入或数据库技术字段；存在邀请人时可直接查看
3. 发放积分时分别选择永不过期、一周后、一个月后和自定义日期，确认账本过期时间正确
4. 从侧栏进入积分流水和邀请记录，使用用户筛选后确认数据、空状态和分页均可操作
5. 逐页检查所有后台列表，确认筛选栏、操作按钮、表格和抽屉视觉规则一致

# Task-016: 重构系统设置的信息架构与表单语言

## 描述
系统设置只保留低频单例配置。每个表单从业务影响出发组织开关、说明和依赖字段，删除泛化的“启用”、技术枚举、细小状态徽标、无意义满宽输入和伪输入框。固定 ENV 不在后台出现。

## TODO 清单
- [ ] 1. 先增加设置 Tab、父子开关、字段展示和文案行为测试并确认失败
- [ ] 2. General 仅保留文档可用性并补充明确说明；主题继续由 `DESIGN_SYSTEM` ENV 唯一决定
- [ ] 3. Authentication 以开放注册为父开关，Turnstile 只暴露动态开关，OAuth 回调使用只读文本和复制操作
- [ ] 4. Email、Credits 和 Affiliate 使用业务动作命名、紧凑宽度和展开式配置，不使用独立状态徽标
- [ ] 5. Payment 只管理收款状态、平台连接和高级路由；国家使用可搜索选择器，密钥状态与操作对齐，Webhook URL 使用只读代码文本
- [ ] 6. AI Routing 将 Provider 列表移出后使用策略预设，自定义时才展示权重；任务保留期拆成独立区域
- [ ] 7. 同步中英文文案、公开文档和后台指南并完成真实浏览器验收

## 验收测试步骤
1. 逐个打开七个设置 Tab，确认第一屏能说明配置影响，控件宽度符合内容且不存在孤立的“启用”文案
2. 开关注册、Turnstile、邮件、积分和邀请功能，确认依赖字段按业务层级展开且保存错误指向具体字段
3. 配置支付平台，确认国家选择不要求输入代码，Webhook URL 不可编辑，只有已配置平台可参与路由
4. 打开 AI Routing，确认默认使用可理解的策略预设，只有自定义策略显示三个权重，任务保留期不混在路由设置中

# Task-017: 将支付商品改为远端商品关联流程

## 描述
支付商品不再要求管理员填写任何内部 ID 或同时维护多平台字段。管理员先选择已配置支付平台，再从该平台读取远端商品并关联积分或订阅权益。内部 ID、远端类型、价格、币种和环境由系统生成或读取。

## TODO 清单
- [ ] 1. 先增加远端商品列表、单平台关联、环境一致性和重复关联的契约与服务测试并确认失败
- [ ] 2. 为 Dodo 和 Creem Provider 增加远端商品发现接口，并通过管理 API 暴露当前已配置平台的商品列表
- [ ] 3. 收口 Payment Product Schema，只保存系统身份、Provider、环境、远端商品 ID 和本地权益，不保留多 Provider 列或手填内部 ID
- [ ] 4. 重做支付商品抽屉：选择平台、选择远端商品、填写发放积分或订阅权益、确认关联
- [ ] 5. 空状态提供刷新和远端平台入口；列表展示平台、环境、远端商品、价格、权益和状态
- [ ] 6. 更新 Checkout、Webhook、文档和测试，删除旧手填商品 ID 及兼容逻辑
- [ ] 7. 完成真实本地支付商品关联流程和完整回归

## 验收测试步骤
1. 未配置支付平台时打开新建商品，确认无法继续并直接引导到支付平台设置
2. 配置 Dodo 或 Creem 后刷新远端商品，确认只展示所选平台当前环境的商品名称、价格和类型
3. 选择一个远端商品并填写积分，确认内部 ID 自动生成且列表只出现一条对应平台关联
4. 再次关联同一远端商品确认被拒绝；切换平台环境后确认旧环境商品不会进入当前 Checkout

# Task-018: 重构 AI Provider 创建与路由引导

## 描述
AI Provider 工作区隐藏内部 ID 和内部类型枚举，以“用途 + 实现”组织 Provider。模型使用标签输入，官方 Base URL 自动处理，只有兼容接口才要求填写；路由设置使用可理解的策略预设并保留自定义权重。

## TODO 清单
- [ ] 1. 先增加 Provider 自动 ID、人类可读类型、模型标签、官方地址和路由预设测试并确认失败
- [ ] 2. Provider 创建时由服务端生成 ID；管理 API 不再接受调用方提供的 ID
- [ ] 3. Provider 类型选择显示用途与实现名称，不展示 `image_gemini` 等内部枚举
- [ ] 4. 名称按选择结果提供默认值，模型改为回车生成的可删除标签
- [ ] 5. 官方实现隐藏并使用内置 Base URL，兼容接口才展示地址；成本系数与启用状态提供明确影响说明
- [ ] 6. AI Routing 提供均衡、稳定优先、速度优先、成本优先和自定义预设，并保持保存后立即生效
- [ ] 7. 更新技术设计、Provider 文档和真实浏览器 E2E

## 验收测试步骤
1. 新建 Provider，确认不需要填写 ID，类型选择项使用“图片生成 / Google Gemini”等业务名称
2. 连续输入两个模型并回车，确认生成两个可删除标签；官方 Provider 不显示 Base URL
3. 选择兼容接口后填写 Base URL 和 API Key，保存后确认列表显示名称、用途、模型和启用状态
4. 切换路由策略并提交任务，确认下一次 Provider 选择立即使用对应权重

# Task-019: 完整部署与真实线上端到端验收

## 描述
在 Task-015 至 Task-018 全部通过后提交并推送，部署真实 Cloudflare 实例。通过公开页面、浏览器 Session 和 HTTP API 验证首次登录、账号安全、设置、业务工作区、OAuth API Access、用户侧文档及关键业务流程，不使用直接远程数据库写入代替用户操作。

## TODO 清单
- [ ] 1. 执行完整类型检查、单元测试、构建、本地 HTTP E2E 和本地真实浏览器 E2E
- [ ] 2. 检查固定 ENV、Secret、Migration、废弃字段和旧命名残留，确保配置来源唯一
- [ ] 3. 按任务逐一提交并推送 `main`，执行 Cloudflare 生产部署
- [ ] 4. 使用 In App Browser 验证管理员登录、设置保存、用户管理、通知、支付商品、AI Provider、积分流水和邀请记录
- [ ] 5. 验证用户设置页 OAuth 关联、密码与 API Grant，验证公开文档和用户侧关键页面
- [ ] 6. 通过公开 HTTP 验证 OAuth 授权 Scope、撤销和配置保存后立即生效
- [ ] 7. 将真实地址、命令和结果写入验收记录，确认没有阻塞项后完成任务

## 验收测试步骤
1. 从线上登录页使用当前管理员账号登录，确认密码、Session、后台导航和设置页面正常
2. 通过 UI 创建并回收一组测试数据，覆盖用户积分、通知、支付商品和 AI Provider 的完整生命周期
3. 在两个浏览器页面制造配置版本冲突，确认旧页面保留输入并要求刷新
4. 完成 OAuth API Access 授权、调用、拒绝和撤销；确认不同地址与连接名互不冲突
5. 访问中英文公开文档和关键用户页面，确认无 500、无缺失入口、无布局重叠
