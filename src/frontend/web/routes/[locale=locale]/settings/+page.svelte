<script lang="ts">
	import { goto } from '$app/navigation'
	import { client } from '$frontend/api-client'
	import AppHeader from '$frontend/app-ui/shell/AppHeader.svelte'
	import UserMenu from '$frontend/app-ui/shell/UserMenu.svelte'
	import { _ } from '$frontend/i18n'
	import { Button } from '$frontend/ui/button'
	import { Input } from '$frontend/ui/input'

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

	let currentPassword: string = $state('')
	let newPassword: string = $state('')
	let loading: boolean = $state(false)
	let error: string = $state('')
	let success: boolean = $state(false)

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

		<section class="border-t border-border py-8">
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
					<Input
						type="password"
						placeholder={$_('settings.password.currentPassword')}
						bind:value={currentPassword}
						required
					/>
					<Input
						type="password"
						placeholder={$_('settings.password.newPassword')}
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
