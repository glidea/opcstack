export type ClientConfig = {
	appName: string
	apiBaseUrl: string
	webBaseUrl: string
	supportEmail: string
	designSystem: string
	emailEnabled: boolean
	emailSignupEnabled: boolean
	emailRequireVerification: boolean
	emailUserActionCooldownSeconds: number
	googleAuthEnabled: boolean
	githubAuthEnabled: boolean
	linuxdoAuthEnabled: boolean
	turnstileEnabled: boolean
	turnstileSiteKey: string
	paymentEnabled: boolean
	extension: {
		hostPermissions: string[]
	}
}

export const clientConfig: ClientConfig = {
	"appName": "opcstack",
	"apiBaseUrl": "http://localhost:5173",
	"webBaseUrl": "http://localhost:5173",
	"supportEmail": "opc-support@example.com",
	"designSystem": "apple-saas",
	"emailEnabled": true,
	"emailSignupEnabled": true,
	"emailRequireVerification": true,
	"emailUserActionCooldownSeconds": 50,
	"googleAuthEnabled": false,
	"githubAuthEnabled": false,
	"linuxdoAuthEnabled": false,
	"turnstileEnabled": true,
	"turnstileSiteKey": "1x00000000000000000000AA",
	"paymentEnabled": false,
	"extension": {
		"hostPermissions": []
	}
}
