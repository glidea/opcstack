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
	| 'EMAIL_PROVIDER_UNAVAILABLE'
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
		case 'EMAIL_PROVIDER_UNAVAILABLE':
			return 'Email provider is not configured'
		case 'EMAIL_SEND_FAILED':
			return 'Email send failed'
	}
}

export interface EmailClients {
	simple: EmailSimpleClient
	resend?: Resend
	cloudflare?: SendEmail
}

export type EmailClientConfig = {
	provider: string
	resendApiKey: string | null
	appName: string
	sender: string
	sendEmailBinding: SendEmail
}

export function createEmailClients(config: EmailClientConfig): EmailClients {
	const provider: string = config.provider
	if (provider === 'resend') {
		if (!config.resendApiKey) {
			throw new EmailError('EMAIL_PROVIDER_UNAVAILABLE')
		}
		const resend = createResendNativeEmailClient(config.resendApiKey)
		return {
			simple: createResendSimpleEmailClient(resend, config.appName, config.sender),
			resend
		}
	}

	if (provider === 'cloudflare') {
		const cloudflare = createCloudflareNativeEmailClient(config.sendEmailBinding)
		return {
			simple: createCloudflareSimpleEmailClient(
				config.sendEmailBinding,
				config.appName,
				config.sender
			),
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
