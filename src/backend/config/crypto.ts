export type ConfigSecretErrorCode =
	| 'INVALID_ENCRYPTION_KEY'
	| 'INVALID_ENCRYPTED_SECRET'
	| 'SECRET_DECRYPTION_FAILED'

export class ConfigSecretError extends Error {
	readonly code: ConfigSecretErrorCode

	constructor(code: ConfigSecretErrorCode, message: string) {
		super(message)
		this.name = 'ConfigSecretError'
		this.code = code
	}
}

export type EncryptedConfigSecret = {
	ciphertext: string
	iv: string
}

export type SecretMutation =
	| { action: 'keep' }
	| { action: 'replace'; value: string }
	| { action: 'remove' }

const ENCRYPTION_KEY_BYTES: number = 32
const IV_BYTES: number = 12

export async function encryptConfigSecret(
	encryptionKey: string,
	value: string
): Promise<EncryptedConfigSecret> {
	const key: CryptoKey = await importEncryptionKey(encryptionKey)
	const iv: Uint8Array<ArrayBuffer> = new Uint8Array(IV_BYTES)
	crypto.getRandomValues(iv)
	const plaintext: Uint8Array<ArrayBuffer> = new TextEncoder().encode(value)
	const encrypted: ArrayBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)

	return {
		ciphertext: encodeBase64(new Uint8Array(encrypted)),
		iv: encodeBase64(iv)
	}
}

export async function decryptConfigSecret(
	encryptionKey: string,
	secret: EncryptedConfigSecret
): Promise<string> {
	const key: CryptoKey = await importEncryptionKey(encryptionKey)
	const iv: Uint8Array<ArrayBuffer> = decodeBase64(secret.iv, 'INVALID_ENCRYPTED_SECRET')
	const ciphertext: Uint8Array<ArrayBuffer> = decodeBase64(
		secret.ciphertext,
		'INVALID_ENCRYPTED_SECRET'
	)
	if (iv.byteLength !== IV_BYTES || ciphertext.byteLength === 0) {
		throw new ConfigSecretError('INVALID_ENCRYPTED_SECRET', 'Invalid encrypted configuration secret')
	}

	try {
		const decrypted: ArrayBuffer = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv },
			key,
			ciphertext
		)
		return new TextDecoder().decode(decrypted)
	} catch {
		throw new ConfigSecretError(
			'SECRET_DECRYPTION_FAILED',
			'Configuration secret is unavailable'
		)
	}
}

export async function mutateConfigSecret(
	encryptionKey: string,
	current: EncryptedConfigSecret | null,
	mutation: SecretMutation
): Promise<EncryptedConfigSecret | null> {
	switch (mutation.action) {
		case 'keep':
			return current
		case 'replace':
			return encryptConfigSecret(encryptionKey, mutation.value)
		case 'remove':
			return null
	}
}

async function importEncryptionKey(value: string): Promise<CryptoKey> {
	const keyBytes: Uint8Array<ArrayBuffer> = decodeBase64(value, 'INVALID_ENCRYPTION_KEY')
	if (keyBytes.byteLength !== ENCRYPTION_KEY_BYTES) {
		throw new ConfigSecretError(
			'INVALID_ENCRYPTION_KEY',
			'Invalid configuration encryption key'
		)
	}

	return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

function decodeBase64(value: string, code: ConfigSecretErrorCode): Uint8Array<ArrayBuffer> {
	try {
		const binary: string = atob(value)
		const bytes: Uint8Array<ArrayBuffer> = new Uint8Array(binary.length)
		for (let index: number = 0; index < binary.length; index += 1) {
			bytes[index] = binary.charCodeAt(index)
		}
		return bytes
	} catch {
		const message: string =
			code === 'INVALID_ENCRYPTION_KEY'
				? 'Invalid configuration encryption key'
				: 'Invalid encrypted configuration secret'
		throw new ConfigSecretError(code, message)
	}
}

function encodeBase64(value: Uint8Array<ArrayBuffer>): string {
	let binary: string = ''
	for (const byte of value) {
		binary += String.fromCharCode(byte)
	}
	return btoa(binary)
}
