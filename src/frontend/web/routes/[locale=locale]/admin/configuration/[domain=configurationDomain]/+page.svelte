<script lang="ts">
	import { page } from '$app/state'
	import type { Component } from 'svelte'
	import AffiliateConfigurationForm from '../AffiliateConfigurationForm.svelte'
	import AIConfigurationForm from '../AIConfigurationForm.svelte'
	import AuthenticationConfigurationForm from '../AuthenticationConfigurationForm.svelte'
	import CreditsConfigurationForm from '../CreditsConfigurationForm.svelte'
	import EmailConfigurationForm from '../EmailConfigurationForm.svelte'
	import GeneralConfigurationForm from '../GeneralConfigurationForm.svelte'
	import PaymentConfigurationForm from '../PaymentConfigurationForm.svelte'
	import StorageConfigurationForm from '../StorageConfigurationForm.svelte'
	import type { ConfigurationDomain } from '../configuration-page'

	const forms: Partial<Record<ConfigurationDomain, Component>> = {
		general: GeneralConfigurationForm,
		authentication: AuthenticationConfigurationForm,
		email: EmailConfigurationForm,
		storage: StorageConfigurationForm,
		credits: CreditsConfigurationForm,
		affiliate: AffiliateConfigurationForm,
		payment: PaymentConfigurationForm,
		ai: AIConfigurationForm
	}
	const domain: ConfigurationDomain = $derived(page.url.pathname.split('/').at(-1) as ConfigurationDomain)
	const Form: Component | undefined = $derived(forms[domain])
</script>

{#if Form}
	<Form />
{/if}
