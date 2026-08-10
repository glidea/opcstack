---
title: Overview
description: OPCStack template documentation index and reading guide
group: Getting Started
group_order: 0
order: 0
---

# OPCStack Template Docs

OPCStack is a Cloudflare-native product skeleton for one-person or small teams to ship SaaS and AI products fast. Auth, payments, credits, R2, D1 sharding, KV, Queues, Cron, deployment automation, and testing are wired end to end. You delete what you do not need; you do not rebuild the base loop from scratch.

## Module Map

| Module     | What it gives you                                                               | Doc                                                                         |
| ---------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Web + API  | SvelteKit SSR, Hono API, prerendered static pages                               | [Frontend](guides/frontend.md), API contracts                               |
| Database   | D1, Drizzle, user data sharding, read replicas, auto migration                  | [Database](guides/database.md)                                              |
| Storage    | R2 public/private/tmp paths, browser direct upload, image variants              | [Storage](guides/storage.md)                                                |
| Async      | Queues, Cron, Durable Objects                                                   | [Queues and Cron](guides/queues-cron.md)                                    |
| Auth       | Better Auth, email, Google, GitHub, LinuxDO, Turnstile, beta code               | [Authentication](guides/authentication.md)                                  |
| Credits    | Wallet, ledger, signup grant, daily checkin, invite reward, redeem code, expiry | [Credits](guides/credits.md)                                                |
| Payments   | Dodo, Creem, one-time packs, subscriptions, webhooks, refund clawback           | [Payments](guides/payments.md)                                              |
| AI         | Chat, image, TTS, realtime, video providers, async tasks with R2 output         | [AI](guides/ai.md)                                                          |
| Operations | User feedback, system notifications, global and targeted announcements          | [Operations](guides/operations.md)                                          |
| Admin      | Users, credits, codes, announcements, payments, AI task inspection               | [Admin Console](guides/admin-console.md)                                     |
| Testing    | Vitest, BDD helper, mock D1 and R2, E2E, coverage                               | [Testing](guides/testing.md)                                                |
| Deployment | prepare-cloudflare automation, DNS, CN domain, secrets, deploy commands         | [Deployment](guides/deployment.md)                                          |

## Reading Guide

**Just cloned the template?**

Start with [Getting Started](getting-started.md). On first use, give the Quick Start URL to an AI coding agent. It installs `create-opcstack-app`; later projects can invoke the Skill directly.

**Going to production?**

1. [Deployment](guides/deployment.md) for the deploy path and resource provisioning.
2. [Authentication](guides/authentication.md) to lock down signup and OAuth.
3. [Payments](guides/payments.md) and [Credits](guides/credits.md) to wire billing.
4. [Admin Console](guides/admin-console.md) to operate the deployed product.
5. [Testing](guides/testing.md) before you ship.

**Working on the template itself?**

1. [Architecture](architecture.md) for design principles and system overview.
2. [Database](guides/database.md) for the sharding model and saga rules.
3. [Deployment](guides/deployment.md) for the prepare-cloudflare automation.
4. API contracts in `src/api-contract/` for the contract conventions.
