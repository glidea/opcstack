<script lang="ts">
	import { goto } from '$app/navigation'
	import { client } from '$apiContract/client'
	import AppHeader from '$frontend/app-ui/shell/AppHeader.svelte'
	import UserMenu from '$frontend/app-ui/shell/UserMenu.svelte'
	import { _ } from '$frontend/i18n'
	import { Button } from '$frontend/ui/button'
	import { Input } from '$frontend/ui/input'
	import { ApiClientError } from '$apiContract/client'

	let {
		data
	}: {
		data: {
			locale: string
			siteName: string
			canonicalUrl: string
		}
	} = $props()

	const session = client.auth.useSession()
	type SessionUser = { role?: string }

	let currentPassword: string = $state('')
	let newPassword: string = $state('')
	let newEmail: string = $state('')
	let loading: boolean = $state(false)
	let emailLoading: boolean = $state(false)
	let error: string = $state('')
	let emailError: string = $state('')
	let success: boolean = $state(false)
	let emailSuccess: boolean = $state(false)

	async function handleChangeEmail(): Promise<void> {
		emailLoading = true
		emailError = ''
		emailSuccess = false
		try {
			await client.api.updateAdministratorEmail({ email: newEmail })
			newEmail = ''
			emailSuccess = true
			await $session.refetch()
		} catch (error) {
			emailError = error instanceof ApiClientError ? error.body.message : $_('settings.email.submit')
		} finally {
			emailLoading = false
		}
	}

	async function handleChangePassword(): Promise<void> {
		loading = true
		error = ''
		success = false

		const result = await client.auth.changePassword({
			currentPassword,
			newPassword
		})

		loading = false
		if (result.error) {
			error = result.error.message ?? $_('settings.password.submit')
			return
		}

		currentPassword = ''
		newPassword = ''
		success = true
	}

	function handleSubmit(event: SubmitEvent): void {
		event.preventDefault()
		void handleChangePassword()
	}

	function handleEmailSubmit(event: SubmitEvent): void {
		event.preventDefault()
		void handleChangeEmail()
	}

	function handleSignOut(): void {
		void goto(`/${data.locale}/login`)
	}

	$effect(() => {
		if (!$session.isPending && !$session.data) {
			void goto(`/${data.locale}/login`)
		}
	})
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

<main class="min-h-[calc(100svh-3rem)] px-6 py-16">
	<div class="mx-auto w-full max-w-3xl">
		<div class="mb-10">
			<h1 class="text-display-lg">{$_('settings.title')}</h1>
			<p class="text-lead mt-3 max-w-xl text-muted-foreground">
				{$_('settings.description')}
			</p>
		</div>

		<Button variant="outline" href={`/${data.locale}/settings/agents`}>
			{$_('settings.agents.title')}
		</Button>

		{#if ($session.data?.user as SessionUser | undefined)?.role === 'admin'}
		<section class="mt-8 border-t border-border py-8">
			<div class="grid gap-8 md:grid-cols-[220px_1fr]">
				<div>
					<h2 class="text-tagline">{$_('settings.email.title')}</h2>
					<p class="text-caption mt-2 text-muted-foreground">{$_('settings.email.description')}</p>
				</div>
				<form class="max-w-sm space-y-4" onsubmit={handleEmailSubmit}>
					{#if emailError}<p class="text-sm text-destructive">{emailError}</p>{/if}
					{#if emailSuccess}<p class="text-sm text-muted-foreground">{$_('settings.email.success')}</p>{/if}
					<label class="block text-sm font-medium" for="settings-email">{$_('settings.email.label')}</label>
					<Input id="settings-email" type="email" autocomplete="email" bind:value={newEmail} required aria-invalid={emailError !== ''} />
					<Button type="submit" class="w-full" disabled={emailLoading}>
						{emailLoading ? $_('settings.email.submitting') : $_('settings.email.submit')}
					</Button>
				</form>
			</div>
		</section>
		{/if}

		<section class="mt-8 border-t border-border py-8">
			<div class="grid gap-8 md:grid-cols-[220px_1fr]">
				<div>
					<h2 class="text-tagline">{$_('settings.password.title')}</h2>
					<p class="text-caption mt-2 text-muted-foreground">
						{$_('settings.password.description')}
					</p>
				</div>

				<form class="max-w-sm space-y-4" onsubmit={handleSubmit}>
					{#if error}
						<p class="text-sm text-destructive">{error}</p>
					{/if}
					{#if success}
						<p class="text-sm text-muted-foreground">{$_('settings.password.success')}</p>
					{/if}
					<label class="block text-sm font-medium" for="current-password">{$_('settings.password.currentPassword')}</label>
					<Input
						id="current-password"
						type="password"
						autocomplete="current-password"
						bind:value={currentPassword}
						required
					/>
					<label class="block text-sm font-medium" for="new-password">{$_('settings.password.newPassword')}</label>
					<Input
						id="new-password"
						type="password"
						autocomplete="new-password"
						bind:value={newPassword}
						required
					/>
					<Button type="submit" class="w-full" disabled={loading}>
						{loading ? $_('settings.password.submitting') : $_('settings.password.submit')}
					</Button>
				</form>
			</div>
		</section>
	</div>
</main>
