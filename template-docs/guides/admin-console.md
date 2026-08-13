---
title: Admin Console
description: Access and operate the built-in administration console
group: Guides
order: 10
---

# Admin Console

The admin console turns the existing Admin APIs into one operator workspace. It covers users, credits, access codes, announcements, feedback, payments, AI tasks, and dynamic business configuration. Cloudflare remains the place for infrastructure logs, queue backlog, database inspection, and object storage.

## Access

1. Run `prepare-cloudflare` and retain the one-time administrator credentials printed after the first successful initialization.
2. Sign in, then change the administrator email and password under Account / Security.
3. Open `/{locale}/admin`. The route redirects to `/{locale}/admin/overview`.

An unauthenticated visitor is redirected to login. A signed-in account without the D1 `admin` role receives `403 Forbidden`.

Programmatic clients use OAuth grants with explicit scopes. There is no static admin API token.

Run `opc auth connect --name <project> --server <origin> --scopes <scope-list>`. The CLI prints an authorization URL. After the signed-in user reviews and approves the requested scopes in the browser, the CLI receives tokens through PKCE and stores them under that connection name and server origin. `opc api request` uses the selected connection. Revoking the grant in Account / API Access invalidates both access and refresh immediately.

## Pages

| Page | Route | Purpose |
| --- | --- | --- |
| Overview | `/{locale}/admin/overview` | Review core metrics, actionable exceptions, and AI task distribution |
| Users | `/{locale}/admin/users` | Find users, inspect account state, and grant credits |
| Beta codes | `/{locale}/admin/beta-codes` | Generate codes and inspect availability or usage |
| Credit codes | `/{locale}/admin/credit-codes` | Generate credit codes and inspect claim or grant state |
| Feedback | `/{locale}/admin/feedback` | Search feedback and inspect full submissions |
| Notifications | `/{locale}/admin/notifications` | Publish global or targeted announcements and review history |
| Configuration | `/{locale}/admin/configuration` | Manage D1-backed business configuration by domain |
| Payments | `/{locale}/admin/payments` | Inspect transactions and disputed payments |
| AI tasks | `/{locale}/admin/ai-tasks` | Inspect image, TTS, and video tasks across users |

The locale can be `en` or `zh`. Language switching keeps the current admin path and query state.

## Manage configuration

Open **Configuration** and use the horizontal business tabs. General, Authentication, Email, Storage, Credits, and Affiliate each have one explicit form. Saving one tab immediately changes subsequent requests in that domain. An operation already in progress keeps the snapshot it started with.

Changing a field marks only the current tab as unsaved. Switching tabs or leaving the page requires choosing whether to discard the changes or keep editing. **Discard** restores the last saved values. There is no draft, publish step, automatic save, or cross-domain Save All.

Authentication and Email reveal dependent settings only after the feature is enabled. Missing required fields are shown beside the affected control and the old configuration remains active. Secret fields never display plaintext. Choose **Keep current value**, **Replace value**, or **Remove value** before saving. Provider callback URLs are derived from the application URL and are read-only.

Payment keeps provider settings and products independent. Save provider routing, credentials, test mode, and the read-only webhook URLs in the upper form. AI routing weights are saved in the upper form, while Providers have independent create, edit, and delete sheets.

Product and Provider saves replace only the changed row in the current page. They do not reload or overwrite sibling rows. Deletion always asks for confirmation. If another browser has already changed the same entity, the operation returns `CONFIG_CONFLICT`; refresh the current data and review it before editing again. Secret values are never shown. Provider rows expose only whether an API key is configured.

## Find a user and grant credits

1. Open `/{locale}/admin/users`.
2. Search by user name or email. Internal user IDs are shown only as secondary references.
3. Open the user details and select **Grant credits**.
4. Enter the amount, note, and optional expiry date.
5. Review the selected user and grant details, then confirm.

The console creates the idempotency source reference internally. Operators do not enter or see `source_id`.

## Generate access codes

### Beta codes

Open `/{locale}/admin/beta-codes`, choose the quantity and optional expiry date, review the request, then generate. Copy the returned codes before leaving the result view.

The list distinguishes unused and used codes and shows the user when a code has been consumed.

### Credit codes

Open `/{locale}/admin/credit-codes`, choose the quantity, credit amount, and optional expiry date, review the request, then generate. A code moves from unused to claimed and then granted as the cross-database credit flow completes.

## Publish an announcement

1. Open `/{locale}/admin/notifications`.
2. Choose the notification type and enter its title and content.
3. Keep the audience global or find a target user by name or email.
4. Review the audience and content, then publish.

The history list supports type, audience, user, and date filters. Published notifications cannot currently be edited or withdrawn from the console.

## Investigate AI tasks

1. Open `/{locale}/admin/ai-tasks`.
2. Filter by task type, status, or user. Provider, model, task ID, and date filters are under advanced filters.
3. Open a task to inspect provider state, attempts, timestamps, stored output, and the last error.
4. Use the contextual Cloudflare links to continue in the related Queue, D1 database, R2 bucket, or Worker dashboard.

The console is read-only for AI tasks. It does not retry, cancel, replay, or modify a task.

## Review payments and feedback

Use `/{locale}/admin/payments` to filter transactions by user, provider, type, status, or date. Open a row to inspect the provider references and amounts. Payment actions such as refunding or resolving a dispute remain outside the console.

Use `/{locale}/admin/feedback` to filter by type, user, or date and open the full submission. The console does not add workflow states or edit user feedback.

## Filters and shareable state

Common filters stay visible. Technical identifiers and date ranges are grouped under advanced filters. Active filters, page number, and the selected details are stored in the URL, so a filtered view can be refreshed or shared with another authorized operator. Use **Reset filters** to return to the default list.

## Cloudflare handoff

Cloudflare links are placed beside the resource they represent:

| Console context | Cloudflare destination |
| --- | --- |
| Console header | Deployed Worker |
| User details | Assigned D1 tenant shard |
| AI task list | Related Queues |
| AI task details | Queue, D1 shard, R2 bucket, and Worker when available |

A link is hidden when the required Cloudflare account or resource identifier is unavailable. Use the console for product state and Cloudflare for platform state such as logs, metrics, queue delivery, database queries, and objects.

## Current scope

- Public assets remain API-only and have no admin page.
- Payments, feedback, and AI task operations are read-only.
- Codes cannot be revoked from the console.
- Notifications cannot be edited or withdrawn after publishing.
- Fine-grained administrator permissions are not included. One D1 `admin` account owns browser access.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Redirected to login | Sign in and return to the original admin URL |
| `403 Forbidden` | Confirm the signed-in account is the D1 administrator |
| Empty list | Reset filters and confirm the related API has persisted records |
| Missing Cloudflare link | Run the relevant prepare flow and confirm the public resource identifiers are configured |

For API authentication details, see [Authentication](authentication.md). For production resource setup, see [Deployment](deployment.md).
