import { z } from 'zod'
import type { ApiErrorResult } from './common'

export const CreateR2UploadUrlRequestSchema = z.object({
	is_tmp: z.boolean(),
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

export const CreateR2PublicUploadUrlRequestSchema = CreateR2UploadUrlRequestSchema.omit({
	is_tmp: true
})
export type CreateR2PublicUploadUrlRequest = z.infer<typeof CreateR2PublicUploadUrlRequestSchema>

export const CreateR2UploadUrlResponseSchema = z.object({
	key: z.string(),
	upload_url: z.string(),
	read_url: z.string(),
	expires_at: z.number()
})
export type CreateR2UploadUrlResponse = z.infer<typeof CreateR2UploadUrlResponseSchema>

export type CreateR2PublicUploadUrlResponse = CreateR2UploadUrlResponse

export const CreateR2UploadUrlApi = {
	request: CreateR2UploadUrlRequestSchema,
	response: CreateR2UploadUrlResponseSchema,
	errors: {
		INVALID_REQUEST(message: string): ApiErrorResult<'INVALID_REQUEST', 400> {
			return {
				status: 400,
				body: {
					code: 'INVALID_REQUEST',
					message
				}
			}
		},
		R2_USER_UPLOAD_CONTENT_TYPE_NOT_ALLOWED(): ApiErrorResult<
			'R2_USER_UPLOAD_CONTENT_TYPE_NOT_ALLOWED',
			400
		> {
			return {
				status: 400,
				body: {
					code: 'R2_USER_UPLOAD_CONTENT_TYPE_NOT_ALLOWED',
					message: 'Upload content type is not allowed'
				}
			}
		},
		R2_USER_UPLOAD_SIZE_TOO_LARGE(): ApiErrorResult<'R2_USER_UPLOAD_SIZE_TOO_LARGE', 400> {
			return {
				status: 400,
				body: {
					code: 'R2_USER_UPLOAD_SIZE_TOO_LARGE',
					message: 'Upload size is too large'
				}
			}
		}
	}
}

export const CreateR2PublicUploadUrlApi = {
	request: CreateR2PublicUploadUrlRequestSchema,
	response: CreateR2UploadUrlResponseSchema,
	errors: {
		INVALID_REQUEST(message: string): ApiErrorResult<'INVALID_REQUEST', 400> {
			return {
				status: 400,
				body: {
					code: 'INVALID_REQUEST',
					message
				}
			}
		},
		R2_USER_UPLOAD_CONTENT_TYPE_NOT_ALLOWED(): ApiErrorResult<
			'R2_USER_UPLOAD_CONTENT_TYPE_NOT_ALLOWED',
			400
		> {
			return {
				status: 400,
				body: {
					code: 'R2_USER_UPLOAD_CONTENT_TYPE_NOT_ALLOWED',
					message: 'Upload content type is not allowed'
				}
			}
		},
		R2_USER_UPLOAD_SIZE_TOO_LARGE(): ApiErrorResult<'R2_USER_UPLOAD_SIZE_TOO_LARGE', 400> {
			return {
				status: 400,
				body: {
					code: 'R2_USER_UPLOAD_SIZE_TOO_LARGE',
					message: 'Upload size is too large'
				}
			}
		}
	}
}
