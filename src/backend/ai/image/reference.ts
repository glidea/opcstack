import { createR2Client, R2Error, type R2GetResult } from '../../r2'
import { AIError } from '../error'
import { arrayBufferToBase64 } from '../../lib/base64'
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

		try {
			let result: R2GetResult
			if (reference.r2.variant) {
				result = await client.getImageVariant(reference.r2.key, reference.r2.variant)
			} else {
				result = await client.get(reference.r2.key)
			}
			outputs.push({
				imageBase64: arrayBufferToBase64(await new Response(result.body).arrayBuffer()),
				mimeType: result.contentType
			})
		} catch (error) {
			if (error instanceof R2Error) {
				switch (error.code) {
					case 'R2_READ_FORBIDDEN':
					case 'R2_READ_NOT_FOUND':
					case 'R2_READ_PATH_INVALID':
					case 'R2_READ_FAILED':
						throw new AIError('AI_IMAGE_REFERENCE_R2_READ_FAILED')
					default:
						throw error
				}
			}
			throw error
		}
	}

	return outputs
}
