export interface DoubaoRealtimeFrame {
	event: number
	sessionId: string
	payload: Uint8Array
}

export function encodeDoubaoRealtimeSessionFrame(
	event: number,
	sessionId: string,
	payload: Uint8Array
): Uint8Array {
	const sessionBytes: Uint8Array = toUtf8Bytes(sessionId)
	const frame: Uint8Array = new Uint8Array(16 + sessionBytes.length + payload.length)
	const view: DataView = new DataView(frame.buffer)
	frame[0] = 0x11
	frame[1] = 0x94
	frame[2] = 0x10
	frame[3] = 0x00
	view.setInt32(4, event)
	view.setUint32(8, sessionBytes.length)
	frame.set(sessionBytes, 12)
	view.setUint32(12 + sessionBytes.length, payload.length)
	frame.set(payload, 16 + sessionBytes.length)
	return frame
}

export function encodeDoubaoRealtimeConnectionFrame(event: number, payload: Uint8Array): Uint8Array {
	const frame: Uint8Array = new Uint8Array(12 + payload.length)
	const view: DataView = new DataView(frame.buffer)
	frame[0] = 0x11
	frame[1] = 0x94
	frame[2] = 0x10
	frame[3] = 0x00
	view.setInt32(4, event)
	view.setUint32(8, payload.length)
	frame.set(payload, 12)
	return frame
}

export function decodeDoubaoRealtimeFrame(raw: ArrayBuffer | Uint8Array): DoubaoRealtimeFrame {
	const frame: Uint8Array = raw instanceof Uint8Array ? raw : new Uint8Array(raw)
	const view: DataView = new DataView(frame.buffer, frame.byteOffset, frame.byteLength)
	const event: number = view.getInt32(4)
	const idLength: number = view.getUint32(8)
	const payloadLengthOffset: number = 12 + idLength
	const payloadLength: number = view.getUint32(payloadLengthOffset)
	const payloadOffset: number = payloadLengthOffset + 4
	return {
		event,
		sessionId: new TextDecoder().decode(frame.slice(12, 12 + idLength)),
		payload: frame.slice(payloadOffset, payloadOffset + payloadLength)
	}
}

export function toUtf8Bytes(text: string): Uint8Array {
	return new TextEncoder().encode(text)
}
