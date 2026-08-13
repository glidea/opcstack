<script lang="ts">
	import { _ } from "$frontend/i18n";
	import Section from "./Section.svelte";
	import Block from "./Block.svelte";

	import ThemeSwitcher from "$frontend/app-ui/shell/ThemeSwitcher.svelte";
	import LocaleSwitcher from "$frontend/app-ui/shell/LocaleSwitcher.svelte";
	import GitHubIcon from "$frontend/app-ui/auth/GitHubIcon.svelte";
	import GoogleIcon from "$frontend/app-ui/auth/GoogleIcon.svelte";
	import OtpInput from "$frontend/app-ui/auth/OtpInput.svelte";
	import OtpCard from "$frontend/app-ui/auth/OtpCard.svelte";
	import LoginCard from "$frontend/app-ui/auth/LoginCard.svelte";
	import RegisterCard from "$frontend/app-ui/auth/RegisterCard.svelte";
	import ForgotPasswordCard from "$frontend/app-ui/auth/ForgotPasswordCard.svelte";
	import ResetPasswordCard from "$frontend/app-ui/auth/ResetPasswordCard.svelte";
	import { Button } from "$frontend/ui/button";

	let otpValue = $state("");
</script>

<Section
	id="app"
	eyebrow={$_("designSystem.s8.eyebrow")}
	title={$_("designSystem.s8.title")}
	description={$_("designSystem.s8.desc")}
	surface="light"
>
	<!-- AppHeader description -->
	<div class="col-span-12 flex flex-col gap-2 rounded-[var(--radius-lg)] border border-border bg-card p-6">
		<div class="text-[13px] font-semibold tracking-[-0.13px] text-foreground">AppHeader</div>
		<p class="text-caption text-muted-foreground">
			↑ Visible at the top of this page. Sticky 44px chrome with logo, locale switcher, theme switcher, and an optional <code class="font-mono">actions</code> snippet for trailing controls. Pass <code class="font-mono">showSidebarTrigger</code> when used inside a Sidebar layout (this page included).
		</p>
	</div>

	<!-- ThemeSwitcher + LocaleSwitcher + GoogleIcon -->
	<Block title="ThemeSwitcher" span={1}>
		<ThemeSwitcher />
	</Block>

	<Block title="LocaleSwitcher" span={1}>
		<LocaleSwitcher current="en" />
	</Block>

	<Block title="GoogleIcon" span={1}>
		<GoogleIcon />
	</Block>

	<Block title="GitHubIcon" span={1}>
		<GitHubIcon />
	</Block>

	<Block title="UserMenu" description="Only renders when session is active. Sign in to see it." span={1}>
		<span class="text-caption text-muted-foreground">Requires active session — visible in the header after login.</span>
	</Block>

	<!-- OtpInput standalone -->
	<Block title="OtpInput (standalone)" span={2}>
		<div class="w-full space-y-2">
			<OtpInput bind:value={otpValue} label="Verification code" />
			<span class="text-fine-print text-muted-foreground">value: {otpValue || "—"}</span>
		</div>
	</Block>

	<!-- Auth cards — visual only -->
	<div class="col-span-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
		<div class="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-8">
			<div class="text-[13px] font-semibold tracking-[-0.13px] text-foreground mb-2">LoginCard</div>
			<LoginCard
				googleAuthEnabled={true}
				githubAuthEnabled={true}
				linuxdoAuthEnabled={true}
				registrationEnabled={true}
				registerHref="#"
				forgotPasswordHref="#"
				turnstileEnabled={false}
				turnstileSiteKey=""
			/>
		</div>

		<div class="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-8">
			<div class="text-[13px] font-semibold tracking-[-0.13px] text-foreground mb-2">RegisterCard</div>
			<RegisterCard
				googleAuthEnabled={true}
				githubAuthEnabled={true}
				linuxdoAuthEnabled={true}
				registrationEnabled={true}
				emailRequireVerification={true}
				emailUserActionCooldownSeconds={60}
				loginHref="#"
				turnstileEnabled={false}
				turnstileSiteKey=""
			/>
		</div>

		<div class="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-8">
			<div class="text-[13px] font-semibold tracking-[-0.13px] text-foreground mb-2">ForgotPasswordCard</div>
			<ForgotPasswordCard
				emailUserActionCooldownSeconds={60}
				loginHref="#"
				turnstileEnabled={false}
				turnstileSiteKey=""
			/>
		</div>

		<div class="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-8">
			<div class="text-[13px] font-semibold tracking-[-0.13px] text-foreground mb-2">ResetPasswordCard</div>
			<ResetPasswordCard
				email="user@example.com"
				loginHref="#"
			/>
		</div>

		<div class="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-8">
			<div class="text-[13px] font-semibold tracking-[-0.13px] text-foreground mb-2">OtpCard</div>
			<OtpCard
				email="user@example.com"
				type="email-verification"
				emailUserActionCooldownSeconds={60}
			/>
		</div>
	</div>
</Section>
