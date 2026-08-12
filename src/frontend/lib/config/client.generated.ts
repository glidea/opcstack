export type ClientConfig = {
	appName: string
	appVersion: string
	apiBaseUrl: string
	webBaseUrl: string
	supportEmail: string
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
	"appVersion": "0.1.0",
	"apiBaseUrl": "https://opcstack.glidea.app",
	"webBaseUrl": "https://opcstack.glidea.app",
	"supportEmail": "yourfriend@glidea.app",
	"emailSignupEnabled": true,
	"emailRequireVerification": false,
	"emailUserActionCooldownSeconds": 50,
	"googleAuthEnabled": false,
	"githubAuthEnabled": false,
	"linuxdoAuthEnabled": false,
	"turnstileEnabled": false,
	"turnstileSiteKey": "",
	"paymentEnabled": false,
	"extension": {
		"hostPermissions": [
			"http://localhost:5173/*"
		]
	}
}
