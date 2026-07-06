export function logInfo(
	message: string,
	fields: Record<string, unknown> = {}
): void {
	console.info(JSON.stringify({
		message,
		fields
	}))
}

export function logWarn(
	error: unknown,
	fields: Record<string, unknown> = {}
): void {
	const resolvedError = normalizeError(error)
	console.warn(JSON.stringify({
		message: resolvedError.message,
		error: resolvedError,
		fields
	}))
}

export function logError(
	error: unknown,
	fields: Record<string, unknown> = {}
): void {
	const resolvedError = normalizeError(error)
	console.error(JSON.stringify({
		message: resolvedError.message,
		error: resolvedError,
		fields
	}))
}

type NormalizedError = {
	name: string
	message: string
	code?: string
	stack?: string
}

function normalizeError(error: unknown): NormalizedError {
	if (error instanceof Error) {
		const record = error as Error & { code?: unknown }
		const normalized: NormalizedError = {
			name: error.name,
			message: error.message
		}
		if (typeof record.code === 'string') {
			normalized.code = record.code
		}
		if (error.stack) {
			normalized.stack = error.stack
		}
		return normalized
	}
	return {
		name: 'Error',
		message: String(error)
	}
}
