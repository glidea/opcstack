import type { AIVideoProviderType } from '../config'

export * from './seedance/constants'

export interface AISimpleVideoClient {
	generate(input: AIVideoGenerateInput): Promise<AIVideoTask>
	getTask(id: string): Promise<AIVideoTask | undefined>
}

export interface AISimpleVideoClientOptions {
	model: string
}
export type AIVideoRatio = '21:9' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16'
export type AIVideoResolution = '480p' | '720p' | '1080p'

export type AIVideoReference =
	| AIR2VideoImageReference
	| AIR2VideoReference
	| AIR2VideoAudioReference

export interface AIR2VideoImageReference {
	type: 'image'
	r2: {
		key: string
	}
}

export interface AIR2VideoReference {
	type: 'video'
	r2: {
		key: string
	}
}

export interface AIR2VideoAudioReference {
	type: 'audio'
	r2: {
		key: string
	}
}

export interface AIVideoGenerateInput {
	prompt: string
	references?: AIVideoReference[]
	ratio?: AIVideoRatio
	resolution?: AIVideoResolution
	duration: number
	r2UploadDir?: string
	r2UploadIsPublic?: boolean
}

export interface AIVideoResult {
	mimeType: 'video/mp4'
	r2: {
		key: string
		url: string
	}
	providerUrl: string
}

export type AIVideoProviderTaskResult =
	| {
			status: 'running'
	  }
	| {
			status: 'failed'
			errorMessage: string
	  }
	| {
			status: 'completed'
			videoUrl: string
	  }

export type AIVideoTaskStatus = 'processing' | 'completed' | 'failed'

export interface AIVideoTask {
	id: string
	userId: string
	status: AIVideoTaskStatus
	providerType: AIVideoProviderType
	providerId?: string
	model?: string
	prompt: string
	ratio?: AIVideoRatio
	resolution?: AIVideoResolution
	duration: number
	r2UploadDir?: string
	r2UploadIsPublic: boolean
	references: AIVideoReference[]
	result?: {
		video: AIVideoResult
	}
	attemptCount: number
	lastErrorMessage?: string
	createdAt: number
	updatedAt: number
	completedAt?: number
}
