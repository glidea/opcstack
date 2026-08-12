import { describe, expect, test } from 'vitest'
import {
	UpdateGeneralConfigRequestSchema,
	UpdateStorageConfigRequestSchema
} from './configuration'

describe('configuration contract', () => {
	test('accepts complete General updates', (): void => {
		const result = UpdateGeneralConfigRequestSchema.safeParse({
			design_system: 'brutalism',
			docs_enabled: false,
			expected_version: 2
		})

		expect(result.success).toBe(true)
	})

	test('rejects duplicate Storage content types', (): void => {
		const result = UpdateStorageConfigRequestSchema.safeParse({
			allowed_content_types: ['image/png', 'image/png'],
			max_upload_bytes: 1024,
			expected_version: 1
		})

		expect(result.success).toBe(false)
	})

	test('rejects an empty Storage content type list', (): void => {
		const result = UpdateStorageConfigRequestSchema.safeParse({
			allowed_content_types: [],
			max_upload_bytes: 1024,
			expected_version: 1
		})

		expect(result.success).toBe(false)
	})
})
