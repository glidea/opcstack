import { describe, expect, it } from 'vitest'
import {
	ConfigSecretError,
	decryptConfigSecret,
	encryptConfigSecret,
	mutateConfigSecret,
	type EncryptedConfigSecret
} from './crypto'

describe('config secret encryption', () => {
	const encryptionKey: string = Buffer.alloc(32, 7).toString('base64')

	it('decrypts the encrypted value', async (): Promise<void> => {
		const encrypted: EncryptedConfigSecret = await encryptConfigSecret(
			encryptionKey,
			'sk-live-value'
		)

		const result: string = await decryptConfigSecret(encryptionKey, encrypted)

		expect({ result }).toEqual({ result: 'sk-live-value' })
	})

	it('uses a fresh iv for every replacement', async (): Promise<void> => {
		const first: EncryptedConfigSecret = await encryptConfigSecret(encryptionKey, 'same-value')
		const second: EncryptedConfigSecret = await encryptConfigSecret(encryptionKey, 'same-value')

		expect({ ivChanged: first.iv !== second.iv, ciphertextChanged: first.ciphertext !== second.ciphertext })
			.toEqual({ ivChanged: true, ciphertextChanged: true })
	})

	it('rejects a root key with the wrong length', async (): Promise<void> => {
		await expect(encryptConfigSecret(Buffer.alloc(31).toString('base64'), 'value')).rejects.toEqual(
			new ConfigSecretError('INVALID_ENCRYPTION_KEY', 'Invalid configuration encryption key')
		)
	})

	it('does not expose decryption details when the key is wrong', async (): Promise<void> => {
		const encrypted: EncryptedConfigSecret = await encryptConfigSecret(encryptionKey, 'secret-value')
		const wrongKey: string = Buffer.alloc(32, 8).toString('base64')

		await expect(decryptConfigSecret(wrongKey, encrypted)).rejects.toEqual(
			new ConfigSecretError('SECRET_DECRYPTION_FAILED', 'Configuration secret is unavailable')
		)
	})

	it('applies each explicit secret mutation', async (): Promise<void> => {
		const current: EncryptedConfigSecret = await encryptConfigSecret(encryptionKey, 'current')
		const kept: EncryptedConfigSecret | null = await mutateConfigSecret(
			encryptionKey,
			current,
			{ action: 'keep' }
		)
		const removed: EncryptedConfigSecret | null = await mutateConfigSecret(
			encryptionKey,
			current,
			{ action: 'remove' }
		)
		const replaced: EncryptedConfigSecret | null = await mutateConfigSecret(
			encryptionKey,
			current,
			{ action: 'replace', value: 'next' }
		)

		expect({
			kept,
			removed,
			replacedValue: replaced ? await decryptConfigSecret(encryptionKey, replaced) : null
		}).toEqual({ kept: current, removed: null, replacedValue: 'next' })
	})
})
