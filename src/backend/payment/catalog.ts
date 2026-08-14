import type { MetaDb } from '../db'
import { decryptConfigSecret } from '../config/crypto'
import { createCreemPayment } from './creem'
import { createDodoPayment } from './dodo'
import type { PaymentProvider, ProviderProduct } from './contract'
import {
	getPaymentConfig,
	getPaymentProviderEnvironment,
	PaymentConfigError,
	type PaymentEnvironment,
	type PaymentProviderName
} from './config'

export interface RemotePaymentCatalog {
	provider: PaymentProviderName
	environment: PaymentEnvironment
	products: ProviderProduct[]
}

export async function listRemotePaymentProducts(
	db: MetaDb,
	encryptionKey: string,
	providerName: PaymentProviderName
): Promise<RemotePaymentCatalog> {
	const config: Awaited<ReturnType<typeof getPaymentConfig>> = await getPaymentConfig(db)
	const providerConfig: (typeof config.providers)[PaymentProviderName] = config.providers[providerName]
	if (providerConfig.apiKey === null || providerConfig.webhookSecret === null) {
		throw new PaymentConfigError('PAYMENT_PROVIDER_CREDENTIALS_MISSING')
	}

	const apiKey: string = await decryptConfigSecret(encryptionKey, providerConfig.apiKey)
	const webhookSecret: string = await decryptConfigSecret(
		encryptionKey,
		providerConfig.webhookSecret
	)
	const environment: PaymentEnvironment = getPaymentProviderEnvironment(providerName, apiKey)
	const testMode: boolean = environment === 'test'
	const provider: PaymentProvider = providerName === 'dodo'
		? createDodoPayment({ apiKey, webhookSecret, testMode })
		: createCreemPayment({ apiKey, webhookSecret, testMode })

	return {
		provider: providerName,
		environment,
		products: await provider.discoverProducts()
	}
}
