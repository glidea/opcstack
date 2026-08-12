---
title: 快速开始
description: 克隆、配置、运行、部署并构建扩展程序
group: Getting Started
group_order: 0
order: 1
---

# 快速开始

## 1. 使用 Agent 创建

首次使用：

```text
Create an OPCStack app named <APP_NAME> by following:
https://raw.githubusercontent.com/glidea/opcstack/main/QUICK_START.md
```

Agent 会按照当前平台规范安装用户级 `create-opcstack-app` Skill，然后创建并初始化项目。如果 `<APP_NAME>` 没有替换，Agent 会先询问应用名。

以后创建新项目时直接调用已安装的 Skill：

```text
Use create-opcstack-app to create an app named <APP_NAME>.
```

Skill 每次运行都会读取最新流程，不需要手动更新。

## 2. 手动安装

```bash
git clone https://github.com/glidea/opcstack <your-app-name>
cd <your-app-name>
git remote rename origin upstream
pnpm install
vim .env.dev
cp .env.secret.example .env.secret.dev
vim .env.secret.dev
pnpm dev
```

启动后打开 http://localhost:5173

公共配置放在 `.env.dev` 和 `.env.prod`。密钥放在 `.env.secret.dev` 和 `.env.secret.prod`。不要提交密钥文件。完整的环境变量体系请参阅 [部署](guides/deployment.md)。

## 3. 部署到 Cloudflare

```bash
pnpm deploy:cloudflare
```

首次远程部署时会提示创建 Cloudflare API Token。按链接创建后粘贴一次即可。之后 Token 会缓存在 `.wrangler/cloudflare-api-token`。

完整的资源供给和部署流程请参阅 [部署](guides/deployment.md)。

## 4. 访问管理控制台

使用首次准备流程打印的一次性管理员凭据登录，在 Account / Security 修改邮箱和密码，然后打开 `/{locale}/admin`。全部页面和运营操作参阅[管理控制台](guides/admin-console.md)。

## 5. 开发浏览器扩展

```bash
pnpm dev:extension
pnpm build:extension
```

扩展的入口点和共享前端层请参阅 [前端](guides/frontend.md)。

## 可选：中国访问域名

如需独立的中国入口，在 `.env.dev` 或 `.env.prod` 中设置 `APP_CN_DOMAIN`。`prepare:cloudflare:*` 会将其接入 R2 CORS 和 Turnstile 域名。不设置 `APP_CN_CNAME_TARGET` 时使用 Worker 自定义域名；设置后保留优选 CNAME，并通过普通 zone route 接入 Worker。

## 同步模板更新

```bash
git fetch upstream --tags
git merge upstream/main
```
