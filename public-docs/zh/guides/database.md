---
title: 数据库
description: D1 数据库使用和 Drizzle ORM
group: 指南
order: 2
---

# 数据库

OPC Stack 使用 Cloudflare D1 和 Drizzle ORM。

数据库分成两类：

```text
Meta DB
  全局身份
  全局配置
  支付订单
  兑换码
  shard registry

Tenant Shard DB
  用户积分账本
  用户反馈
  通知已读状态
```

## 绑定

`META_DB` 是全局元信息库。

`TENANT_DB_0000..N` 是租户分片库。

分片数量由环境变量控制：

```env
D1_SHARD_COUNT=1
```

## Schema

Meta schema：

```text
src/db/schema.meta.ts
src/db/meta-migrations/
```

Tenant Shard schema：

```text
src/db/schema.shard.ts
src/db/shard-migrations/
```

`src/db/schema.ts` 只作为统一导出口，不要把新表直接写进去。

## Migration

`scripts/prepare-cloudflare.mjs` 会自动生成并应用两套 migration。

```text
Meta migration  -> META_DB
Shard migration -> 每个 TENANT_DB_xxxx
```

本地开发执行：

```bash
pnpm dev
```

部署执行：

```bash
pnpm deploy:cloudflare
```

## 请求中使用数据库

API handler 中直接读取 request scoped DB。

```typescript
const metaDb = ctx.get('metaDb')
const tenantDb = ctx.get('tenantDb')
```

全局数据使用 `metaDb`。

用户级高频数据使用 `tenantDb`。

不要写一个自动判断表归属的统一 `db` wrapper。

## 表归属规则

放 Meta DB：

```text
登录前必须访问的数据
全局唯一约束数据
跨用户关系数据
支付订单和 webhook 状态
兑换码状态
```

放 Tenant Shard DB：

```text
只属于单个用户的数据
高频用户写入数据
可通过 user_id 路由的数据
```

## 跨库写入

D1 不支持跨数据库事务。

跨库流程必须显式建模为最终一致。

兑换码流程：

```text
Meta DB: unused -> claimed
Tenant DB: grant credits with source_type + source_id
Meta DB: claimed -> granted
```

租户库发放失败时接口返回 `202 CREDIT_GRANT_PENDING`，后台任务用同一个 `source_type + source_id` 重试。

## 常见问题

**Q: 扩容会迁移老用户吗**

不会。扩容只新增 shard，老用户继续使用 `user_shards` 中已有的 shard。

**Q: 可以缩容吗**

默认不支持。模板只提供扩容机制。
