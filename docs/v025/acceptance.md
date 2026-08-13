# v025 动态配置验收记录

本文只记录在当前代码上实际执行过的命令和结果，不记录 Secret 或一次性管理员凭据。

## Task-009 Payment 与 AI 配置界面

- `pnpm exec vitest run src/api-contract/configuration.test.ts src/backend/config/index.test.ts src/backend/ai/config.test.ts src/backend/payment/config.test.ts src/backend/api/handler/configuration-ai.test.ts src/backend/api/handler/configuration-payment.test.ts src/backend/api/handler/configuration.test.ts "src/frontend/web/routes/[locale=locale]/admin/admin-navigation.test.ts" "src/frontend/web/routes/[locale=locale]/admin/admin-layout.test.ts" "src/frontend/web/routes/[locale=locale]/admin/payment-products/payment-products-page.test.ts" "src/frontend/web/routes/[locale=locale]/admin/ai-providers/ai-providers-page.test.ts"`
  - 通过当前配置契约、支付运行时、导航、布局和两个独立工作区测试
- `pnpm test:e2e:first-run`
  - 使用临时检出目录和空本地 D1 运行通过
  - 浏览器流程验证首次管理员凭据只显示一次、登录、修改密码、OAuth 登录账号和 API Access 内嵌管理、全部 Configuration Tab、显式保存、冲突处理、Payment Product 与 AI Provider 的创建、编辑、停用、删除、Secret 脱敏和独立草稿
  - 公开 HTTP 流程验证默认禁用配置、OAuth PKCE、已授权 scope 调用、未授权 scope 返回 `403`、Grant 撤销后 Access Token 与 Refresh Token 失效

## Task-010 本地完整验收

- `CI=1 pnpm test`
  - TypeScript 检查通过
  - Svelte 检查通过，0 error、0 warning
  - 通过 91 个测试文件、599 个测试
- `pnpm exec vite build`
  - Web 生产构建通过
- `pnpm build:extension`
  - Chrome 扩展生产构建通过
  - Manifest 的 `host_permissions` 只有 `https://opcstack.glidea.app/*`
- `pnpm test:e2e:first-run`
	- 从空数据启动两个隔离的本地项目，分别使用 `http://localhost:5173` 和 `http://localhost:5174`
	- 首次准备、重复准备、Playwright 浏览器流程和本地 HTTP E2E 全部通过
	- 通过 1 个首次启动浏览器测试、1 个首次启动 HTTP 测试和 43 个本地 HTTP E2E；9 个不属于该轮条件的场景按显式条件跳过
	- 额外通过 1 个真实 CLI OAuth E2E：两个项目分别执行 `opc auth connect`，连接按名称独立保存，已授权 API 调用成功，未授权 API 返回 `403`，Grant 撤销后 Access Token 与 Refresh Token 失效且只删除被撤销项目的连接
- `rg` 最终残留扫描
	- 范围包含当前可执行源码、测试、脚本、`AGENTS.md`、创建引导、README、模板文档、公开文档、ENV 和 Wrangler 模板
	- 最终 Schema 与 Migration 单独扫描
	- 未发现 `ADMIN_API_TOKEN`、`ai_channels`、旧 Agent 授权命名、Channel Router、旧 Schema 或兼容读取
	- 历史版本设计文档和 Wrangler 忽略缓存不属于当前运行时，不纳入残留判定
- 当前工作目录直接运行 `pnpm prepare:cloudflare:dev` 会因为旧本地 D1 已应用压平前 Migration 而报 `table aff_referrals already exists`
  - 项目尚未发布，不保留旧本地数据库兼容逻辑
  - 空临时目录中的首次准备和第二次重复准备均已通过，证明最终 Migration 可从空库启动且可重复执行

## Task-010 真实 Cloudflare 验收

- 目标地址：`https://opcstack.glidea.app`
- 部署结果
  - Worker Version：`5547fbcc-63b5-4b1d-84bf-1ded0081aa0b`
  - 从空远程 D1 应用最终压平 Migration，并完成系统配置、OAuth Client、Shard Registry 和初始管理员初始化
  - 三个内部根密钥由准备脚本首次生成并写入 Cloudflare Worker Secrets
- 管理员凭据轮换
  - 使用初始凭据通过公开 Better Auth API 登录并修改密码
  - 新密码登录返回 `200`，旧密码登录返回 `401`
  - 当前凭据只保存于本地忽略文件 `.wrangler/remote-admin-credentials.json`，权限为 `0600`
- `E2E_REMOTE=1 pnpm exec vitest --config vitest.e2e.config.ts e2e/deployed-configuration.test.ts`
  - 通过 1 个文件、4 个测试
  - `/api/health` 返回 `200`
  - Configuration 深链接正确重定向登录页
  - OAuth Authorization Request 对非法 PKCE 请求返回 `400`
  - 管理员 Session 成功读取并保存 General 配置，携带 D1 bookmark 的下一次前台请求立即使用新文档开关
  - Design System 只由 `DESIGN_SYSTEM` ENV 决定，后台与 General API 不再暴露主题字段
  - OAuth PKCE 授权后可调用获批的 Credits API，未获批 AI API 返回 `403`
  - OAuth Token 可读取 Credits 配置，撤销 Grant 后 Access Token 返回 `401` 且 Refresh Token 无法刷新
  - 测试在 finally 中恢复 General 原值
- `pnpm test:e2e:remote`
  - 通过 12 个测试文件、41 个测试；4 个文件、11 个不适用于远程禁用配置的场景按显式条件跳过
- In-App Browser 真实浏览器流程
  - 未配置 Email Provider 时登录页不显示忘记密码入口
  - 使用轮换后的管理员密码登录成功
  - Configuration 的 General、Authentication、Email、Credits、Affiliate、Payment、AI 七个业务 Tab 均可访问，Storage 不在动态配置中出现
  - Email Tab 明确显示 `Not configured`，Settings 页面显示登录方式、密码和 API Access
  - 浏览器中残留的旧远程 D1 bookmark 在预发布数据库重建后失效；删除该站点旧 bookmark 后新部署页面正常。这是本轮预发布 D1 重建产生的一次性测试状态，不增加兼容逻辑
- 远程验收只使用公开页面和 HTTP API，没有由测试执行部署、Migration、资源创建或直接 D1 写入

## Task-011 主题来源与通知生命周期

- Design System 已从 D1、General API 和后台表单移除，只由构建期 `DESIGN_SYSTEM` ENV 生成
- 通知支持编辑和归档；用户查询排除已归档通知，后台历史保留并显示归档状态
- 通知详情不再显示内部通知 ID，归档确认在详情面板内完成，不叠加弹窗

## Task-012/013 后台导航、配置实体与认证交互收口

- `pnpm test:e2e:first-run`
	- 通过 1 个真实浏览器首轮测试
	- 通过 1 个本地 HTTP 首轮测试文件、43 个测试；10 个不适用场景按显式条件跳过
	- 浏览器覆盖首次管理员密码修改、OAuth 账号与 API Access 管理、七个配置域、配置保存与冲突、Payment Product 创建/编辑/冲突/删除、AI Provider 创建/停用/冲突/删除、认证配置层级、Turnstile 凭据只读、OAuth Callback URL 复制、通知编辑/归档、用户详情技术字段清理和后台列表布局
- `CI=1 pnpm test`
	- 通过类型检查、Svelte 检查和 92 个测试文件、609 个测试，0 error、0 warning
- `pnpm exec vite build`
	- Web SSR 和客户端生产构建通过
- `pnpm build:extension`
	- Chrome MV3 扩展生产构建和打包通过

本轮只执行本地验收，未部署线上。

## Task-014 管理员账号与存储策略来源收口

- `pnpm test -- --run`
  - TypeScript 检查通过
  - Svelte 检查通过，0 error、0 warning
  - 通过 92 个测试文件、601 个测试
- `pnpm exec vite build --mode dev`
  - Web SSR 和客户端构建通过
- `pnpm build:extension`
  - Chrome MV3 扩展生产构建和打包通过
- `pnpm test:e2e:first-run`
  - 从空数据创建隔离项目并完成真实首次准备和重复准备
  - 通过 1 个 Playwright 管理员浏览器流程、1 个首次运行 HTTP 测试、43 个本地 HTTP E2E 和 1 个真实 CLI OAuth E2E
  - 浏览器验证设置页没有邮箱修改入口，密码修改、OAuth 账号、API Grant、七个动态配置域、Payment Product 和 AI Provider 均可操作
  - System Settings 不存在 Storage Tab；上传 MIME 类型和最大大小只从固定 ENV 读取
- 最终残留扫描
  - 当前 Schema、Migration、配置契约、管理 API、Scope、页面和文档均不存在 Storage 动态配置或管理员邮箱修改链路

本轮只执行本地验收，未部署线上。
