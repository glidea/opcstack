import type { Context } from 'hono'
import type { ApiEnv } from '..'
import {
	GetGeneralConfigApi,
	GetStorageConfigApi,
	UpdateGeneralConfigApi,
	UpdateStorageConfigApi,
	type GeneralConfig as GeneralConfigResponse,
	type StorageConfig as StorageConfigResponse
} from '../../../api-contract/configuration'
import {
	ConfigStoreError,
	getGeneralConfig,
	getStorageConfig,
	updateGeneralConfig,
	updateStorageConfig,
	type GeneralConfig,
	type StorageConfig
} from '../../config'
import { logError } from '../../lib/log'
import { parseRequest } from '../../lib/request'

export async function getGeneralConfigHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, GetGeneralConfigApi.request)
	if (!request.success) {
		const error = GetGeneralConfigApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}

	try {
		const config: GeneralConfig = await getGeneralConfig(ctx.get('metaDb'))
		return ctx.json(toGeneralConfigResponse(config) as GeneralConfigResponse)
	} catch (error) {
		return mapConfigurationError(ctx, error, 'general')
	}
}

export async function updateGeneralConfigHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, UpdateGeneralConfigApi.request)
	if (!request.success) {
		const error = UpdateGeneralConfigApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}

	try {
		const config: GeneralConfig = await updateGeneralConfig(ctx.get('metaDb'), {
			designSystem: request.data.design_system,
			docsEnabled: request.data.docs_enabled,
			expectedVersion: request.data.expected_version,
			nowMs: Date.now()
		})
		return ctx.json(toGeneralConfigResponse(config) as GeneralConfigResponse)
	} catch (error) {
		return mapConfigurationError(ctx, error, 'general')
	}
}

export async function getStorageConfigHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, GetStorageConfigApi.request)
	if (!request.success) {
		const error = GetStorageConfigApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}

	try {
		const config: StorageConfig = await getStorageConfig(ctx.get('metaDb'))
		return ctx.json(toStorageConfigResponse(config) as StorageConfigResponse)
	} catch (error) {
		return mapConfigurationError(ctx, error, 'storage')
	}
}

export async function updateStorageConfigHandler(ctx: Context<ApiEnv>): Promise<Response> {
	const request = await parseRequest(ctx, UpdateStorageConfigApi.request)
	if (!request.success) {
		const error = UpdateStorageConfigApi.errors.INVALID_REQUEST(request.message)
		return ctx.json(error.body, error.status)
	}

	try {
		const config: StorageConfig = await updateStorageConfig(ctx.get('metaDb'), {
			allowedContentTypes: request.data.allowed_content_types,
			maxUploadBytes: request.data.max_upload_bytes,
			expectedVersion: request.data.expected_version,
			nowMs: Date.now()
		})
		return ctx.json(toStorageConfigResponse(config) as StorageConfigResponse)
	} catch (error) {
		return mapConfigurationError(ctx, error, 'storage')
	}
}

function toGeneralConfigResponse(config: GeneralConfig): GeneralConfigResponse {
	return {
		design_system: config.designSystem,
		docs_enabled: config.docsEnabled,
		version: config.version
	}
}

function toStorageConfigResponse(config: StorageConfig): StorageConfigResponse {
	return {
		allowed_content_types: config.allowedContentTypes,
		max_upload_bytes: config.maxUploadBytes,
		version: config.version
	}
}

function mapConfigurationError(
	ctx: Context<ApiEnv>,
	error: unknown,
	domain: 'general' | 'storage'
): Response {
	if (!(error instanceof ConfigStoreError)) {
		throw error
	}

	switch (error.code) {
		case 'VERSION_CONFLICT': {
			const response = GetGeneralConfigApi.errors.CONFIG_CONFLICT()
			return ctx.json(response.body, response.status)
		}
		case 'SETTINGS_NOT_FOUND':
		case 'SETTINGS_INVALID': {
			logError(error, { domain })
			const response = GetGeneralConfigApi.errors.CONFIG_UNAVAILABLE()
			return ctx.json(response.body, response.status)
		}
	}
}
