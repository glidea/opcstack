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
	"apiBaseUrl": "http://localhost:5173",
	"webBaseUrl": "http://localhost:5173",
	"extension": {
		"hostPermissions": [
			"http://localhost:5173/*"
		]
	}
}
