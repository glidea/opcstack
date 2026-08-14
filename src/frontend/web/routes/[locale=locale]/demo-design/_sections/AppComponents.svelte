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
	import { Badge } from "$frontend/ui/badge";
	import { Input } from "$frontend/ui/input";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import SearchIcon from "@lucide/svelte/icons/search";
	import MoreHorizontalIcon from "@lucide/svelte/icons/ellipsis";

	type ProviderAccount = {
		name: string;
		purpose: string;
		models: string;
		status: string;
	};

	const providerAccounts: ProviderAccount[] = [
		{
			name: "Gemini images",
			purpose: "Image generation",
			models: "2 models",
			status: "Ready",
		},
		{
			name: "OpenAI primary",
			purpose: "Image generation",
			models: "1 model",
			status: "Paused",
		},
	];

	let otpValue: string = $state("");
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

	<div class="col-span-12 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
		<header class="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
			<div>
				<p class="text-fine-print uppercase tracking-[0.12em] text-muted-foreground">Operational workspace</p>
				<h3 class="mt-2 text-lg font-semibold">AI providers</h3>
			</div>
			<Button size="sm">
				<PlusIcon />
				Add provider
			</Button>
		</header>

		<div class="grid border-y border-border sm:grid-cols-3">
			<div class="px-6 py-4">
				<p class="text-fine-print text-muted-foreground">Available</p>
				<p class="mt-1 text-xl font-semibold tabular-nums">1</p>
			</div>
			<div class="border-t border-border px-6 py-4 sm:border-t-0 sm:border-l">
				<p class="text-fine-print text-muted-foreground">Paused</p>
				<p class="mt-1 text-xl font-semibold tabular-nums">1</p>
			</div>
			<div class="border-t border-border px-6 py-4 sm:border-t-0 sm:border-l">
				<p class="text-fine-print text-muted-foreground">Models</p>
				<p class="mt-1 text-xl font-semibold tabular-nums">3</p>
			</div>
		</div>

		<div class="border-b border-border p-4 md:px-6">
			<div class="relative max-w-sm">
				<SearchIcon class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input class="pl-9" placeholder="Search providers" aria-label="Search providers" />
			</div>
		</div>

		<div class="divide-y divide-border">
			{#each providerAccounts as provider (provider.name)}
				<div class="grid gap-3 px-6 py-4 md:grid-cols-[minmax(0,1fr)_160px_100px_auto] md:items-center">
					<div>
						<p class="text-sm font-medium">{provider.name}</p>
						<p class="mt-1 text-sm text-muted-foreground">{provider.purpose}</p>
					</div>
					<p class="text-sm text-muted-foreground">{provider.models}</p>
					<Badge variant={provider.status === "Ready" ? "secondary" : "outline"}>{provider.status}</Badge>
					<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${provider.name}`}>
						<MoreHorizontalIcon />
					</Button>
				</div>
			{/each}
		</div>
	</div>

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
