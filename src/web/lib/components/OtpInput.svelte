<script lang="ts">
	type OtpInputResult = {
		value: string
		focusIndex: number
	}

	let {
		value = $bindable(''),
		disabled = false,
		label = 'Verification code'
	}: {
		value: string
		disabled?: boolean
		label?: string
	} = $props()

	let inputs: Array<HTMLInputElement | undefined> = $state([])
	const digits = $derived(value.padEnd(6, ' ').slice(0, 6).split(''))

	function focusCell(index: number): void {
		inputs[index]?.focus()
		inputs[index]?.select()
	}

	function setDigit(index: number, key: string): OtpInputResult {
		const digit: string = key.replace(/\D/g, '').slice(-1)
		if (digit === '') {
			return {
				value,
				focusIndex: index
			}
		}

		const chars: Array<string> = value.padEnd(6, ' ').slice(0, 6).split('')
		chars[index] = digit
		return {
			value: chars.join('').replace(/\s/g, ''),
			focusIndex: Math.min(index + 1, 5)
		}
	}

	function pasteDigits(text: string): OtpInputResult {
		const nextValue: string = text.replace(/\D/g, '').slice(0, 6)
		if (nextValue === '') {
			return {
				value,
				focusIndex: 0
			}
		}

		return {
			value: nextValue,
			focusIndex: Math.min(nextValue.length, 5)
		}
	}

	function deleteDigit(index: number): OtpInputResult {
		const chars: Array<string> = value.padEnd(6, ' ').slice(0, 6).split('')
		if (chars[index] !== ' ') {
			chars[index] = ' '
			return {
				value: chars.join('').replace(/\s/g, ''),
				focusIndex: index
			}
		}

		const focusIndex: number = Math.max(Math.min(index - 1, value.length - 1), 0)
		chars[focusIndex] = ' '
		return {
			value: chars.join('').replace(/\s/g, ''),
			focusIndex
		}
	}

	function applyResult(result: OtpInputResult): void {
		value = result.value
		requestAnimationFrame((): void => {
			focusCell(result.focusIndex)
		})
	}

	function handleInput(event: Event, index: number): void {
		const target = event.currentTarget as HTMLInputElement
		applyResult(setDigit(index, target.value))
	}

	function handleKeydown(event: KeyboardEvent, index: number): void {
		switch (event.key) {
			case 'Backspace':
				event.preventDefault()
				applyResult(deleteDigit(index))
				break
			case 'ArrowLeft':
				event.preventDefault()
				focusCell(Math.max(index - 1, 0))
				break
			case 'ArrowRight':
				event.preventDefault()
				focusCell(Math.min(index + 1, 5))
				break
		}
	}

	function handlePaste(event: ClipboardEvent): void {
		event.preventDefault()
		applyResult(pasteDigits(event.clipboardData?.getData('text') ?? ''))
	}
</script>

<div class="grid grid-cols-6 gap-2" role="group" aria-label={label}>
	{#each digits as digit, index}
		<input
			bind:this={inputs[index]}
			value={digit.trim()}
			type="text"
			inputmode="numeric"
			autocomplete="one-time-code"
			maxlength="1"
			aria-label={`${label} ${index + 1}`}
			{disabled}
			class="h-11 w-full rounded-md border border-input bg-background text-center text-[21px] font-semibold text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:opacity-50"
			oninput={(event) => handleInput(event, index)}
			onkeydown={(event) => handleKeydown(event, index)}
			onpaste={handlePaste}
		/>
	{/each}
</div>
