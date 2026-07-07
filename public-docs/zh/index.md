---
title: 概览
description: OPCStack 模板文档索引与阅读指南
group: Overview
order: 0
---

# OPCStack 模板文档

OPCStack 是一个 Cloudflare 原生的产品骨架，专为个人开发者或小团队快速交付 SaaS 和 AI 产品而设计。认证、支付、积分、R2、D1 分片、KV、队列、Cron、部署自动化和测试已全部端到端打通。你只需删掉不需要的部分，无需从零重建基础循环。

## 模块地图

| 模块 | 提供的能力 | 文档 |
| --- | --- | --- |
| Web + API | SvelteKit SSR、Hono API、预渲染静态页面 | [前端](guides/frontend.md)、[API 契约](reference/api-contracts.md) |
| Database | D1、Drizzle、用户数据分片、读副本、自动迁移 | [数据库](guides/database.md) |
| Storage | R2 公共/私有/临时路径、浏览器直传、图片变体 | [存储](guides/storage.md) |
| Async | 队列、Cron、Durable Objects | [队列与 Cron](guides/queues-cron.md) |
| Auth | Better Auth、邮箱、Google、GitHub、LinuxDO、Turnstile、内测码 | [认证](guides/authentication.md) |
| Credits | 钱包、账本、注册奖励、每日签到、邀请奖励、兑换码、过期 | [积分](guides/credits.md) |
| Payments | Dodo、Creem、一次性包、订阅、Webhook、退款扣回 | [支付](guides/payments.md) |
| AI | 聊天、图像、TTS、实时、视频提供商，带 R2 输出的异步任务 | [AI](guides/ai.md) |
| Operations | 用户反馈、系统通知、全局与定向公告 | [运营](guides/operations.md) |
| Testing | Vitest、BDD 辅助工具、Mock D1 和 R2、E2E、覆盖率 | [测试](guides/testing.md) |
| Deployment | prepare-cloudflare 自动化、DNS、CN 域名、密钥、部署命令 | [部署](guides/deployment.md) |

## 阅读指南

**刚刚克隆了模板？**

从 [快速开始](getting-started.md) 开始。最快的方式是让 AI 助手引导你：打开你的 AI 编码工具，引用 `@BOOTSTRAP.md @AGENTS.md`，它会逐步带你完成本地配置。

**即将上生产？**

1. [部署](guides/deployment.md) — 了解部署路径和资源供给。
2. [认证](guides/authentication.md) — 锁定注册和 OAuth。
3. [支付](guides/payments.md) 和 [积分](guides/credits.md) — 接入计费。
4. [测试](guides/testing.md) — 上线前跑一遍。

**在模板本身上工作？**

1. [架构](architecture.md) — 了解设计原则和系统概览。
2. [数据库](guides/database.md) — 了解分片模型和 Saga 规则。
3. [部署](guides/deployment.md) — 了解 prepare-cloudflare 自动化。
4. [API 契约](reference/api-contracts.md) — 了解契约约定。

## 代码是真理

这些文档解释如何使用和扩展模板，它们不是主要的事实来源。当文档与代码不一致时，以代码为准。修改前请先查阅相关源码。
