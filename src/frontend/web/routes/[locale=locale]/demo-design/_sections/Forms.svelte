<script lang="ts">
	import { _ } from "$frontend/i18n";
	import Section from "./Section.svelte";
	import Block from "./Block.svelte";

	import { Button } from "$frontend/ui/button";
	import { Input } from "$frontend/ui/input";
	import { Textarea } from "$frontend/ui/textarea";
	import { Label } from "$frontend/ui/label";
	import * as Select from "$frontend/ui/select";
	import { Checkbox } from "$frontend/ui/checkbox";
	import * as RadioGroup from "$frontend/ui/radio-group";
	import { Switch } from "$frontend/ui/switch";
	import { Slider } from "$frontend/ui/slider";
	import * as InputOTP from "$frontend/ui/input-otp";
	import * as InputGroup from "$frontend/ui/input-group";
	import * as Field from "$frontend/ui/field";
	import OtpInput from "$frontend/app-ui/auth/OtpInput.svelte";

	import SearchIcon from "@lucide/svelte/icons/search";
	import MailIcon from "@lucide/svelte/icons/mail";
	import EyeIcon from "@lucide/svelte/icons/eye";
	import AtSignIcon from "@lucide/svelte/icons/at-sign";
	import GlobeIcon from "@lucide/svelte/icons/globe";

	let textValue: string = $state("");
	let textareaValue: string = $state("");
	let selectValue: string = $state("light");
	let checkboxA: boolean = $state(true);
	let checkboxB: boolean = $state(false);
	let radioValue: string = $state("monthly");
	let switchA: boolean = $state(true);
	let switchB: boolean = $state(false);
	let sliderValue: number = $state(42);
	let rangeValue: number[] = $state([20, 80]);
	let otpValue: string = $state("");
	let otpLegacy: string = $state("");
	let registrationEnabled: boolean = $state(true);
	let registrationDomain: string = $state("");
	let verificationRequired: boolean = $state(true);
	let saveAttempted: boolean = $state(false);

	function saveRegistration(event: SubmitEvent): void {
		event.preventDefault();
		saveAttempted = true;
	}
</script>

<Section
	id="forms"
	eyebrow={$_("designSystem.s3.eyebrow")}
	title={$_("designSystem.s3.title")}
	description={$_("designSystem.s3.desc")}
	surface="parchment"
>
	<Block title={$_("designSystem.s3.b.textInput")} span={2}>
		<div class="flex w-full flex-col gap-3">
			<div class="space-y-2">
				<Label for="demo-input-email">Email</Label>
				<Input id="demo-input-email" type="email" placeholder="you@example.com" bind:value={textValue} />
			</div>
			<div class="space-y-2">
				<Label for="demo-input-disabled">Disabled</Label>
				<Input id="demo-input-disabled" placeholder="—" disabled />
			</div>
			<div class="space-y-2">
				<Label for="demo-input-invalid">Invalid</Label>
				<Input id="demo-input-invalid" aria-invalid placeholder="Invalid input" />
			</div>
		</div>
	</Block>

	<Block title={$_("designSystem.s3.b.textarea")} span={2}>
		<div class="w-full space-y-2">
			<Label for="demo-textarea">Message</Label>
			<Textarea
				id="demo-textarea"
				placeholder="Type a message..."
				bind:value={textareaValue}
				rows={4}
			/>
		</div>
	</Block>

	<Block title={$_("designSystem.s3.b.select")} span={2}>
		<div class="space-y-2">
			<Label for="demo-select">Theme</Label>
			<Select.Root type="single" bind:value={selectValue}>
				<Select.Trigger id="demo-select" class="w-[220px]">
					{selectValue === "" ? "Pick a theme" : selectValue}
				</Select.Trigger>
				<Select.Content>
					<Select.Group>
						<Select.GroupHeading>Appearance</Select.GroupHeading>
						<Select.Item value="light">Light</Select.Item>
						<Select.Item value="dark">Dark</Select.Item>
						<Select.Item value="system">System</Select.Item>
					</Select.Group>
				</Select.Content>
			</Select.Root>
		</div>
	</Block>

	<Block title={$_("designSystem.s3.b.checkbox")} span={2}>
		<div class="flex w-full flex-col gap-3">
			<label class="flex items-start gap-2 text-sm">
				<Checkbox bind:checked={checkboxA} />
				<span>Subscribe to product news</span>
			</label>
			<label class="flex items-start gap-2 text-sm">
				<Checkbox bind:checked={checkboxB} />
				<span>Send me account-only emails</span>
			</label>
			<label class="flex items-start gap-2 text-sm opacity-50">
				<Checkbox checked disabled />
				<span>Locked option (disabled)</span>
			</label>
		</div>
	</Block>

	<Block title={$_("designSystem.s3.b.radio")} span={2}>
		<RadioGroup.Root bind:value={radioValue}>
			<label class="flex items-center gap-2 text-sm">
				<RadioGroup.Item value="monthly" />
				<span>Monthly · $9</span>
			</label>
			<label class="flex items-center gap-2 text-sm">
				<RadioGroup.Item value="yearly" />
				<span>Yearly · $90 (save 17%)</span>
			</label>
			<label class="flex items-center gap-2 text-sm">
				<RadioGroup.Item value="lifetime" />
				<span>Lifetime · $299</span>
			</label>
		</RadioGroup.Root>
	</Block>

	<Block title={$_("designSystem.s3.b.switch")} span={2}>
		<div class="flex w-full flex-col gap-3">
			<label class="flex items-center justify-between text-sm">
				<span>Enable analytics</span>
				<Switch bind:checked={switchA} />
			</label>
			<label class="flex items-center justify-between text-sm">
				<span>Compact mode</span>
				<Switch bind:checked={switchB} size="sm" />
			</label>
		</div>
	</Block>

	<Block title={$_("designSystem.s3.b.slider")} span={2}>
		<div class="flex w-full flex-col gap-6 pt-2">
			<div class="space-y-3">
				<div class="flex items-center justify-between text-caption text-muted-foreground">
					<span>Volume</span>
					<span class="tabular-nums">{sliderValue}</span>
				</div>
				<Slider type="single" bind:value={sliderValue} max={100} step={1} />
			</div>
			<div class="space-y-3">
				<div class="flex items-center justify-between text-caption text-muted-foreground">
					<span>Range</span>
					<span class="tabular-nums">{rangeValue[0]}–{rangeValue[1]}</span>
				</div>
				<Slider type="multiple" bind:value={rangeValue} max={100} step={1} />
			</div>
		</div>
	</Block>

	<Block title={$_("designSystem.s3.b.otp")} description="Bits-ui PinInput primitive." span={2}>
		<div class="flex w-full flex-col gap-3">
			<InputOTP.Root maxlength={6} bind:value={otpValue}>
				{#snippet children({ cells })}
					<InputOTP.Group>
						{#each cells.slice(0, 3) as cell, i (i)}
							<InputOTP.Slot {cell} />
						{/each}
					</InputOTP.Group>
					<InputOTP.Separator />
					<InputOTP.Group>
						{#each cells.slice(3, 6) as cell, i (i)}
							<InputOTP.Slot {cell} />
						{/each}
					</InputOTP.Group>
				{/snippet}
			</InputOTP.Root>
			<span class="text-fine-print text-muted-foreground">value: {otpValue || "—"}</span>
		</div>
	</Block>

	<Block title={$_("designSystem.s3.b.otpCustom")} description="app-ui/auth/OtpInput.svelte." span={2}>
		<div class="w-full space-y-3">
			<OtpInput bind:value={otpLegacy} label="Verification code" />
			<span class="text-fine-print text-muted-foreground">value: {otpLegacy || "—"}</span>
		</div>
	</Block>

	<Block title={$_("designSystem.s3.b.inputGroupPrefix")} span={2}>
		<div class="w-full space-y-3">
			<InputGroup.Root>
				<InputGroup.Addon align="inline-start">
					<SearchIcon />
				</InputGroup.Addon>
				<InputGroup.Input placeholder="Search the store" />
				<InputGroup.Addon align="inline-end">
					<InputGroup.Button>Go</InputGroup.Button>
				</InputGroup.Addon>
			</InputGroup.Root>

			<InputGroup.Root>
				<InputGroup.Addon align="inline-start">
					<AtSignIcon />
				</InputGroup.Addon>
				<InputGroup.Input placeholder="username" />
			</InputGroup.Root>

			<InputGroup.Root>
				<InputGroup.Addon align="inline-start">
					<GlobeIcon />
				</InputGroup.Addon>
				<InputGroup.Text>https://</InputGroup.Text>
				<InputGroup.Input placeholder="example.com" />
				<InputGroup.Addon align="inline-end">
					<InputGroup.Button variant="ghost">
						<EyeIcon />
					</InputGroup.Button>
				</InputGroup.Addon>
			</InputGroup.Root>
		</div>
	</Block>

	<Block title={$_("designSystem.s3.b.inputGroupBlock")} span={2}>
		<div class="w-full">
			<InputGroup.Root>
				<InputGroup.Addon align="block-start">
					<MailIcon />
					<span>Reply to this thread</span>
				</InputGroup.Addon>
				<InputGroup.Textarea placeholder="Compose your reply..." rows={3} />
				<InputGroup.Addon align="block-end">
					<InputGroup.Button size="sm">Send</InputGroup.Button>
				</InputGroup.Addon>
			</InputGroup.Root>
		</div>
	</Block>

	<div class="col-span-12 rounded-[var(--radius-lg)] border border-border bg-card p-6 md:p-8">
		<div class="max-w-3xl">
			<div class="max-w-2xl">
				<p class="text-fine-print uppercase tracking-[0.12em] text-muted-foreground">Complete settings form</p>
				<h3 class="mt-2 text-lg font-semibold">Registration access</h3>
				<p class="mt-1 text-sm text-muted-foreground">
					Group dependent controls under the decision that makes them relevant
				</p>
			</div>

			<form class="mt-8" onsubmit={saveRegistration}>
				<section class="grid gap-5 border-t py-6 md:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
					<div>
						<h4 class="text-sm font-semibold">Account creation</h4>
						<p class="mt-1 text-sm text-muted-foreground">Choose who may create an account</p>
					</div>
					<div class="max-w-lg space-y-5">
						<Field.Field orientation="horizontal">
							<Field.Content>
								<Field.Label for="registration-enabled">Allow registration</Field.Label>
								<Field.Description>New visitors can create accounts</Field.Description>
							</Field.Content>
							<Switch id="registration-enabled" bind:checked={registrationEnabled} />
						</Field.Field>

						{#if registrationEnabled}
							<Field.Field>
								<Field.Label for="registration-domain">Allowed email domain</Field.Label>
								<Input
									id="registration-domain"
									class="max-w-sm"
									placeholder="example.com"
									bind:value={registrationDomain}
									aria-invalid={saveAttempted && registrationDomain.trim() === ""}
								/>
								<Field.Description>Leave unrestricted only when any email domain is acceptable</Field.Description>
								<Field.Error
									errors={saveAttempted && registrationDomain.trim() === ""
										? [{ message: "Add a domain or explicitly allow every domain" }]
										: []}
								/>
							</Field.Field>
						{/if}
					</div>
				</section>

				{#if registrationEnabled}
					<section class="grid gap-5 border-t py-6 md:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
						<div>
							<h4 class="text-sm font-semibold">Email verification</h4>
							<p class="mt-1 text-sm text-muted-foreground">Confirm ownership before account use</p>
						</div>
						<div class="max-w-lg space-y-5">
							<Field.Field orientation="horizontal">
								<Field.Content>
									<Field.Label for="verification-required">Require email verification</Field.Label>
									<Field.Description>Available only after an email provider is configured</Field.Description>
								</Field.Content>
								<Switch id="verification-required" bind:checked={verificationRequired} />
							</Field.Field>

							{#if verificationRequired}
								<Field.Field class="max-w-32">
									<Field.Label for="verification-cooldown">Retry delay</Field.Label>
									<Input id="verification-cooldown" type="number" value="60" min="10" />
									<Field.Description>Seconds</Field.Description>
								</Field.Field>
							{/if}
						</div>
					</section>
				{/if}

				<div class="flex justify-end border-t pt-6">
					<Button type="submit">Save registration settings</Button>
				</div>
			</form>
		</div>
	</div>
</Section>
