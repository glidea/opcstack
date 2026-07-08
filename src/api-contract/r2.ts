import { z } from 'zod'
import type { ApiErrorResult } from './common'

export type UploadR2ObjectRequest = {
	key: string
	body: BodyInit
	content_type: string
}

export const UploadR2ObjectResponseSchema = z.object({
	key: z.string(),
	read_url: z.string()
})
export type UploadR2ObjectResponse = z.infer<typeof UploadR2ObjectResponseSchema>

export const UploadR2ObjectApi = {
	response: UploadR2ObjectResponseSchema,
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
		R2_UPLOAD_CONTENT_LENGTH_REQUIRED(): ApiErrorResult<
			'R2_UPLOAD_CONTENT_LENGTH_REQUIRED',
			400
		> {
			return {
				status: 400,
				body: {
					code: 'R2_UPLOAD_CONTENT_LENGTH_REQUIRED',
					message: 'Upload content length is required'
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

export const UploadR2PublicObjectApi = UploadR2ObjectApi
export type UploadR2PublicObjectRequest = UploadR2ObjectRequest
export type UploadR2PublicObjectResponse = UploadR2ObjectResponse
