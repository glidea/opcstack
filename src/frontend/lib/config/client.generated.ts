export type ClientConfig = {
	appName: string
	appVersion: string
	apiBaseUrl: string
	webBaseUrl: string
	supportEmail: string
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
	"paymentEnabled": false,
	"extension": {
		"hostPermissions": [
			"http://localhost:5173/*"
		]
	}
}
