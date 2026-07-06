import { createR2Client } from '../../r2'
import { AIError } from '../error'
import type { AIImageReference, AIInlineImageReference } from '.'

type R2Env = Env & { R2: R2Bucket }

export async function resolveImageReferences(
	env: Env,
	userId: string | undefined,
	references: AIImageReference[] | undefined
): Promise<AIInlineImageReference[]> {
	const inputs = references ?? []
	const outputs: AIInlineImageReference[] = []
	const client = createR2Client(env as R2Env, userId)

	for (const reference of inputs) {
		if ('imageBase64' in reference) {
			outputs.push(reference)
			continue
		}

		if (reference.r2.variant) {
			const result = await client.getImageVariant(reference.r2.key, reference.r2.variant)
			if (result.status !== 'ok') {
				throw new AIError('AI_IMAGE_REFERENCE_R2_READ_FAILED')
			}
			outputs.push({
				imageBase64: arrayBufferToBase64(await new Response(result.body).arrayBuffer()),
				mimeType: result.contentType
			})
			continue
		}

		const result = await client.get(reference.r2.key)
		if (result.status !== 'ok') {
			throw new AIError('AI_IMAGE_REFERENCE_R2_READ_FAILED')
		}
		outputs.push({
			imageBase64: arrayBufferToBase64(await new Response(result.body).arrayBuffer()),
			mimeType: result.contentType
		})
	}

	return outputs
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer)
	let raw = ''
	for (const byte of bytes) {
		raw += String.fromCharCode(byte)
	}
	return btoa(raw)
}
