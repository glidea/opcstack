---
title: 测试
description: 单元测试、BDD 用例、E2E 测试、远端 E2E 限制与测试命令
group: Guides
group_order: 1
order: 6
---

# 测试

OPCStack 使用 Vitest 进行单元测试和 E2E 测试。单元测试与源代码放在一起。E2E 测试放在 `e2e/` 目录下，调用运行中的应用的 HTTP API。

默认的 `pnpm test` 命令不仅仅是 Vitest，它还运行 TypeScript、Svelte 和单元测试：

```bash
pnpm exec tsc --noEmit -p tsconfig.tsc.json
pnpm exec svelte-check --tsconfig ./tsconfig.json
vitest
```

## 测试层次

| 层次 | 位置 | 命令 | 用途 |
| --- | --- | --- | --- |
| 类型检查 | `src/`、配置 | `pnpm test` | 捕获 TS 契约错误 |
| Svelte 检查 | `src/frontend/` | `pnpm test` | 捕获 Svelte 组件错误 |
| 单元测试 | `src/**/*.test.ts`、`scripts/**/*.test.mjs` | `pnpm test` | 领域、处理器、配置、provider、工具函数行为 |
| 本地 E2E | `e2e/**/*.test.ts` | `pnpm test:e2e` | 对本地开发应用的 HTTP 流程 |
| 远端 E2E | `e2e/**/*.test.ts` | `pnpm test:e2e:remote` | 对已部署应用的 HTTP 流程 |

单元测试不包含 `e2e/**`。E2E 测试使用 `vitest.e2e.config.ts`。

## 单元测试

单元测试与被测代码放在一起：

```text
src/backend/payment/index.ts
src/backend/payment/index.test.ts

src/backend/ai/image/gemini/index.ts
src/backend/ai/image/gemini/index.test.ts

src/api-contract/common.ts
src/api-contract/common.test.ts
```

运行所有单元检查：

```bash
pnpm test
```

运行单个单元测试文件：

```bash
pnpm exec vitest src/backend/payment/index.test.ts
```

按名称运行单个测试：

```bash
pnpm exec vitest src/backend/payment/index.test.ts -t "checkout"
```

遵循现有的本地风格。这个项目通常将被测输出包装在结构化对象中再断言：

```typescript
type ThenExpected = {
  result: number
}

const actual: ThenExpected = {
  result: add(1, 2)
}

expect(actual).toEqual({
  result: 3
})
```

这种风格让 diff 可读，避免分散的断言。

## BDD 辅助工具

共享 BDD 辅助工具：

```text
src/backend/testing/bdd.ts
```

导出内容：

```typescript
export type TestCase<TGiven, TWhen, TThen> = {
  scenario: string
  given: string
  when: string
  then: string
  timeoutMs?: number
  givenDetail: TGiven
  whenDetail: TWhen
  thenExpected: TThen
}

export function runCases<TGiven, TWhen, TThen>(
  cases: TestCase<TGiven, TWhen, TThen>[],
  fn: (given: TGiven, when: TWhen) => TThen | Promise<TThen>
): void
```

当一个行为有多个输入用例时使用它：

```typescript
import { describe } from 'vitest'
import { runCases, type TestCase } from '$backend/testing/bdd'

function add(a: number, b: number): number {
  return a + b
}

type GivenDetail = Record<string, never>
type WhenDetail = { a: number; b: number }
type ThenExpected = { result: number }

describe('add', () => {
  const cases: TestCase<GivenDetail, WhenDetail, ThenExpected>[] = [
    {
      scenario: 'add positive numbers',
      given: 'two positive integers',
      when: 'adding them',
      then: 'returns their sum',
      givenDetail: {},
      whenDetail: { a: 1, b: 2 },
      thenExpected: { result: 3 }
    }
  ]

  runCases(cases, (_given, when): ThenExpected => {
    return { result: add(when.a, when.b) }
  })
})
```

保持用例名称面向行为。测试名称应描述从用户或调用者角度来看哪里出了问题。

## 处理器测试

API 处理器测试应从 `src/api-contract/` 导入共享契约，而不是在测试内部重复定义请求或响应格式。

推荐做法：

```typescript
import type { CreatePaymentCheckoutResponse } from '$apiContract/payment'
```

不推荐做法：

```typescript
type LocalCheckoutResponse = {
  checkout_url: string
}
```

只有当响应有意对断言进行部分提取时，本地响应类型才可以接受。

## 配置测试

配置解析是业务逻辑，直接测试它。

项目中已有的例子：

| 文件 | 用途 |
| --- | --- |
| `scripts/prepare-cloudflare.test.mjs` | Cloudflare 配置渲染、bindings、fallback 密钥校验 |
| `src/backend/payment/config.test.ts` | 支付产品配置解析 |
| `src/frontend/lib/i18n/locales.test.ts` | 语言区域配置 |

规则：

- 配置错误应尽早失败
- 不要通过快照大型生成文件来测试，除非精确输出本身就是被测行为
- 对无效配置的测试与有效配置同等重要

## 外部 Provider 测试

Provider 单元测试不能调用真实的外部 API。对 `fetch`、provider SDK 调用、队列 binding、R2 binding 或 D1 调用进行 stub。

当前有单元测试的 provider 区域：

| 区域 | 示例 |
| --- | --- |
| AI | `src/backend/ai/image/openai/index.test.ts` |
| Email | `src/backend/email/resend/index.test.ts` |
| Payment | `src/backend/payment/creem.test.ts` |
| R2 | `src/backend/r2/index.test.ts` |

测试请求映射、响应映射、provider 错误映射和幂等本地状态更新。不要断言实现细节。

## 队列与 Cron 测试

队列和 cron 测试直接调用处理器。

现有文件：

| 文件 | 测试内容 |
| --- | --- |
| `src/backend/consumers/ai-image.test.ts` | 图像队列任务执行和重试 |
| `src/backend/consumers/ai-tts.test.ts` | TTS 队列任务执行和重试 |
| `src/backend/consumers/ai-video.test.ts` | 视频队列任务轮询、完成和重试 |
| `src/backend/jobs/index.test.ts` | 定时任务分发和积分清理 |

队列测试中，伪造 Cloudflare 消息格式，足以验证 `ack()` 和 `retry()` 即可。

Cron 测试中，传入带有精确 `cron` 表达式的 `ScheduledController` 对象：

```typescript
await handleScheduled(
  { cron: '*/10 * * * *', scheduledTime: 1890000000000 } as ScheduledController,
  env,
  ctx
)
```

## E2E 测试

E2E 测试放在：

```text
e2e/
  aff.test.ts
  auth-email.test.ts
  beta.test.ts
  client-config.test.ts
  credits.test.ts
  feedback.test.ts
  notification.test.ts
  payment.test.ts
  r2.test.ts
  sharding.test.ts
```

运行本地 E2E：

```bash
pnpm dev
pnpm test:e2e
```

`pnpm dev` 运行 Worker 和 Vite 开发服务器。本地 E2E 使用配置中的 `APP_BASE_URL`，通常指向 Vite 开发端口。

远端 E2E：

```bash
pnpm test:e2e:remote
```

远端 E2E 设置 `E2E_REMOTE=1` 并指向 `https://APP_DOMAIN`。

## 远端 E2E 限制

远端 E2E 只能对已部署的环境进行只读或调用操作。

允许：

- 调用公共 HTTP API
- 验证认证门控
- 验证已配置的功能
- 验证已部署的客户端配置

禁止：

- 执行部署
- 运行迁移
- 创建 Cloudflare 资源
- 修改分片数量
- 直接写入 `d1_shards`
- 直接写入远端 D1

如果远端测试需要管理员操作，通过公共管理员 API 配合管理员认证调用。不要绕过应用程序。

## E2E 配置

`vitest.e2e.config.ts` 读取公共环境变量和部分密钥值，然后将其作为 `E2E_*` 测试环境变量暴露出去。

重要的派生值：

| E2E 环境变量 | 含义 |
| --- | --- |
| `APP_BASE_URL` | 本地或远端应用的 base URL |
| `E2E_REMOTE` | 远端运行时为 `1` |
| `E2E_ADMIN_EMAIL` | 管理员 Session 测试使用的管理员邮箱 |
| `E2E_ADMIN_PASSWORD` | 管理员 Session 测试使用的管理员密码 |
| `E2E_R2_ENABLED` | R2 测试是否可以运行 |
| `E2E_PAYMENT_ENABLED` | 支付测试是否可以运行 |
| `E2E_D1_SHARD_COUNT` | 分片测试预期的分片数量 |

功能被禁用时，测试应跳过该功能相关的流程。功能被禁用不等于部署失败。

## TDD 规则

功能开发：

1. 先写定义用户可见行为的 E2E 测试
2. 将实现拆分为模块
3. 对每个模块写一个失败的单元测试
4. 写最小的生产代码使其通过
5. 只在测试保持绿色的情况下重构
6. 模块组装完成后运行 E2E 测试

缺陷修复：

1. 写一个复现 bug 的失败测试
2. 用最小的改动修复 bug
3. 保留回归测试

不要先写生产代码再补测试。那样会创建证明实现的测试，而不是证明需求的测试。

## 命令

```bash
# 完整的本地单元检查
pnpm test

# 单个单元测试文件
pnpm exec vitest src/backend/credits/index.test.ts

# 按名称运行单个测试
pnpm exec vitest src/backend/credits/index.test.ts -t "daily"

# 本地 E2E
pnpm test:e2e

# 远端 E2E
pnpm test:e2e:remote
```

依赖生成的 `Env` bindings 的测试运行前：

```bash
pnpm prepare:cloudflare:dev
pnpm exec wrangler types --config .wrangler/wrangler.types.jsonc --env-file .wrangler/runtime-secrets.env --strict-vars false
```

## 常见错误

**使用错误的 BDD 辅助工具路径。** 辅助工具在 `src/backend/testing/bdd.ts`，不是 `src/testing/bdd.ts`。

**用真实 API 调用测试 provider 集成。** 单元测试应 stub provider 调用。真实 provider 不稳定、慢且昂贵。

**在处理器测试中添加本地契约类型。** 使用 `src/api-contract/`，这样测试能捕获契约漂移。

**将远端 E2E 作为部署自动化运行。** 远端 E2E 验证已有的部署，不能准备资源或修改基础设施。

**在一个测试中测试多个行为。** 如果测试名称需要"并且"，把它拆分。

**对被测单元过度 mock。** mock 外部边界，不要 mock 你要证明其行为的函数。
