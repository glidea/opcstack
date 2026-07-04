import type { EmailSimpleClient, EmailSimpleSendInput } from '..'

export function createCloudflareNativeEmailClient(env: Env): SendEmail {
	return env.SEND_EMAIL
}

export function createCloudflareSimpleEmailClient(env: Env): EmailSimpleClient {
	return new cloudflareSimpleEmailClient(
		createCloudflareNativeEmailClient(env),
		env.APP_NAME,
		env.SYSTEM_EMAIL
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
