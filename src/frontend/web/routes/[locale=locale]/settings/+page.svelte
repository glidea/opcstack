<script lang="ts">
	import { goto } from '$app/navigation'
	import { client } from '$apiContract/client'
	import type { ListOAuthGrantsResponse } from '$apiContract/oauth-api-access'
	import type { PublicRuntimeConfig } from '$backend/config'
	import AppHeader from '$frontend/app-ui/shell/AppHeader.svelte'
	import UserMenu from '$frontend/app-ui/shell/UserMenu.svelte'
	import { _ } from '$frontend/i18n'
	import * as AlertDialog from '$frontend/ui/alert-dialog'
	import { Button } from '$frontend/ui/button'
	import { Input } from '$frontend/ui/input'
	import { Skeleton } from '$frontend/ui/skeleton'
	import CheckCircleIcon from '@lucide/svelte/icons/circle-check'
	import LinkIcon from '@lucide/svelte/icons/link'
	import UnlinkIcon from '@lucide/svelte/icons/unlink'

	let {
		data
	}: {
		data: {
			locale: string
			siteName: string
			canonicalUrl: string
			publicRuntimeConfig: PublicRuntimeConfig
		}
	} = $props()

	type OAuthProviderId = 'google' | 'github' | 'linuxdo'
	type OAuthProvider = {
		id: OAuthProviderId
		label: string
		enabled: boolean
	}
	type RevocationTarget =
		| { type: 'oauth'; provider: OAuthProvider }
		| { type: 'api'; grantId: string; label: string }

	const session = client.auth.useSession()
	const oauthProviders: OAuthProvider[] = $derived([
		{ id: 'google', label: 'Google', enabled: data.publicRuntimeConfig.google_auth_enabled },
		{ id: 'github', label: 'GitHub', enabled: data.publicRuntimeConfig.github_auth_enabled },
		{ id: 'linuxdo', label: 'LinuxDo', enabled: data.publicRuntimeConfig.linuxdo_auth_enabled }
	])

	let currentPassword: string = $state('')
	let newPassword: string = $state('')
	let passwordLoading: boolean = $state(false)
	let passwordError: string = $state('')
	let passwordSuccess: boolean = $state(false)
	let accountsLoading: boolean = $state(true)
	let accountsError: string = $state('')
	let linkedProviderIds: Set<string> = $state(new Set<string>())
	let accountCount: number = $state(0)
	let grants: ListOAuthGrantsResponse['items'] = $state([])
	let grantsLoading: boolean = $state(true)
	let grantsError: string = $state('')
	let revoking: boolean = $state(false)
	let revocationTarget: RevocationTarget | null = $state(null)
	let visibleOAuthProviders: OAuthProvider[] = $derived(oauthProviders.filter((provider: OAuthProvider): boolean => {
		return provider.enabled || linkedProviderIds.has(provider.id)
	}))

	$effect((): void => {
		if (!$session.isPending && !$session.data) {
			void goto(`/${data.locale}/login`)
		}
	})

	$effect((): void => {
		if ($session.data) {
			void loadAccounts()
			void loadGrants()
		}
	})

	async function loadAccounts(): Promise<void> {
		accountsLoading = true
		accountsError = ''
		const result = await client.auth.listAccounts()
		if (result.error) {
			accountsError = result.error.message ?? $_('settings.accounts.error')
			accountsLoading = false
			return
		}
		const providerIds: string[] = (result.data ?? []).map((account): string => account.providerId)
		linkedProviderIds = new Set<string>(providerIds)
		accountCount = providerIds.length
		accountsLoading = false
	}

	async function linkAccount(provider: OAuthProvider): Promise<void> {
		accountsError = ''
		const callbackURL: string = `${window.location.origin}/${data.locale}/settings`
		if (provider.id === 'linuxdo') {
			const result = await client.auth.oauth2.link({ providerId: provider.id, callbackURL })
			if (result.error) {
				accountsError = result.error.message ?? $_('settings.accounts.error')
			}
			return
		}
		const result = await client.auth.linkSocial({ provider: provider.id, callbackURL })
		if (result.error) {
			accountsError = result.error.message ?? $_('settings.accounts.error')
		}
	}

	async function loadGrants(): Promise<void> {
		grantsLoading = true
		grantsError = ''
		const response: Response = await fetch('/api/oauth/list_grants', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: '{}'
		})
		if (!response.ok) {
			grantsError = $_('settings.apiAccess.error')
			grantsLoading = false
			return
		}
		const body: ListOAuthGrantsResponse = (await response.json()) as ListOAuthGrantsResponse
		grants = body.items
		grantsLoading = false
	}

	async function confirmRevocation(): Promise<void> {
		if (revocationTarget === null) {
			return
		}
		revoking = true
		if (revocationTarget.type === 'oauth') {
			accountsError = ''
			const result = await client.auth.unlinkAccount({ providerId: revocationTarget.provider.id })
			if (result.error) {
				accountsError = result.error.message ?? $_('settings.accounts.error')
			} else {
				await loadAccounts()
			}
		} else {
			grantsError = ''
			const response: Response = await fetch('/api/oauth/revoke_grant', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ grant_id: revocationTarget.grantId })
			})
			if (response.ok) {
				await loadGrants()
			} else {
				grantsError = $_('settings.apiAccess.revokeError')
			}
		}
		revoking = false
		revocationTarget = null
	}

	async function handleChangePassword(): Promise<void> {
		passwordLoading = true
		passwordError = ''
		passwordSuccess = false
		const result = await client.auth.changePassword({ currentPassword, newPassword })
		passwordLoading = false
		if (result.error) {
			passwordError = result.error.message ?? $_('settings.password.submit')
			return
		}
		currentPassword = ''
		newPassword = ''
		passwordSuccess = true
	}

	function handlePasswordSubmit(event: SubmitEvent): void {
		event.preventDefault()
		void handleChangePassword()
	}

	function handleSignOut(): void {
		void goto(`/${data.locale}/login`)
	}

	function isLinked(provider: OAuthProvider): boolean {
		return linkedProviderIds.has(provider.id)
	}

	function revocationTitle(): string {
		return revocationTarget?.type === 'oauth'
			? $_('settings.accounts.disconnectTitle')
			: $_('settings.apiAccess.revokeTitle')
	}

	function revocationDescription(): string {
		if (revocationTarget === null) {
			return ''
		}
		const label: string = revocationTarget.type === 'oauth'
			? revocationTarget.provider.label
			: revocationTarget.label
		return revocationTarget.type === 'oauth'
			? $_('settings.accounts.disconnectDescription', { values: { provider: label } })
			: $_('settings.apiAccess.revokeDescription', { values: { client: label } })
	}
</script>

<svelte:head>
	<title>{$_('settings.title')} - {data.siteName}</title>
	<meta name="description" content={$_('settings.description')} />
	<link rel="canonical" href={data.canonicalUrl} />
</svelte:head>

<AppHeader logoHref={`/${data.locale}`}>
	{#snippet actions()}
		{#if $session.data}
			<UserMenu onSignOut={handleSignOut} settingsHref={`/${data.locale}/settings`} />
		{/if}
	{/snippet}
</AppHeader>

<main class="min-h-[calc(100svh-3rem)] px-5 py-12 sm:px-6 sm:py-16">
	<div class="mx-auto w-full max-w-3xl">
		<header class="mb-8">
			<h1 class="text-display-lg">{$_('settings.title')}</h1>
			<p class="text-lead mt-2 max-w-xl text-muted-foreground">{$_('settings.description')}</p>
		</header>

		<section class="border-t border-border py-8" aria-labelledby="connected-accounts-title">
			<div class="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)] md:gap-10">
				<div>
					<h2 id="connected-accounts-title" class="text-tagline">{$_('settings.accounts.title')}</h2>
					<p class="text-caption mt-2 text-muted-foreground">{$_('settings.accounts.description')}</p>
				</div>
				<div class="min-w-0">
					{#if accountsError}<p class="mb-4 text-sm text-destructive" role="alert">{accountsError}</p>{/if}
					{#if accountsLoading}
						<div class="space-y-3" aria-label={$_('settings.loading')}>
							<Skeleton class="h-14 w-full" />
							<Skeleton class="h-14 w-full" />
						</div>
					{:else if visibleOAuthProviders.length === 0}
						<p class="py-3 text-sm text-muted-foreground">{$_('settings.accounts.empty')}</p>
					{:else}
						<div class="divide-y divide-border border-y border-border">
							{#each visibleOAuthProviders as provider (provider.id)}
								<div class="flex min-h-16 items-center justify-between gap-4 py-3">
									<div class="min-w-0">
										<p class="font-medium">{provider.label}</p>
										<p class="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
											{#if isLinked(provider)}<CheckCircleIcon class="size-4" />{/if}
											{isLinked(provider) ? $_('settings.accounts.connected') : $_('settings.accounts.notConnected')}
										</p>
									</div>
									{#if isLinked(provider)}
										<Button
											variant="outline"
											disabled={accountCount <= 1}
											title={accountCount <= 1 ? $_('settings.accounts.lastMethod') : undefined}
											onclick={() => { revocationTarget = { type: 'oauth', provider } }}
										>
											<UnlinkIcon />{$_('settings.accounts.disconnect')}
										</Button>
									{:else}
										<Button variant="outline" onclick={() => { void linkAccount(provider) }}>
											<LinkIcon />{$_('settings.accounts.connect')}
										</Button>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</section>

		{#if !accountsLoading && linkedProviderIds.has('credential')}
			<section class="border-t border-border py-8" aria-labelledby="change-password-title">
				<div class="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)] md:gap-10">
					<div>
						<h2 id="change-password-title" class="text-tagline">{$_('settings.password.title')}</h2>
						<p class="text-caption mt-2 text-muted-foreground">{$_('settings.password.description')}</p>
					</div>
					<form class="max-w-sm space-y-4" onsubmit={handlePasswordSubmit}>
						{#if passwordError}<p class="text-sm text-destructive" role="alert">{passwordError}</p>{/if}
						{#if passwordSuccess}<p class="text-sm text-muted-foreground">{$_('settings.password.success')}</p>{/if}
						<label class="block text-sm font-medium" for="current-password">{$_('settings.password.currentPassword')}</label>
						<Input id="current-password" type="password" autocomplete="current-password" bind:value={currentPassword} required aria-invalid={passwordError !== ''} />
						<label class="block text-sm font-medium" for="new-password">{$_('settings.password.newPassword')}</label>
						<Input id="new-password" type="password" autocomplete="new-password" bind:value={newPassword} required aria-invalid={passwordError !== ''} />
						<Button type="submit" disabled={passwordLoading}>
							{passwordLoading ? $_('settings.password.submitting') : $_('settings.password.submit')}
						</Button>
					</form>
				</div>
			</section>
		{/if}

		<section class="border-y border-border py-8" aria-labelledby="api-access-title">
			<div class="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)] md:gap-10">
				<div>
					<h2 id="api-access-title" class="text-tagline">{$_('settings.apiAccess.title')}</h2>
					<p class="text-caption mt-2 text-muted-foreground">{$_('settings.apiAccess.description')}</p>
				</div>
				<div class="min-w-0">
					{#if grantsError}<p class="mb-4 text-sm text-destructive" role="alert">{grantsError}</p>{/if}
					{#if grantsLoading}
						<div class="space-y-3" aria-label={$_('settings.loading')}>
							<Skeleton class="h-20 w-full" />
						</div>
					{:else if grants.length === 0}
						<p class="py-3 text-sm text-muted-foreground">{$_('settings.apiAccess.empty')}</p>
					{:else}
						<div class="divide-y divide-border border-y border-border">
							{#each grants as grant (grant.id)}
								<div class="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
									<div class="min-w-0">
										<p class="font-medium">{grant.client_name}</p>
										<p class="mt-1 break-all text-sm text-muted-foreground">{grant.target_origin}</p>
										<p class="mt-1 text-sm text-muted-foreground">{grant.scopes.join(', ')}</p>
									</div>
									{#if grant.status === 'active'}
										<Button variant="outline" onclick={() => { revocationTarget = { type: 'api', grantId: grant.id, label: grant.client_name } }}>
											<UnlinkIcon />{$_('settings.apiAccess.revoke')}
										</Button>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</section>
	</div>
</main>

<AlertDialog.Root open={revocationTarget !== null} onOpenChange={(open: boolean): void => { if (!open && !revoking) revocationTarget = null }}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{revocationTitle()}</AlertDialog.Title>
			<AlertDialog.Description>{revocationDescription()}</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={revoking}>{$_('settings.cancel')}</AlertDialog.Cancel>
			<AlertDialog.Action variant="destructive" disabled={revoking} onclick={() => { void confirmRevocation() }}>
				{revoking ? $_('settings.revoking') : $_('settings.confirm')}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
