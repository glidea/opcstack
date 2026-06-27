import type { EmailSimpleClient, EmailSimpleSendInput } from '..'

export function newCloudflareNativeEmailClient(env: Env): SendEmail {
	return env.SEND_EMAIL
}

export function newCloudflareSimpleEmailClient(env: Env): EmailSimpleClient {
	return new cloudflareSimpleEmailClient(
		newCloudflareNativeEmailClient(env),
		env.APP_NAME,
		env.EMAIL_FROM
	)
}

class cloudflareSimpleEmailClient implements EmailSimpleClient {
	private readonly binding: SendEmail
	private readonly appName: string
	private readonly from: string

	constructor(binding: SendEmail, appName: string, from: string) {
		this.binding = binding
		this.appName = appName
		this.from = from
	}

	async send(input: EmailSimpleSendInput): Promise<void> {
		await this.binding.send({
			from: this.from,
			to: input.to,
			subject: this.appName + ': ' + input.subject,
			html: input.html
		})
	}
}
