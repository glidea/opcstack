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
		fields
	}))
}

function normalizeError(error: unknown): Error {
	if (error instanceof Error) {
		return error
	}
	return new Error(String(error))
}
