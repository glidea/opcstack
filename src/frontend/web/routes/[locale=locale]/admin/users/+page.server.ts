type CloudflarePlatform = {
	env?: Cloudflare.Env
}

type UsersPageEvent = {
	platform?: CloudflarePlatform
}

type UsersPageData = {
	cloudflareAccountId: string
}

export function load(event: UsersPageEvent): UsersPageData {
	return {
		cloudflareAccountId: event.platform?.env?.R2_ACCOUNT_ID ?? ''
	}
}
