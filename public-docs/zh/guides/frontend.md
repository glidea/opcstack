---
title: 前端
description: Web 应用、共享 UI、国际化、预渲染、SEO 以及 Chrome 插件
group: Guides
group_order: 1
order: 9
---

# 前端

OpcStack 的前端架构优先考虑简单性以及类型安全，主要基于 **SvelteKit** 和 **Tailwind CSS**。

在 `src/frontend` 目录下有两个主要的子项目：

1. **`src/frontend/web`**：主要的 SvelteKit 应用程序。
2. **`src/frontend/lib`**：共享的前端代码、UI 组件、工具函数以及生成的 API 客户端。

---

## 技术栈与设计哲学

### SvelteKit
我们使用 SvelteKit 是因为它符合我们保持简单、快速并紧跟标准 Web 平台特性（HTML、CSS、JS）的哲学。我们 SvelteKit 配置的关键点包括：
- **路由**：基于文件夹的路由。路由对应 `src/frontend/web/routes` 下的目录。
- **服务端加载**：我们使用 SvelteKit 的 `+page.server.ts` 或 `+layout.server.ts`，在 Cloudflare Workers 服务端加载数据。
- **表单操作 (Form Actions)**：表单提交通过 `+page.server.ts` 中的 SvelteKit `actions` 处理，保持标准的 HTML `<form>` 行为，并在可能时提供渐进式增强。

### Tailwind CSS
我们直接在 Svelte 组件中编写标准的 Tailwind 实用类。
- 不要创建抽象的 CSS 类（除非绝对必要，否则避免使用 `@apply`）。
- 保持样式与组件写在一起。

### 设计系统

主题是构建期配置，不属于后台动态配置：

```env
DESIGN_SYSTEM=apple-saas
```

支持 `apple-saas` 和 `brutalism`。修改后必须重新构建并部署，SSR、客户端导航和静态预渲染页面才能使用同一主题。后台系统设置和 D1 不提供第二套主题来源。

### TypeScript 与 Schema 校验
所有的前端组件都使用 TypeScript 编写。表单和传入的参数使用 **Valibot** schema 进行校验，以确保系统边界处的结构和类型安全。

---

## 共享库 (`src/frontend/lib`)

共享库包含在不同页面或模块中复用的组件和逻辑：

### UI 组件 (`src/frontend/lib/components`)
通用的 UI 元素，如按钮、输入框、模态框和布局。这些组件是用 Svelte 和 Tailwind CSS 构建的。

### 国际化与本地化 (`src/frontend/lib/i18n`)
我们使用基于 Svelte 的本地化助手来支持国际化。
- 翻译字符串位于 `src/frontend/lib/i18n/messages/en.json` 和 `src/frontend/lib/i18n/messages/zh.json` 中。
- 动态语言区域通过路由参数处理：`[locale=locale]`。

### 生成的客户端 (`src/frontend/lib/config`)
我们根据后端接口生成 TypeScript API 客户端，以保持端到端的类型安全。
- 这些生成的文件位于 `src/frontend/lib/config/client.generated.ts` 中。
- **不要手动编辑以 `.generated.ts` 结尾的文件**。它们是动态编译生成的。

---

## 状态管理

我们避免使用重度的状态管理库。Svelte 原生的 **stores** 或 Svelte 5 的 **runes**（如果已更新）就足够了。
- **局部状态**：使用 Svelte 的局部变量绑定。
- **全局状态**：使用位于共享库中的标准 Svelte stores，或者在必要时使用 Svelte 的 context API。
- **URL 作为状态**：我们更倾向于将过滤、分页和搜索参数存储在 URL 查询字符串中，利用 SvelteKit 的 page store (`$page.url.searchParams`) 来驱动 UI 更新。

---

## 构建与部署

前端作为统一 of Cloudflare Worker 项目的一部分进行构建和部署。
- 静态资源通过 Vite 进行打包。
- 根据 Worker 配置，静态资源会直接通过 Cloudflare KV/R2 或标准的静态资源路由进行分发和处理。

产品文档的语法高亮使用 Shiki 的 JavaScript 正则引擎。不要把请求时渲染器切换为 Oniguruma WASM 引擎，Cloudflare Workers 会拒绝运行时 WASM 编译。
