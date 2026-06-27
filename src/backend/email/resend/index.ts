import type { EmailSimpleClient, EmailSimpleSendInput } from '..'
import { Resend } from 'resend'

export function newResendNativeEmailClient(env: Env): Resend {
	return new Resend(env.EMAIL_RESEND_API_KEY)
}

export function newResendSimpleEmailClient(
	env: Env,
	nativeClient?: Resend
): EmailSimpleClient {
	const client = nativeClient ?? newResendNativeEmailClient(env)
	return new resendSimpleEmailClient(client, env.APP_NAME, env.EMAIL_FROM)
}

class resendSimpleEmailClient implements EmailSimpleClient {
	private readonly client: Resend
	private readonly appName: string
	private readonly from: string

	constructor(client: Resend, appName: string, from: string) {
		this.client = client
		this.appName = appName
		this.from = from
	}

	async send(input: EmailSimpleSendInput): Promise<void> {
		const response = await this.client.emails.send({
			from: this.from,
			to: input.to,
			subject: this.appName + ": " + input.subject,
			html: input.html
		})

		if (response.error) {
			const status = response.error.statusCode ?? 500
			throw new Error(`EMAIL_SEND_FAILED:${status}`)
		}
	}
}
