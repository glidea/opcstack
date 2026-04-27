---
title: 存储
description: R2 对象存储使用
group: 指南
order: 3
---

# 存储

OPC Stack 使用 Cloudflare R2 作为对象存储，兼容 S3 API。

## 文件路径约定

- **公共文件**：`public/*`（任何人可访问）
- **私有文件**：`private/<userId>/*`（仅所有者可访问）

## 上传文件

```typescript
import { uploadFile } from '@/r2'

// 上传公共文件
await uploadFile(env.R2, 'public/logo.png', file, {
  contentType: 'image/png'
})

// 上传私有文件
await uploadFile(env.R2, `private/${userId}/avatar.jpg`, file, {
  contentType: 'image/jpeg'
})
```

## 下载文件

```typescript
// 获取文件
const object = await env.R2.get('public/logo.png')
if (!object) {
  return ctx.json({ error: 'File not found' }, 404)
}

// 返回文件
return new Response(object.body, {
  headers: {
    'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
    'Cache-Control': 'public, max-age=31536000'
  }
})
```

## 列出文件

```typescript
// 列出用户的所有文件
const list = await env.R2.list({
  prefix: `private/${userId}/`
})

const files = list.objects.map(obj => ({
  key: obj.key,
  size: obj.size,
  uploaded: obj.uploaded
}))
```

## 删除文件

```typescript
// 删除单个文件
await env.R2.delete('public/logo.png')

// 删除多个文件
await env.R2.delete([
  'public/file1.png',
  'public/file2.png'
])
```

## 权限控制

在 API handler 中检查文件权限：
- 公共文件（`public/*`）：任何人可访问
- 私有文件（`private/<userId>/*`）：仅所有者可访问

参考 `src/api/handler/files.ts` 的实现。

## 生成预签名 URL

R2 不直接支持预签名 URL，可以通过 Worker 生成临时访问 token。参考 `src/api/handler/files.ts` 的实现。

## 图片处理

使用 Cloudflare Images 或在 Worker 中处理。

```typescript
// 使用 Cloudflare Images
const response = await fetch(
  `https://your-domain.com/cdn-cgi/image/width=200,height=200/${imageUrl}`
)
```

## 前端上传

```typescript
// 前端直接上传到 API
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

## 工具函数

参考 `src/r2/index.ts` 中的工具函数：
- `uploadFile` - 上传文件
- `getFileUrl` - 获取文件 URL
- `isPublicFile` - 判断是否公共文件
- `isUserFile` - 判断是否用户文件

## 本地开发

本地开发使用 Miniflare 模拟 R2：

```bash
# 查看本地 R2 文件
ls .wrangler/state/v3/r2/miniflare-R2BucketObject/
```

## 常见问题

**Q: R2 有大小限制吗？**

单个文件最大 5TB，总存储无限制。

**Q: 如何实现断点续传？**

使用 R2 的 multipart upload API。

**Q: 如何优化图片加载速度？**

使用 Cloudflare Images 或 CDN 缓存。
