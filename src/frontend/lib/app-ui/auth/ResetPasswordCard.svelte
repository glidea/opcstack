<script lang="ts">
	import { client } from '$frontend/api-client'
	import { _ } from '$frontend/i18n'
	import { Alert, AlertDescription } from '$frontend/ui/alert'
	import { Button } from '$frontend/ui/button'
	import { Field, FieldLabel } from '$frontend/ui/field'
	import { Input } from '$frontend/ui/input'
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert'
	import OtpInput from './OtpInput.svelte'

	let {
		email,
		onSuccess,
		loginHref = '/login'
	}: {
		email: string
		onSuccess?: () => void
		loginHref?: string
	} = $props()

	let otp = $state('')
	let newPassword = $state('')
	let loading = $state(false)
	let error = $state('')

	async function handleReset(): Promise<void> {
		loading = true
		error = ''
		const result = await client.auth.emailOtp.resetPassword({
			email,
			otp,
			password: newPassword
		})
		loading = false
		if (result.error) {
			error = result.error.message ?? $_('auth.resetPassword.submit')
			return
		}
		onSuccess?.()
	}
</script>

<div class="mx-auto w-full max-w-[380px] space-y-6">
	<div class="text-center">
		<h1 class="text-[28px] font-semibold tracking-tight">{$_('auth.resetPassword.title')}</h1>
		<p class="mt-2 text-muted-foreground">
			{$_('auth.resetPassword.subtitle', { values: { email } })}
		</p>
	</div>

	<form class="space-y-4" onsubmit={(e) => { e.preventDefault(); handleReset() }}>
		{#if error}
			<Alert variant="destructive">
				<CircleAlertIcon />
				<AlertDescription>{error}</AlertDescription>
			</Alert>
		{/if}
		<OtpInput bind:value={otp} disabled={loading} label={$_('auth.resetPassword.title')} />
		<Field>
			<FieldLabel for="reset-new-password">{$_('auth.resetPassword.newPassword')}</FieldLabel>
			<Input id="reset-new-password" type="password" autocomplete="new-password" bind:value={newPassword} required />
		</Field>
		<Button type="submit" class="w-full" disabled={loading || otp.length !== 6}>
			{loading ? $_('auth.resetPassword.submitting') : $_('auth.resetPassword.submit')}
		</Button>
	</form>

	<p class="text-center text-sm text-muted-foreground">
		<a href={loginHref} class="text-primary hover:text-primary/80">
			{$_('auth.resetPassword.backToSignIn')}
		</a>
	</p>
</div>
