import { z } from 'zod'

export const CreateR2UploadUrlRequestSchema = z.object({
	path: z.string().min(1).refine((path) => {
		if (path.startsWith('/')) {
			return false
		}
		return !path.split('/').includes('..')
	}),
	content_type: z.string().min(1),
	size: z.number().int().min(1)
})
export type CreateR2UploadUrlRequest = z.infer<typeof CreateR2UploadUrlRequestSchema>

export const CreateR2TmpUploadUrlRequestSchema = CreateR2UploadUrlRequestSchema.extend({
	is_public: z.boolean()
})
export type CreateR2TmpUploadUrlRequest = z.infer<typeof CreateR2TmpUploadUrlRequestSchema>

export type CreateR2UploadUrlResponse = {
	key: string
	upload_url: string
	read_url: string
	expires_at: number
}
