import { EmailError, type EmailSimpleClient, type EmailSimpleSendInput } from '..'
import { Resend } from 'resend'

export function createResendNativeEmailClient(apiKey: string): Resend {
	return new Resend(apiKey)
}

export function createResendSimpleEmailClient(
	client: Resend,
	appName: string,
	sender: string
): EmailSimpleClient {
	return new resendSimpleEmailClient(client, appName, sender)
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
			throw new EmailError('EMAIL_SEND_FAILED', `Email send failed: ${status}`)
		}
	}
}
