export type ClientConfig = {
	appName: string
	appVersion: string
	apiBaseUrl: string
	webBaseUrl: string
	extension: {
		hostPermissions: string[]
	}
}

export const clientConfig: ClientConfig = {
	"appName": "opcstack",
	"appVersion": "0.1.0",
	"apiBaseUrl": "https://opcstack.glidea.app",
	"webBaseUrl": "https://opcstack.glidea.app",
	"extension": {
		"hostPermissions": [
			"https://opcstack.glidea.app/*"
		]
	}
}
