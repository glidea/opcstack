---
title: Frontend
description: Web app, shared UI, i18n, prerendering, SEO, and Chrome extension
group: Guides
group_order: 1
order: 9
---

# Frontend

OPCStack has two frontend entrypoints: the SvelteKit web app and the WXT Chrome extension. They share UI, config, i18n, and API client code through `src/frontend/lib/`.

The rule is simple: shared frontend code belongs in `lib/`; entrypoint-specific code stays in `web/` or `extension/`.

## Multi-entrypoint Architecture

```text
src/frontend/
  lib/
    app-ui/
    config/
    i18n/
    styles/
    ui/
  web/
    routes/
    hooks.server.ts
    app.html
    static/
  extension/
    entrypoints/
    public/
    wxt.config.ts
```

`src/frontend/lib/` must not depend on SvelteKit route files, server-only APIs, or WXT-only APIs. The web app and extension can import from `lib/`, but `lib/` should not import back from either entrypoint.

The important aliases:

| Alias | Points to | Used for |
| --- | --- | --- |
| `$frontend` | `src/frontend/lib` | UI, config, i18n, styles |
| `$apiContract` | `src/api-contract` | Typed API client and shared request/response types |
| `$backend` | `src/backend` | Server-only imports |

## Directory Layout

`src/frontend/lib/ui/` contains reusable UI primitives. These are shadcn-svelte style primitives such as `Button`, `Card`, `Dialog`, `Alert`, `Empty`, inputs, tables, dropdowns, and form controls.

`src/frontend/lib/app-ui/` contains composed business UI. Current groups:

| Directory | Purpose |
| --- | --- |
| `auth/` | Login, register, OTP, reset password, Turnstile, legal copy |
| `shell/` | App header, user menu, theme switcher, locale switcher |
| `landing/` | Landing page visual blocks |

`src/frontend/web/routes/` contains SvelteKit routes. Most business pages should live under `[locale=locale]/` so the URL carries the locale.

`src/frontend/extension/entrypoints/` contains WXT entrypoints:

| Entrypoint | Purpose |
| --- | --- |
| `background.ts` | Background worker and message listener |
| `page.content.ts` | Content script matched by extension host permissions |
| `popup/` | Extension popup UI |
| `options/` | Extension options UI |

## Adding a Page

Add localized business pages under `src/frontend/web/routes/[locale=locale]/`.

Example:

```text
src/frontend/web/routes/[locale=locale]/settings/+page.svelte
```

Use typed props for `data`:

```svelte
<script lang="ts">
	let {
		data
	}: {
		data: {
			locale: string
			siteName: string
			canonicalUrl: string
		}
	} = $props()
</script>
```

Use `<svelte:head>` on business pages:

```svelte
<svelte:head>
	<title>{title} - {data.siteName}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={data.canonicalUrl} />
</svelte:head>
```

Reuse existing primitives and app UI:

```svelte
<script lang="ts">
	import AppHeader from '$frontend/app-ui/shell/AppHeader.svelte'
	import { Button } from '$frontend/ui/button'
</script>
```

Do not rebuild primitives that already exist. Use the components from `$frontend/ui/*` and `$frontend/app-ui/*`.

## UI Primitives

Use `$frontend/ui/*` for low-level UI:

- `button`
- `card`
- `dialog`
- `alert`
- `empty`
- `field`
- `input`
- `table`
- `dropdown-menu`

If a list can be empty, use the `Empty` family from `$frontend/ui/empty`. Do not render plain ad hoc empty text.

Use icons from `@lucide/svelte`. Do not add another icon library.

## App UI Components

Auth UI already exists in `src/frontend/lib/app-ui/auth/`:

| Component | Purpose |
| --- | --- |
| `LoginCard` | Email/password login and social login buttons |
| `RegisterCard` | Email signup and optional OTP trigger |
| `OtpCard` | Email OTP input and resend cooldown |
| `ForgotPasswordCard` | Request password reset |
| `ResetPasswordCard` | Reset password with OTP |
| `Turnstile` | Cloudflare Turnstile widget wrapper |
| `LegalDisclosure` | Terms, privacy, and optional refund links |

Shell UI lives in `src/frontend/lib/app-ui/shell/`:

| Component | Purpose |
| --- | --- |
| `AppHeader` | Top navigation |
| `UserMenu` | Current user avatar, settings, sign out |
| `ThemeSwitcher` | Theme mode control |
| `LocaleSwitcher` | Locale switching |

Business pages should compose these components instead of copying their internals.

## Typed API Client

The frontend imports `client` from `$apiContract/client`. Do not instantiate `createAuthClient` directly in pages.

Web app default:

```ts
import { client } from '$apiContract/client'

await client.auth.signIn.email({ email, password })
await client.auth.signOut()

const session = client.auth.useSession()
```

The default browser client uses cookies and bookmark cookies:

```ts
export const client = createClient({
	baseUrl: typeof window === 'undefined' ? '' : window.location.origin,
	auth: { type: 'cookie' },
	bookmarks: { type: 'cookie' }
})
```

Extension code creates a token-based client:

```ts
const client = createClient({
	baseUrl: clientConfig.apiBaseUrl,
	auth: { type: 'token', storage: tokenStorage },
	bookmarks: { type: 'storage', storage: createMemoryBookmarkStorage() }
})
```

Business APIs are available under `client.api.*`, for example:

```ts
await client.api.getCreditSummary()
await client.api.listNotifications({ page: 1, page_size: 20 })
```

The client also carries D1 bookmark headers between requests, so pages should not manage `x-d1-meta-bookmark` or `x-d1-tenant-bookmark` manually.

## i18n

OPCStack uses `svelte-i18n`.

Messages live in:

```text
src/frontend/lib/i18n/messages/en.json
src/frontend/lib/i18n/messages/zh.json
```

The locale is carried by the route segment:

```text
/:locale/...
```

The `[locale=locale]` route parameter uses `src/frontend/web/params/locale.ts` to accept only supported locales. Current supported locales are `en` and `zh`.

Use `$_('key')` in Svelte components:

```svelte
<script lang="ts">
	import { _ } from '$frontend/i18n'
</script>

<h1>{$_('settings.title')}</h1>
```

`src/frontend/web/hooks.server.ts` redirects non-localized pages to the best locale based on `Accept-Language`, unless the path is an API, asset, legal page, robots, sitemap, favicon, manifest, or internal Cloudflare path.

## Styling and Design System

Global styles live in `src/frontend/lib/styles/app.css`. The root layout imports it once:

```ts
import '$frontend/styles/app.css'
```

The active design system comes from the General configuration saved in Meta D1:

```json
{"design_system":"apple-saas","docs_enabled":true}
```

Supported values in CSS:

```text
apple-saas
brutalism
```

The selected design is written to `<html data-design="...">` by the SvelteKit hook and the client layout. `demo-design/[theme]` can override it by URL.

Use semantic Tailwind tokens instead of raw colors in page code:

```svelte
<div class="border border-border bg-background text-foreground">
	<p class="text-muted-foreground">...</p>
</div>
```

Concrete values for colors, radius, typography, shadows, and design-specific overrides belong in `app.css`, not scattered across pages.

## Public Config

Frontend config is generated into:

```text
src/frontend/lib/config/client.generated.ts
```

Import it through:

```ts
import { clientConfig } from '$frontend/config/client'
```

`scripts/prepare-public.mjs` generates the file from long-lived deployment env. It also prepares web logo and extension icons. Business settings are loaded from `PublicRuntimeConfig` after the Worker starts.

Common fields:

| Field | Used for |
| --- | --- |
| `appName` | Titles, extension manifest, app UI |
| `appVersion` | Extension manifest |
| `apiBaseUrl` | Extension API client |
| `webBaseUrl` | Canonical URLs and extension navigation |
| `extension.hostPermissions` | WXT manifest and content script matches |

Runtime settings such as support email, design system, auth switches, docs, Turnstile, and payment are loaded from D1 through `PublicRuntimeConfig`. Frontend code must not read secret env files or add an env fallback for these fields.

## Prerender

Use `export const prerender = true` only when the page has:

- no per-request server data
- no auth
- no dynamic DB query
- identical content for all visitors

Current prerendered routes:

| Route | Reason |
| --- | --- |
| `robots.txt` | Static text generated from public config |
| `sitemap.xml` | Static route and docs index |
| `/[locale]/docs/*` | Markdown docs from `public-docs/` |
| `/[locale]/demo-design/[theme]` | Static design preview entries |

Dynamic params need `entries()`. Docs generate all `{ locale, slug }` pairs from the docs manifest. Design demo generates all `{ locale, theme }` pairs from supported locales and theme names.

Do not prerender pages that depend on Better Auth session, user-specific API calls, or per-request database reads.

## SEO

`src/frontend/web/routes/+layout.server.ts` provides shared SEO data:

- `siteName`
- `supportEmail`
- `siteUrl`
- `logoUrl`
- `canonicalUrl`
- `alternateUrls`
- `xDefaultUrl`
- `websiteJsonLd`

Business pages should set:

```svelte
<svelte:head>
	<title>{title} - {data.siteName}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={data.canonicalUrl} />
</svelte:head>
```

Docs pages also set alternate locale links and Open Graph/Twitter metadata.

Canonical URLs are built from `clientConfig.webBaseUrl`, which is generated from `APP_DOMAIN`. Do not hardcode OPCStack website URLs into business pages.

## Public Docs

Product docs rendered by the web app live in:

```text
public-docs/en/
public-docs/zh/
```

Docs route:

```text
/:locale/docs/[...slug]
```

Docs are enabled by the General configuration in Meta D1:

```json
{"docs_enabled":true}
```

Markdown files use frontmatter:

```md
---
title: Authentication
description: Email and Google sign in configuration
group: Guides
order: 1
---
```

Docs images should live under `src/frontend/web/static/images/` and be referenced as `/images/...`.

Syntax highlighting uses Shiki's JavaScript regex engine. Do not switch the request-time renderer to the Oniguruma WASM engine because Cloudflare Workers reject runtime WASM compilation.

`template-docs/` is different. It is for template maintainers and agents, not rendered by the app.

## Chrome Extension

The extension uses WXT with Manifest V3:

```bash
pnpm dev:extension
pnpm build:extension
```

Both commands run `prepare:public:*` first, so `client.generated.ts`, icons, and public config are available.

`src/frontend/extension/wxt.config.ts` builds the manifest from `clientConfig`:

| Manifest field | Source |
| --- | --- |
| `name` | `clientConfig.appName` |
| `version` | `clientConfig.appVersion` |
| `description` | `${clientConfig.appName} browser extension` |
| `host_permissions` | `clientConfig.extension.hostPermissions` |
| `icons` | Generated icons in `src/frontend/extension/public/icons/` |

Extension entrypoints:

| File | Purpose |
| --- | --- |
| `background.ts` | Handles runtime messages |
| `page.content.ts` | Sends a content ping from matched pages |
| `popup/Popup.svelte` | Token-based client example |
| `options/Options.svelte` | Basic options page |

The extension imports `$frontend` from `src/frontend/lib/`. Keep extension-only APIs such as `wxt/browser` inside `src/frontend/extension/`.

## Common Mistakes

**Importing web routes from shared lib.** `src/frontend/lib/` must not import from `src/frontend/web/` or `src/frontend/extension/`. Shared code should be reusable by both.

**Creating a raw auth client in pages.** Use `$apiContract/client`. It already handles auth mode, token sync, and D1 bookmarks.

**Forgetting localized routes.** Business pages should usually be under `[locale=locale]/`, not at the root. Root-level pages are for legal/static exceptions.

**Prerendering authenticated pages.** Anything depending on session or user-specific data should not set `prerender = true`.

**Hardcoding public config.** Use `clientConfig` only for deployment identity and extension packaging. Add user-managed runtime values to D1 and `PublicRuntimeConfig`; do not add an env fallback or read secret env files in frontend code.

**Duplicating UI primitives.** If `Button`, `Dialog`, `Alert`, `Empty`, `Field`, `Input`, or table primitives already exist, use them.
