import {
	createResendNativeEmailClient,
	createResendSimpleEmailClient
} from './resend'
import {
	createCloudflareNativeEmailClient,
	createCloudflareSimpleEmailClient
} from './cloudflare'
import type { Resend } from 'resend'

export type EmailErrorCode =
	| 'UNSUPPORTED_EMAIL_PROVIDER'
	| 'EMAIL_SEND_FAILED'

export class EmailError extends Error {
	public readonly code: EmailErrorCode

	constructor(code: EmailErrorCode, message?: string) {
		super(message ?? emailErrorMessage(code))
		this.name = 'EmailError'
		this.code = code
	}
}

function emailErrorMessage(code: EmailErrorCode): string {
	switch (code) {
		case 'UNSUPPORTED_EMAIL_PROVIDER':
			return 'Email provider is unsupported'
		case 'EMAIL_SEND_FAILED':
			return 'Email send failed'
	}
}

export interface EmailClients {
	simple: EmailSimpleClient
	resend?: Resend
	cloudflare?: SendEmail
}

export function createEmailClients(
	env: Env
): EmailClients {
	const provider = env.EMAIL_PROVIDER || 'resend'
	if (provider === 'resend') {
		const resend = createResendNativeEmailClient(env)
		return {
			simple: createResendSimpleEmailClient(env, resend),
			resend
		}
	}

	if (provider === 'cloudflare') {
		const cloudflare = createCloudflareNativeEmailClient(env)
		return {
			simple: createCloudflareSimpleEmailClient(env),
			cloudflare
		}
	}

	throw new EmailError('UNSUPPORTED_EMAIL_PROVIDER', `Email provider is unsupported: ${provider}`)
}

export interface EmailSimpleClient {
	// TODO: enqueue failed email for retry when queue support is added
	send(input: EmailSimpleSendInput): Promise<void>
}

export interface EmailSimpleSendInput {
	to: string
	subject: string
	html: string
}
