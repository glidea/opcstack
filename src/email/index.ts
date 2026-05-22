import {
	newResendNativeEmailClient,
	newResendSimpleEmailClient
} from './resend'
import {
	newCloudflareNativeEmailClient,
	newCloudflareSimpleEmailClient
} from './cloudflare'
import type { Resend } from 'resend'

export interface EmailClients {
	simple: EmailSimpleClient
	resend?: Resend
	cloudflare?: SendEmail
}

export function newEmailClients(
	env: Env
): EmailClients {
	const provider = env.EMAIL_PROVIDER || 'resend'
	if (provider === 'resend') {
		const resend = newResendNativeEmailClient(env)
		return {
			simple: newResendSimpleEmailClient(env, resend),
			resend
		}
	}

	if (provider === 'cloudflare') {
		const cloudflare = newCloudflareNativeEmailClient(env)
		return {
			simple: newCloudflareSimpleEmailClient(env),
			cloudflare
		}
	}

	throw new Error(`UNSUPPORTED_EMAIL_PROVIDER: ${provider}`)
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
