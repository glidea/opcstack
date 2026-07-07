---
title: Storage
description: R2 object storage, upload flows, access control, and generated media
group: Guides
group_order: 1
order: 3
---

# Storage

OPCStack uses Cloudflare R2 for object bytes. The database stores business rows and R2 object keys. The Worker owns upload signing, read authorization, cache headers, image variants, and generated media writes.

Do not treat R2 as a database. Store the file in R2, then store the key in the Meta DB or Tenant DB row that gives the object business meaning.

## Storage Architecture

```mermaid
flowchart TB
  subgraph Clients["Clients"]
    Browser["Browser web app"]
    Extension["Chrome extension"]
  end

  subgraph Worker["Single Worker deployment"]
    UploadApi["Upload URL APIs<br/>POST /api/create_r2_upload_url<br/>POST /api/admin/create_r2_public_upload_url"]
    ReadApi["Read APIs<br/>GET /api/r2/public/*<br/>GET /api/r2/tmp/public/*<br/>GET /api/r2/private/*<br/>GET /api/r2/tmp/private/*"]
    OriginApi["Signed image origin<br/>GET /api/internal/r2_image_origin/*"]
    BusinessApi["Business handlers<br/>profiles, AI tasks, files"]
    R2Client["R2 client<br/>path rules + access checks + signing"]
  end

  subgraph Data["Data plane"]
    R2["R2 bucket<br/>public/*<br/>private/&lt;userId&gt;/*<br/>tmp/public/*<br/>tmp/private/&lt;userId&gt;/*"]
    MetaDb["Meta DB<br/>global business rows"]
    TenantDb["Tenant DB<br/>user business rows"]
    WorkerCache["Worker cache<br/>public reads only"]
  end

  subgraph Cloudflare["Cloudflare services"]
    S3Api["R2 S3 API<br/>presigned PUT"]
    ImageResize["Image Resizing<br/>variant=small / medium"]
    Lifecycle["R2 lifecycle<br/>tmp prefixes only"]
  end

  subgraph External["External producers"]
    AiProviders["AI providers<br/>image, audio, video"]
  end

  Browser --> UploadApi
  Extension --> UploadApi
  UploadApi --> R2Client
  R2Client --> S3Api
  S3Api -->|"60s upload_url"| Browser
  Browser -->|"PUT object bytes"| S3Api
  S3Api --> R2

  Browser --> ReadApi
  Extension --> ReadApi
  ReadApi --> R2Client
  ReadApi <--> WorkerCache
  R2Client --> R2
  ReadApi --> Browser

  Browser -->|"read with variant"| ReadApi
  ReadApi --> ImageResize
  ImageResize --> OriginApi
  OriginApi --> R2Client

  BusinessApi --> R2Client
  R2Client --> R2
  BusinessApi --> MetaDb
  BusinessApi --> TenantDb

  AiProviders --> BusinessApi
  Lifecycle --> R2
```

The important boundary is the Worker. Browser and extension clients may upload directly to R2 only through a short-lived presigned URL. Reads still go through `/api/r2/*` so the Worker can enforce private object ownership and set cache headers.

## Object Namespaces

R2 keys use four namespaces:

| Namespace | Access | Lifecycle | Use for |
| --- | --- | --- | --- |
| `public/*` | Anyone can read | Persistent | Public assets, public generated output |
| `private/<userId>/*` | Owner only | Persistent | User uploads, private generated output |
| `tmp/public/*` | Anyone can read | Temporary | Public preview files and short-lived intermediates |
| `tmp/private/<userId>/*` | Owner only | Temporary | Private upload staging and task intermediates |

The path prefix is part of the permission model. Do not create new top-level prefixes unless the storage model itself changes.

## Choosing A Namespace

Use `public/*` when the object is intentionally public and long-lived: product images, public generated media, or documentation assets.

Use `private/<userId>/*` when exactly one user owns the object and the object should remain available: avatar uploads, private project files, or private AI results.

Use `tmp/public/*` or `tmp/private/<userId>/*` only when automatic deletion is correct. Upload staging, short previews, and intermediate AI files fit here. Anything that a user expects to keep does not.

When the object belongs to a business row, store the R2 key on that row. User-owned rows normally live in the Tenant DB. Global control rows, payment rows, and system-wide records live in the Meta DB.

## User Upload Flow

Persistent private upload:

```typescript
const upload = await apiClient.createR2UploadUrl({
	is_tmp: false,
	path: 'avatars/me.png',
	content_type: file.type,
	size: file.size
})

await fetch(upload.upload_url, {
	method: 'PUT',
	headers: {
		'Content-Type': file.type
	},
	body: file
})
```

Temporary upload:

```typescript
const upload = await apiClient.createR2UploadUrl({
	is_tmp: true,
	path: 'drafts/input.png',
	content_type: file.type,
	size: file.size
})
```

Admin public upload:

```typescript
const upload = await apiClient.createR2PublicUploadUrl({
	path: 'images/hero.png',
	content_type: file.type,
	size: file.size
})
```

The upload API enforces the real rules:

- Upload paths are relative and cannot contain `..`
- Upload URLs expire after 60 seconds
- `content_type` must be listed in `R2_USER_UPLOAD_ALLOWED_CONTENT_TYPES`
- `size` must not exceed `R2_USER_UPLOAD_MAX_BYTES`
- User uploads are always private
- User uploads use `is_tmp` to select `private/<userId>/*` or `tmp/private/<userId>/*`
- Admin public uploads write `public/*`

After upload, application code should store `upload.key` in the relevant business row. The key is the stable reference. The returned `read_url` is a convenience URL.

## Server Writes

Server-side code writes through `createR2Client`.

```typescript
import { createR2Client } from '../../r2'

const r2 = createR2Client(ctx.env, ctx.get('userId'))
const object = await r2.put({
	dir: 'exports',
	filename: 'result.json',
	body: JSON.stringify(result),
	contentType: 'application/json'
})
```

For public output, pass `isPublic: true`. For temporary output, pass `isTmp: true`.

```typescript
const object = await r2.put({
	isPublic: true,
	dir: 'generated/images',
	filename: 'result.png',
	body: imageBytes,
	contentType: 'image/png'
})
```

Keep the business write explicit: write the object to R2, then store `object.key` in the DB row that owns it.

## Read Flow And Access Control

Objects are read through Worker routes:

| Route | Access |
| --- | --- |
| `GET /api/r2/public/*` | Public |
| `GET /api/r2/tmp/public/*` | Public |
| `GET /api/r2/private/<userId>/*` | Current user only |
| `GET /api/r2/tmp/private/<userId>/*` | Current user only |

Private reads require the authenticated user to match the `<userId>` in the key. A request for another user's private object returns `403`.

Cache behavior is tied to the namespace:

| Namespace | Cache behavior |
| --- | --- |
| `public/*` | Long public cache |
| `tmp/public/*` | Short public cache |
| `private/*` | `private, no-store` |
| `tmp/private/*` | `private, no-store` |

Worker cache is used only for public read paths. Private objects are never stored in Worker cache.

## Temporary Lifecycle

Temporary deletion is configured with `R2_TMP_LIFECYCLE_RULES`:

```env
R2_TMP_LIFECYCLE_RULES=tmp/public/:7;tmp/private/:1
```

Only these prefixes are valid:

```text
tmp/public/
tmp/private/
```

Do not configure lifecycle rules for `public/` or `private/`. Those namespaces are persistent by design.

`prepare-cloudflare` validates the rules and syncs them to the R2 bucket when R2 is enabled.

## Image Variants

Image reads support two variants:

```text
?variant=small
?variant=medium
```

The flow is:

```text
/api/r2/...?...variant=small
  -> Worker checks object access
  -> Worker creates a signed internal origin URL
  -> Cloudflare Image Resizing fetches /api/internal/r2_image_origin/*
  -> Worker verifies R2_ORIGIN_SIGNING_SECRET
  -> Worker streams the original object from R2
```

The internal origin route is not a public file API. It exists so Cloudflare Image Resizing can fetch an authorized source object without exposing private R2 access.

## Generated Media

AI-generated files should end in R2, not in D1.

Use R2 keys in async task rows:

- Task row stores task state, provider IDs, and result object keys
- R2 stores image, audio, video, or other generated bytes
- Queue payloads carry only task ID and user ID

Video output must be streamed into R2. Do not convert video output to `arrayBuffer` or base64 before upload.

## Configuration

The main storage settings are:

| Key | Purpose |
| --- | --- |
| `R2_ENABLED` | Enables R2 provisioning and binding |
| `R2_USER_UPLOAD_ALLOWED_CONTENT_TYPES` | Semicolon-separated upload MIME allowlist |
| `R2_USER_UPLOAD_MAX_BYTES` | Max user upload size |
| `R2_TMP_LIFECYCLE_RULES` | Temporary object deletion rules |
| `R2_ORIGIN_SIGNING_SECRET` | Signs internal image origin reads |
| `R2_SECRET_ACCESS_KEY` | Secret half of the R2 S3 write token |

`prepare-cloudflare` creates the bucket, configures the Worker binding, prepares the R2 S3 write token, syncs temporary lifecycle rules, and writes generated runtime config.

## Common Mistakes

- Do not put private user files under `public/*`
- Do not store file bytes in D1
- Do not store only `read_url` in the database; store the R2 key
- Do not let frontend code invent R2 prefixes
- Do not add lifecycle rules to persistent namespaces
- Do not bypass `/api/r2/*` for private reads
- Do not use base64 or `arrayBuffer` for generated video uploads
