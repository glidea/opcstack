	export type AIErrorCode =
	| 'UNSUPPORTED_AI_PROVIDER'
	| 'AI_PROVIDER_NOT_FOUND'
	| 'AI_PROVIDER_CONFIG_INVALID'
	| 'AI_IMAGE_REFERENCE_R2_READ_FAILED'
	| 'AI_IMAGE_R2_UPLOAD_DIR_REQUIRED'
	| 'AI_IMAGE_R2_UPLOAD_IS_PUBLIC_REQUIRED'
	| 'ALIYUN_IMAGE_GENERATION_FAILED'
	| 'ALIYUN_IMAGE_DOWNLOAD_FAILED'
	| 'ALIYUN_LOW_CENSORSHIP_UNSUPPORTED'
	| 'ALIYUN_QWEN_NUMBER_OF_IMAGES_UNSUPPORTED'
	| 'ALIYUN_UNSUPPORTED_IMAGE_MIME_TYPE'
	| 'ALIYUN_Z_IMAGE_NUMBER_OF_IMAGES_UNSUPPORTED'
	| 'ALIYUN_Z_IMAGE_REFERENCES_UNSUPPORTED'
	| 'UNSUPPORTED_ALIYUN_IMAGE_MODEL'
	| 'UNSUPPORTED_ALIYUN_IMAGE_SIZE'
	| 'SEEDDREAM_IMAGE_GENERATION_FAILED'
	| 'UNSUPPORTED_SEEDDREAM_IMAGE_SIZE'
	| 'TTS_SOURCE_NOT_SUPPORTED'
	| 'INVALID_SPEAKER_COUNT'
	| 'UNKNOWN_SPEAKER'
	| 'SEED_TTS_FAILED'
	| 'SEED_PODCAST_CONNECT_FAILED'
	| 'DOUBAO_REALTIME_CONNECT_FAILED'
	| 'DOUBAO_REALTIME_MODEL_UNSUPPORTED'
	| 'SEEDDANCE_CREATE_TASK_FAILED'
	| 'SEEDDANCE_CREATE_TASK_ID_MISSING'
	| 'SEEDDANCE_GET_TASK_FAILED'
	| 'SEEDDANCE_VIDEO_URL_MISSING'
	| 'AI_VIDEO_PROVIDER_TASK_FAILED'
	| 'AI_VIDEO_DOWNLOAD_FAILED'

export class AIError extends Error {
	public readonly code: AIErrorCode

	constructor(code: AIErrorCode, message?: string) {
		super(message ?? aiErrorMessage(code))
		this.name = 'AIError'
		this.code = code
	}
}

function aiErrorMessage(code: AIErrorCode): string {
	 switch (code) {
		case 'UNSUPPORTED_AI_PROVIDER':
			return 'AI provider is unsupported'
		case 'AI_PROVIDER_NOT_FOUND':
			return 'AI provider is not found'
		case 'AI_PROVIDER_CONFIG_INVALID':
			return 'AI provider configuration is invalid'
		case 'AI_IMAGE_REFERENCE_R2_READ_FAILED':
			return 'Failed to read image reference from R2'
		case 'AI_IMAGE_R2_UPLOAD_DIR_REQUIRED':
			return 'R2 upload directory is required'
		case 'AI_IMAGE_R2_UPLOAD_IS_PUBLIC_REQUIRED':
			return 'R2 upload visibility is required'
		case 'ALIYUN_IMAGE_GENERATION_FAILED':
			return 'Aliyun image generation failed'
		case 'ALIYUN_IMAGE_DOWNLOAD_FAILED':
			return 'Aliyun image download failed'
		case 'ALIYUN_LOW_CENSORSHIP_UNSUPPORTED':
			return 'Aliyun low censorship mode is unsupported'
		case 'ALIYUN_QWEN_NUMBER_OF_IMAGES_UNSUPPORTED':
			return 'Aliyun Qwen image count is unsupported'
		case 'ALIYUN_UNSUPPORTED_IMAGE_MIME_TYPE':
			return 'Aliyun image MIME type is unsupported'
		case 'ALIYUN_Z_IMAGE_NUMBER_OF_IMAGES_UNSUPPORTED':
			return 'Aliyun Z image count is unsupported'
		case 'ALIYUN_Z_IMAGE_REFERENCES_UNSUPPORTED':
			return 'Aliyun Z image references are unsupported'
		case 'UNSUPPORTED_ALIYUN_IMAGE_MODEL':
			return 'Aliyun image model is unsupported'
		case 'UNSUPPORTED_ALIYUN_IMAGE_SIZE':
			return 'Aliyun image size is unsupported'
		case 'SEEDDREAM_IMAGE_GENERATION_FAILED':
			return 'SeedDream image generation failed'
		case 'UNSUPPORTED_SEEDDREAM_IMAGE_SIZE':
			return 'SeedDream image size is unsupported'
		case 'TTS_SOURCE_NOT_SUPPORTED':
			return 'TTS source input is unsupported'
		case 'INVALID_SPEAKER_COUNT':
			return 'Speaker count is invalid'
		case 'UNKNOWN_SPEAKER':
			return 'Speaker is unknown'
		case 'SEED_TTS_FAILED':
			return 'Seed TTS failed'
		case 'SEED_PODCAST_CONNECT_FAILED':
			return 'Seed podcast connection failed'
		case 'DOUBAO_REALTIME_CONNECT_FAILED':
			return 'Doubao realtime connection failed'
		case 'DOUBAO_REALTIME_MODEL_UNSUPPORTED':
			return 'Doubao realtime model is unsupported'
		case 'SEEDDANCE_CREATE_TASK_FAILED':
			return 'SeedDance task creation failed'
		case 'SEEDDANCE_CREATE_TASK_ID_MISSING':
			return 'SeedDance task id is missing'
		case 'SEEDDANCE_GET_TASK_FAILED':
			return 'SeedDance task query failed'
		case 'SEEDDANCE_VIDEO_URL_MISSING':
			return 'SeedDance video URL is missing'
		case 'AI_VIDEO_PROVIDER_TASK_FAILED':
			return 'AI video provider task failed'
		case 'AI_VIDEO_DOWNLOAD_FAILED':
			return 'AI video download failed'
	}
}
