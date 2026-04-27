---
title: Storage
description: R2 object storage usage
group: Guides
order: 3
---

# Storage

OPC Stack uses Cloudflare R2 as object storage and it is S3 API compatible.

## File path convention

- Public files: `public/*` and accessible to everyone
- Private files: `private/<userId>/*` and only owner can access

## Upload files

```typescript
import { uploadFile } from '@/r2'

// Upload public file
await uploadFile(env.R2, 'public/logo.png', file, {
  contentType: 'image/png'
})

// Upload private file
await uploadFile(env.R2, `private/${userId}/avatar.jpg`, file, {
  contentType: 'image/jpeg'
})
```

## Download files

```typescript
// Get object
const object = await env.R2.get('public/logo.png')
if (!object) {
  return ctx.json({ error: 'File not found' }, 404)
}

// Return object
return new Response(object.body, {
  headers: {
    'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
    'Cache-Control': 'public, max-age=31536000'
  }
})
```

## List files

```typescript
// List all files for one user
const list = await env.R2.list({
  prefix: `private/${userId}/`
})

const files = list.objects.map(obj => ({
  key: obj.key,
  size: obj.size,
  uploaded: obj.uploaded
}))
```

## Delete files

```typescript
// Delete single file
await env.R2.delete('public/logo.png')

// Delete multiple files
await env.R2.delete([
  'public/file1.png',
  'public/file2.png'
])
```

## Permission control

Check file permission in API handlers:
- Public file `public/*`: everyone can access
- Private file `private/<userId>/*`: only owner can access

See `src/api/handler/files.ts` for reference.

## Pre signed URL

R2 does not provide pre signed URL directly. You can generate temporary access token in Worker. See `src/api/handler/files.ts`.

## Image processing

Use Cloudflare Images or process inside Worker.

```typescript
// Use Cloudflare Images
const response = await fetch(
  `https://your-domain.com/cdn-cgi/image/width=200,height=200/${imageUrl}`
)
```

## Frontend upload

```typescript
// Frontend uploads file to API
const formData = new FormData()
formData.append('file', file)

const response = await fetch('/api/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
})
```

## Utility functions

See utilities in `src/r2/index.ts`:
- `uploadFile` for upload
- `getFileUrl` for file URL
- `isPublicFile` to check public path
- `isUserFile` to check user path

## Local development

Local development uses Miniflare to emulate R2:

```bash
# View local R2 files
ls .wrangler/state/v3/r2/miniflare-R2BucketObject/
```

## FAQ

**Q: Is there size limit in R2**

Single file max is 5TB. Total storage has no fixed upper limit.

**Q: How to implement resumable upload**

Use R2 multipart upload API.

**Q: How to improve image loading speed**

Use Cloudflare Images or CDN cache.
