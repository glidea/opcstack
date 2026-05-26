export interface R2TmpLifecycleRule {
	id: string
	prefix: string
	expireDays: number
}

export interface R2LifecyclePayload {
	rules: Array<{
		id: string
		enabled: boolean
		conditions: {
			prefix: string
		}
		deleteObjectsTransition: {
			condition: {
				type: 'Age'
				maxAge: number
			}
		}
	}>
}

export function parseR2TmpLifecycleRules(rawValue: string | undefined): R2TmpLifecycleRule[]

export function buildR2LifecyclePayload(rules: R2TmpLifecycleRule[]): R2LifecyclePayload
