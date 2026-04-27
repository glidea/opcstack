import {
	newResendNativeEmailClient,
	newResendSimpleEmailClient
} from './resend'
import type { Resend } from 'resend'

export interface EmailClients {
	simple: EmailSimpleClient
	resend: Resend
}

export function newEmailClients(
	env: Env,
	options: EmailSimpleClientOptions = {}
): EmailClients {
	const provider = options.provider ?? 'resend'
	if (provider === 'resend') {
		const resend = newResendNativeEmailClient(env)
		return {
			simple: newResendSimpleEmailClient(env, resend),
			resend
		}
	}

	throw new Error(`UNSUPPORTED_EMAIL_PROVIDER: ${provider}`)
}

export interface EmailSimpleClient {
	// TODO: enqueue failed email for retry when queue support is added
	send(input: EmailSimpleSendInput): Promise<void>
}

export interface EmailSimpleClientOptions {
	provider?: 'resend'
}

export interface EmailSimpleSendInput {
	to: string
	subject: string
	html: string
}
