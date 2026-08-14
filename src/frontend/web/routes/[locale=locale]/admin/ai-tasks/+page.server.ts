import { AI_IMAGE_QUEUE_NAME } from '$backend/ai/image/task'
import { AI_TTS_QUEUE_NAME } from '$backend/ai/tts/task'
import { AI_VIDEO_QUEUE_NAME } from '$backend/ai/video/task'
import type { CloudflareResourceContext } from './ai-tasks-page'

type CloudflarePlatform = {
	env?: Cloudflare.Env
}

type AITasksPageEvent = {
	platform?: CloudflarePlatform
}

type AITasksPageData = {
	cloudflare: CloudflareResourceContext
}

export function load(event: AITasksPageEvent): AITasksPageData {
	const env: Cloudflare.Env | undefined = event.platform?.env
	return {
		cloudflare: {
			accountId: env?.R2_ACCOUNT_ID ?? '',
			workerName: env?.APP_NAME ?? '',
			bucketName: env?.APP_NAME ?? '',
			queues: {
				image: AI_IMAGE_QUEUE_NAME,
				tts: AI_TTS_QUEUE_NAME,
				video: AI_VIDEO_QUEUE_NAME
			}
		}
	}
}
