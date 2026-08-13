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
删除长期 `SYSTEM_EMAIL` 和 `SUPER_ADMIN_PASSWORD` ENV。空库初始化时在 Meta D1 创建唯一管理员 `admin@opcstack.local`，随机生成一次性初始密码并只在当前终端显示一次；后续准备和部署不得重置管理员邮箱或密码。管理员身份由 D1 角色判断，后台 Account / Security 允许管理员修改邮箱和密码。

## 不包含
- 不实现 OAuth API Access；程序化授权仍由 Task-007 负责
- 不拆分管理员邮箱、支持邮箱和发件地址；当前三者统一读取唯一管理员邮箱

## TODO 清单
- [x] 1. 先增加空库初始化、重复准备不重置、D1 管理员角色校验、修改邮箱和密码的失败测试
- [x] 2. 在 Better Auth 用户模型中持久化管理员角色，并将管理 API 从邮箱 ENV 比较切换为 D1 角色校验
- [x] 3. 初始化缺失管理员时生成 `admin@opcstack.local` 和随机一次性密码，只显示一次并保证后续准备不覆盖凭据
- [x] 4. 实现后台 Account / Security 页面，允许当前管理员修改邮箱和密码；邮件发送和公开支持邮箱读取管理员邮箱
- [x] 5. 删除 `SYSTEM_EMAIL`、`SUPER_ADMIN_PASSWORD` 的 ENV、Worker var、准备脚本输入、生成配置和现有文档声明

## 验收测试步骤
1. 从空 Meta D1 运行准备流程，确认终端只在首次显示 `admin@opcstack.local` 和随机密码，并可用它登录后台
2. 修改管理员邮箱和密码后再次运行准备流程，确认新凭据仍有效、初始凭据失效且没有再次显示密码
3. 使用普通用户 Session 调用管理员 API 确认返回 `403`，管理员 Session 成功；使用 `@opcstack.local` 配置 Email Provider 应明确失败

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
在后台增加单一 `Configuration` 入口和顶部水平业务 Tab，先实现 General、Authentication、Email、Storage、Credits、Affiliate 六个单例域。表单使用显式保存、脏状态切换拦截、启用后展开配置和字段级错误，不增加草稿或发布概念。

## 不包含
- 不实现 Payment Product 和 AI Provider 集合编辑
- 不增加自动保存或统一 Save All；业务域存在未保存修改时显示固定操作栏，移动端避开安全区域

## TODO 清单
- [x] 1. 用纯状态测试和真实浏览器测试覆盖路由、Tab、显式保存、脏状态、字段错误和冲突保留输入，删除读取 Svelte 源码并搜索字符串的弱测试
- [x] 2. 实现 Configuration 布局、水平 Tab、默认重定向和 Admin 导航入口，并从管理员账号入口明确链接到 Account / Security
- [x] 3. 完成 General、Authentication、Email、Storage、Credits、Affiliate 六个单例域表单，所有字段严格对应 API Contract，不保留旧 ENV 或页面私有配置模型
- [x] 4. 完成 Secret 的 keep、replace、remove、待删除和撤销交互；浏览器永远不接收已保存明文、密文、IV 或伪掩码值
- [x] 5. 完成脏状态固定操作栏和跨 Tab 离开确认；用户可选择保存后离开、放弃后离开或取消导航，保存失败时停留并保留输入
- [x] 6. 完成保存成功 Toast、首个字段错误聚焦、`CONFIG_CONFLICT` 保留输入与刷新入口，并通过双页面并发更新验证冲突
- [x] 7. 所有可关闭配置区默认收起、开启时展开、关闭时可独立展开预配置；完成 OAuth Callback URL 复制、英文 i18n、页面标题和 Admin Console 文档

## 验收测试步骤
1. 登录后台进入 Configuration，逐个切换六个 Tab，确认路由稳定且当前业务域清晰
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
- [x] 1. 补齐真实本地首次安装、六个 Configuration 单例域、Payment Product、AI Provider 和 OAuth API Access E2E；禁止用单测、构建、mock 或直接数据库写入替代用户流程
- [x] 2. 更新 `CREATE_OPCSTACK_APP.md`、`QUICK_START.md`、README、模板文档、公开中英文文档和 `AGENTS.md`，统一初始化、首次后台配置、Provider 和 OAuth API Access 用户旅程
- [x] 3. 清理 ENV 文件、Wrangler 模板、准备脚本、生成配置和文档中的全部旧业务配置残留
- [x] 4. 从空本地数据通过真实浏览器验证初始密码只显示一次、管理员登录并修改邮箱和密码、按域保存、刷新持久化和前台立即生效
- [x] 5. 通过公开 HTTP 验证 `opc-cli` PKCE / 设备授权、获批 scope 调用、未获批 scope 拒绝、Grant 撤销后 Access / Refresh Token 失效和两个不同名称、不同地址连接的凭据互不覆盖
- [x] 6. 修正并验证生产扩展 Host Permission；运行完整类型检查、单元测试、构建、配置准备、本地浏览器 E2E 和本地 HTTP E2E
- [x] 7. 对真实已部署 Cloudflare 实例执行只通过公开页面和 HTTP API 的管理员 Session、配置读写立即生效、OAuth 授权调用与撤销验收；不得部署、迁移、创建资源或直写远程 D1
- [x] 8. 清理测试名称和 Given 文案中的 `admin api token`，压平预发布 Migration 中旧 Agent 表与 AI 双轨历史，最终搜索确认无旧 API、旧 Schema、旧运行时 ENV 或兼容读取
- [x] 9. 将所有实际执行命令、目标地址、通过结果和无法执行的外部前置条件记录到验收文档；只有真实 Cloudflare 场景通过后才完成本任务

## 验收测试步骤
1. 仅填写技术设计规定的固定资源 ENV，从空数据库启动项目，确认终端只显示一次初始凭据、可登录并修改管理员邮箱和密码，所有可选业务能力明确禁用
2. 通过后台配置一个业务域并通过 OAuth Client 配置另一个业务域，确认保存后新请求立即生效且旧操作快照不变
3. 按 `QUICK_START.md` 和 `CREATE_OPCSTACK_APP.md` 分别走本地与 Cloudflare 引导，确认没有要求填写已迁入 D1 的业务 ENV
4. 全仓搜索旧 ENV、Agent 授权和兼容关键词，确认没有旧逻辑残留
5. 对真实 Cloudflare URL 运行远程 E2E，确认测试只使用公开页面和 HTTP API，且不执行部署、Migration、资源创建或直接 D1 写入
