import { createR2Client } from '../../r2'
import type { AIVideoReference } from '.'
import type { R2Client } from '../../r2'

export interface AIResolvedVideoReference {
	type: 'image' | 'video' | 'audio'
	url: string
}

export async function resolveVideoReferences(
	env: Env,
	userId: string | undefined,
	references: AIVideoReference[] | undefined
): Promise<AIResolvedVideoReference[]> {
	const inputs: AIVideoReference[] = references ?? []
	const outputs: AIResolvedVideoReference[] = []
	const client = createR2Client(env as Env & { R2: R2Bucket }, userId)

	for (const reference of inputs) {
		outputs.push({
			type: reference.type,
			url: await toReferenceUrl(env, client, reference.r2.key)
		})
	}

	return outputs
}

async function toReferenceUrl(
	env: Env,
	client: R2Client,
	key: string
): Promise<string> {
	if (key.startsWith('public/') || key.startsWith('tmp/public/')) {
		return `${trimRightSlash(env.APP_BASE_URL)}/api/r2/${key}`
	}

	const result = await client.createReadUrl({
		key,
		expiresAt: Math.floor(Date.now() / 1000) + 3600
	})
	return result.readUrl
}

function trimRightSlash(rawUrl: string): string {
	if (rawUrl.endsWith('/')) {
		return rawUrl.slice(0, -1)
	}
	return rawUrl
}
