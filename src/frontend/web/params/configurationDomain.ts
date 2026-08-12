import { isConfigurationDomain } from '../routes/[locale=locale]/admin/configuration/configuration-page'

export function match(value: string): boolean {
	return isConfigurationDomain(value)
}
