---
title: Testing
description: Unit tests, BDD cases, E2E tests, remote E2E limits, and test commands
group: Guides
order: 6
---

# Testing

OPCStack uses Vitest for unit and E2E tests. Unit tests live with source code. E2E tests live under `e2e/` and call HTTP APIs against a running app.

The default `pnpm test` command is not just Vitest. It runs TypeScript, Svelte, and unit tests:

```bash
pnpm exec tsc --noEmit -p tsconfig.tsc.json
pnpm exec svelte-check --tsconfig ./tsconfig.json
vitest
```

## Test Layers

| Layer | Location | Command | Purpose |
| --- | --- | --- | --- |
| Type check | `src/`, config | `pnpm test` | Catch TS contract errors |
| Svelte check | `src/frontend/` | `pnpm test` | Catch Svelte component errors |
| Unit tests | `src/**/*.test.ts`, `scripts/**/*.test.mjs` | `pnpm test` | Domain, handler, config, provider, utility behavior |
| Local E2E | `e2e/**/*.test.ts` | `pnpm test:e2e` | HTTP flows against local dev app |
| Remote E2E | `e2e/**/*.test.ts` | `pnpm test:e2e:remote` | HTTP flows against deployed app |

Unit tests do not include `e2e/**`. E2E tests use `vitest.e2e.config.ts`.

## Unit Tests

Unit tests live beside the code they test:

```text
src/backend/payment/index.ts
src/backend/payment/index.test.ts

src/backend/ai/image/gemini/index.ts
src/backend/ai/image/gemini/index.test.ts

src/api-contract/common.ts
src/api-contract/common.test.ts
```

Run all unit checks:

```bash
pnpm test
```

Run one unit test file:

```bash
pnpm exec vitest src/backend/payment/index.test.ts
```

Run one test by name:

```bash
pnpm exec vitest src/backend/payment/index.test.ts -t "checkout"
```

Use existing local style. This repo commonly wraps unit-under-test output in a structured object before assertion:

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

That style makes diffs readable and avoids scattered assertions.

## BDD Helper

Shared BDD helper:

```text
src/backend/testing/bdd.ts
```

It exports:

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

Use it when one behavior has multiple input cases:

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

Keep case names behavioral. A test name should describe what breaks from the user's or caller's point of view.

## Handler Tests

API handler tests should import shared contracts from `src/api-contract/`, not duplicate request or response shapes inside tests.

Good:

```typescript
import type { CreatePaymentCheckoutResponse } from '$apiContract/payment'
```

Bad:

```typescript
type LocalCheckoutResponse = {
  checkout_url: string
}
```

Local response types are acceptable only when the response is deliberately partial for the assertion.

## Config Tests

Config parsing is business logic. Test it directly.

Examples already in the repo:

| File | Purpose |
| --- | --- |
| `scripts/prepare-cloudflare.test.mjs` | Cloudflare config rendering, bindings, async channel secret validation |
| `src/backend/payment/config.test.ts` | Payment product config parsing |
| `src/frontend/lib/i18n/locales.test.ts` | Locale config |

Rules:

- Config errors should fail early
- Do not test by snapshotting large generated files unless the exact output is the behavior
- Test invalid config as directly as valid config

## External Provider Tests

Provider unit tests must not call real external APIs. Stub `fetch`, provider SDK calls, queue bindings, R2 bindings, or D1 calls.

Current provider areas with unit tests:

| Area | Example |
| --- | --- |
| AI | `src/backend/ai/image/openai/index.test.ts` |
| Email | `src/backend/email/resend/index.test.ts` |
| Payment | `src/backend/payment/creem.test.ts` |
| R2 | `src/backend/r2/index.test.ts` |

Test request mapping, response mapping, provider error mapping, and idempotent local state updates. Do not assert implementation noise.

## Queue and Cron Tests

Queue and cron tests call handlers directly.

Existing files:

| File | What it tests |
| --- | --- |
| `src/backend/consumers/ai-image.test.ts` | Image queue task execution and retry |
| `src/backend/consumers/ai-tts.test.ts` | TTS queue task execution and retry |
| `src/backend/consumers/ai-video.test.ts` | Video queue task polling, completion, and retry |
| `src/backend/jobs/index.test.ts` | Scheduled job dispatch and credits cleanup |

For queue tests, fake the Cloudflare message shape enough to verify `ack()` and `retry()`.

For cron tests, pass a `ScheduledController` object with the exact `cron` expression:

```typescript
await handleScheduled(
  { cron: '*/10 * * * *', scheduledTime: 1890000000000 } as ScheduledController,
  env,
  ctx
)
```

## E2E Tests

E2E tests live in:

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

Run local E2E:

```bash
pnpm dev
pnpm test:e2e
```

`pnpm dev` runs Worker and Vite dev servers. Local E2E uses `APP_BASE_URL` from config and normally targets the Vite dev port.

Remote E2E:

```bash
pnpm test:e2e:remote
```

Remote E2E sets `E2E_REMOTE=1` and targets `https://APP_DOMAIN`.

## Remote E2E Limits

Remote E2E must be read-or-call only against an already deployed environment.

Allowed:

- Call public HTTP APIs
- Verify auth gates
- Verify configured features
- Verify deployed client config

Forbidden:

- Running deploy
- Running migrations
- Creating Cloudflare resources
- Changing shard count
- Writing `d1_shards` directly
- Direct remote D1 writes

If a remote test needs admin behavior, call the public admin API with configured admin auth. Do not bypass the application.

## E2E Config

`vitest.e2e.config.ts` reads public env and selected secret values, then exposes them as `E2E_*` test env vars.

Important derived values:

| E2E env | Meaning |
| --- | --- |
| `APP_BASE_URL` | Local or remote app base URL |
| `E2E_REMOTE` | `1` for remote runs |
| `E2E_ADMIN_EMAIL` | Administrator email used for admin session tests |
| `E2E_ADMIN_PASSWORD` | Administrator password used for admin session tests |
| `E2E_R2_ENABLED` | Whether R2 tests can run |
| `E2E_PAYMENT_ENABLED` | Whether payment tests can run |
| `E2E_D1_SHARD_COUNT` | Expected shard count for sharding tests |

Tests should skip feature-specific flows when the feature is disabled. A disabled feature is not a failing deployment.

## TDD Rules

For feature work:

1. Write the E2E test that defines the user-visible behavior
2. Split the implementation into modules
3. For each module, write a failing unit test
4. Write the smallest production code to pass it
5. Refactor only while tests stay green
6. Run the E2E test after modules are wired together

For bug fixes:

1. Write a failing test that reproduces the bug
2. Fix the bug with the smallest change
3. Keep the regression test

Do not write production code first and then decorate it with tests. That creates tests that prove the implementation, not the requirement.

## Commands

```bash
# Full local unit gate
pnpm test

# One unit file
pnpm exec vitest src/backend/credits/index.test.ts

# One named test
pnpm exec vitest src/backend/credits/index.test.ts -t "daily"

# Local E2E
pnpm test:e2e

# Remote E2E
pnpm test:e2e:remote
```

Before tests that depend on generated `Env` bindings:

```bash
pnpm prepare:cloudflare:dev
pnpm exec wrangler types --config .wrangler/wrangler.types.jsonc --env-file .wrangler/runtime-secrets.env --strict-vars false
```

## Common Mistakes

**Using the wrong BDD helper path**

The helper is `src/backend/testing/bdd.ts`, not `src/testing/bdd.ts`.

**Testing provider integrations with live API calls**

Unit tests should stub provider calls. Live providers are flaky, slow, and expensive.

**Adding local contract types in handler tests**

Use `src/api-contract/` so tests catch contract drift.

**Running remote E2E as deployment automation**

Remote E2E verifies an existing deployment. It must not prepare resources or mutate infrastructure.

**Testing multiple behaviors in one test**

If the test name needs "and", split it.

**Over-mocking the unit under test**

Mock external edges. Do not mock the function whose behavior you are trying to prove.
