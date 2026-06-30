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
	let agreement: boolean = $state(false);
	let plan: string = $state("monthly");
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

	<div class="col-span-12 flex flex-col gap-4 rounded-[var(--radius-lg)] border border-border bg-card p-6">
		<div class="text-[13px] font-semibold tracking-[-0.13px] text-foreground">
			Field primitives — Field, FieldSet, FieldLegend, FieldGroup, FieldLabel, FieldDescription, FieldError, FieldSeparator
		</div>
		<form class="grid gap-6 md:grid-cols-2" onsubmit={(e) => e.preventDefault()}>
			<Field.Set>
				<Field.Legend>Account</Field.Legend>
				<Field.Group>
					<Field.Field>
						<Field.Label for="ff-name">Display name</Field.Label>
						<Input id="ff-name" placeholder="Jane Doe" />
						<Field.Description>Visible to your collaborators.</Field.Description>
					</Field.Field>

					<Field.Field>
						<Field.Label for="ff-email">Email</Field.Label>
						<Input id="ff-email" type="email" aria-invalid placeholder="invalid@" />
						<Field.Error errors={[{ message: "Enter a valid email address." }]} />
					</Field.Field>

					<Field.Separator />

					<Field.Field orientation="horizontal">
						<Checkbox bind:checked={agreement} id="ff-agree" />
						<Field.Content>
							<Field.Label for="ff-agree">I accept the terms</Field.Label>
							<Field.Description>You can revoke consent anytime.</Field.Description>
						</Field.Content>
					</Field.Field>
				</Field.Group>
			</Field.Set>

			<Field.Set>
				<Field.Legend>Plan</Field.Legend>
				<Field.Group>
					<RadioGroup.Root bind:value={plan}>
						<Field.Field orientation="horizontal">
							<RadioGroup.Item value="monthly" id="plan-m" />
							<Field.Content>
								<Field.Label for="plan-m">Monthly</Field.Label>
								<Field.Description>$9 per month, cancel anytime.</Field.Description>
							</Field.Content>
						</Field.Field>
						<Field.Field orientation="horizontal">
							<RadioGroup.Item value="yearly" id="plan-y" />
							<Field.Content>
								<Field.Label for="plan-y">Yearly</Field.Label>
								<Field.Description>$90 per year, save 17%.</Field.Description>
							</Field.Content>
						</Field.Field>
					</RadioGroup.Root>

					<Field.Title>Notifications</Field.Title>
					<Field.Field orientation="horizontal">
						<Switch checked id="plan-notify" />
						<Field.Content>
							<Field.Label for="plan-notify">Email me on invoices</Field.Label>
						</Field.Content>
					</Field.Field>
				</Field.Group>
			</Field.Set>

			<div class="md:col-span-2 flex justify-end">
				<Button type="submit">Save changes</Button>
			</div>
		</form>
	</div>

	<div class="col-span-12 rounded-[var(--radius-lg)] border border-dashed border-border bg-card p-6">
		<div class="text-[13px] font-semibold tracking-[-0.13px] text-foreground">Form (formsnap)</div>
		<p class="text-caption mt-2 text-muted-foreground">
			<code class="font-mono">$frontend/ui/form/*</code> wraps
			<code class="font-mono">formsnap</code> and integrates with
			<code class="font-mono">sveltekit-superforms</code>. The primitives —
			<code class="font-mono">Form.Field</code>,
			<code class="font-mono">Form.Control</code>,
			<code class="font-mono">Form.Label</code>,
			<code class="font-mono">Form.FieldErrors</code>,
			<code class="font-mono">Form.Description</code>,
			<code class="font-mono">Form.Fieldset</code>,
			<code class="font-mono">Form.Legend</code>,
			<code class="font-mono">Form.ElementField</code>,
			<code class="font-mono">Form.Button</code>
			— require a typed form created in
			<code class="font-mono">+page.server.ts</code> via
			<code class="font-mono">superValidate</code>. Visual layout, label/error tone, and spacing match the Field primitives shown above.
		</p>
	</div>
</Section>
