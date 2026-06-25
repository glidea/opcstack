---
title: 测试
description: 单元测试和 E2E 测试
group: 指南
order: 6
---

# 测试

OPC Stack 使用 Vitest 进行测试，支持单元测试和 E2E 测试。

## 单元测试

### 测试文件

单元测试文件放在 `src/**/*.test.ts`。

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

### 运行测试

```bash
# 运行所有测试
pnpm test

# 运行单个文件
pnpm test src/api/handler/users.test.ts

# 监听模式
pnpm test --watch
```

## E2E 测试

### 测试文件

E2E 测试文件放在 `e2e/**/*.test.ts`。

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

### 运行 E2E 测试

```bash
# 运行 E2E 测试
pnpm test:e2e

# 监听模式
pnpm test:e2e --watch
```

## BDD 风格测试

OPC Stack 提供 BDD 风格的测试工具，参考 `src/testing/bdd.ts`。

## Mock 数据

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

## 测试覆盖率

```bash
# 生成覆盖率报告
pnpm test --coverage

# 查看报告
open coverage/index.html
```

## 测试环境

### 配置测试环境变量

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

### 使用测试数据库

```typescript
import { beforeEach, afterEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'

let db: ReturnType<typeof drizzle>

beforeEach(async () => {
  // 创建测试数据库
  db = drizzle(env.DB)
  await db.run(sql`CREATE TABLE users (...)`)
})

afterEach(async () => {
  // 清理测试数据
  await db.run(sql`DROP TABLE users`)
})
```

## 最佳实践

1. **测试隔离**：每个测试应该独立，不依赖其他测试
2. **清理数据**：测试后清理创建的数据
3. **Mock 外部服务**：不要在测试中调用真实的外部 API
4. **测试边界条件**：测试正常情况和异常情况
5. **保持简单**：测试代码应该简单易懂

## 常见问题

**Q: 测试运行很慢？**

使用 `--run` 标志运行单次测试，避免监听模式。

**Q: 如何测试需要认证的 API？**

在测试中生成测试 token，或者 mock 认证中间件。

**Q: 如何测试 Cron 和 Queue？**

直接调用 handler 函数，传入 mock 的 event 和 env。
