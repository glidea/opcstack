export function base64ToBytes(base64: string): Uint8Array {
	const raw = atob(base64)
	const bytes = new Uint8Array(raw.length)
	for (let index = 0; index < raw.length; index += 1) {
		bytes[index] = raw.charCodeAt(index)
	}
	return bytes
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer)
	let raw = ''
	for (const byte of bytes) {
		raw += String.fromCharCode(byte)
	}
	return btoa(raw)
}
