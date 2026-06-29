import {
	createResendNativeEmailClient,
	createResendSimpleEmailClient
} from './resend'
import {
	createCloudflareNativeEmailClient,
	createCloudflareSimpleEmailClient
} from './cloudflare'
import type { Resend } from 'resend'

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
