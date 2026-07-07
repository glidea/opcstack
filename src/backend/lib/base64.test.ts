import { describe, expect, test } from 'vitest'
import { arrayBufferToBase64, base64ToBytes } from './base64'

describe('base64ToBytes', () => {
	test('decodes base64 text into bytes', () => {
		const bytes = base64ToBytes('aGVsbG8=')
		expect(Array.from(bytes)).toEqual([104, 101, 108, 108, 111])
	})
})

describe('arrayBufferToBase64', () => {
	test('encodes bytes into base64 text', () => {
		const bytes = new Uint8Array([104, 101, 108, 108, 111])
		expect(arrayBufferToBase64(bytes.buffer)).toBe('aGVsbG8=')
	})
})
