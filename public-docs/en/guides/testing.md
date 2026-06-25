---
title: Testing
description: Unit tests and E2E tests
group: Guides
order: 6
---

# Testing

OPC Stack uses Vitest for testing and supports both unit tests and E2E tests.

## Unit tests

### Test files

Unit test files are under `src/**/*.test.ts`.

```typescript
// src/api/handler/users.test.ts
import { describe, it, expect } from 'vitest'
import { app } from './users'

describe('Users API', () => {
  it('should get user by id', async () => {
    const res = await app.request('/api/users/123')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('123')
  })

  it('should return 404 for non-existent user', async () => {
    const res = await app.request('/api/users/999')
    expect(res.status).toBe(404)
  })
})
```

### Run tests

```bash
# Run all tests
pnpm test

# Run one file
pnpm test src/api/handler/users.test.ts

# Watch mode
pnpm test --watch
```

## E2E tests

### Test files

E2E test files are under `e2e/**/*.test.ts`.

```typescript
// e2e/auth.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestClient } from './utils'

describe('Auth E2E', () => {
  let client: ReturnType<typeof createTestClient>

  beforeAll(() => {
    client = createTestClient()
  })

  it('should sign up with email', async () => {
    const res = await client.post('/api/auth/signup', {
      email: 'test@example.com',
      password: 'password123'
    })
    expect(res.status).toBe(200)
    expect(res.data.token).toBeDefined()
  })

  it('should sign in with email', async () => {
    const res = await client.post('/api/auth/signin', {
      email: 'test@example.com',
      password: 'password123'
    })
    expect(res.status).toBe(200)
    expect(res.data.token).toBeDefined()
  })
})
```

### Run E2E tests

```bash
# Run E2E tests
pnpm test:e2e

# Watch mode
pnpm test:e2e --watch
```

## BDD style tests

OPC Stack provides a BDD style test helper in `src/testing/bdd.ts`.

## Mock data

### Mock D1

```typescript
import { describe, it, expect, vi } from 'vitest'

describe('Database operations', () => {
  it('should query users', async () => {
    const mockDB = {
      query: {
        users: {
          findFirst: vi.fn().mockResolvedValue({
            id: '123',
            email: 'test@example.com'
          })
        }
      }
    }

    const user = await mockDB.query.users.findFirst()
    expect(user.id).toBe('123')
  })
})
```

### Mock R2

```typescript
import { describe, it, expect, vi } from 'vitest'

describe('File operations', () => {
  it('should upload file', async () => {
    const mockR2 = {
      put: vi.fn().mockResolvedValue(undefined)
    }

    await mockR2.put('public/logo.png', new Blob())
    expect(mockR2.put).toHaveBeenCalledWith(
      'public/logo.png',
      expect.any(Blob)
    )
  })
})
```

## Test coverage

```bash
# Generate coverage report
pnpm test --coverage

# Open report
open coverage/index.html
```

## Test environment

### Configure test env vars

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: ':memory:',
      CHAT_OPENAI_API_KEY: 'test-key'
    }
  }
})
```

### Use test database

```typescript
import { beforeEach, afterEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'

let db: ReturnType<typeof drizzle>

beforeEach(async () => {
  // Create test database
  db = drizzle(env.DB)
  await db.run(sql`CREATE TABLE users (...)`)
})

afterEach(async () => {
  // Cleanup test data
  await db.run(sql`DROP TABLE users`)
})
```

## Best practices

1. Test isolation: each test should be independent
2. Data cleanup: cleanup created data after each test
3. Mock external services: do not call real external APIs in tests
4. Test boundaries: test both normal and failure paths
5. Keep simple: test code should be easy to read

## FAQ

**Q: Tests run slowly**

Use `--run` to run once and avoid watch mode overhead.

**Q: How to test authenticated API**

Generate test token in tests or mock auth middleware.

**Q: How to test Cron and Queue**

Call handlers directly with mocked event and env.
