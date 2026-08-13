import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'

const initialEmail: string = process.env['E2E_ADMIN_EMAIL'] ?? ''
const initialPassword: string = process.env['E2E_ADMIN_PASSWORD'] ?? ''
const nextEmail: string = process.env['E2E_NEW_ADMIN_EMAIL'] ?? ''
const nextPassword: string = process.env['E2E_NEW_ADMIN_PASSWORD'] ?? ''

test('completes the first-run administrator journey in the browser', async ({ browser }: { browser: Browser }): Promise<void> => {
	test.setTimeout(300_000)
	for (const value of [initialEmail, initialPassword, nextEmail, nextPassword]) {
		expect(value).not.toBe('')
	}

	const context: BrowserContext = await browser.newContext({
		permissions: ['clipboard-read', 'clipboard-write']
	})
	const page: Page = await context.newPage()
	await signIn(page, initialEmail, initialPassword)

	await goToHydrated(page, '/en/settings')
	await page.locator('#settings-email').fill(nextEmail)
	await page.getByRole('button', { name: 'Change email', exact: true }).click()
	await expect(page.getByText('Email changed.')).toBeVisible()

	await page.locator('#current-password').fill(initialPassword)
	await page.locator('#new-password').fill(nextPassword)
	await page.getByRole('button', { name: 'Change password', exact: true }).click()
	await expect(page.getByText('Password changed.')).toBeVisible()

	await goToHydrated(page, '/en/admin/configuration/general')
	const docsSwitch = page.locator('#configuration-docs-enabled')
	await expect(docsSwitch).toBeVisible()
	const docsWereEnabled: boolean = (await docsSwitch.getAttribute('aria-checked')) === 'true'

	await docsSwitch.click()
	await expect(page.getByText('Unsaved changes')).toBeVisible()
	await openConfigurationTab(page, 'email')
	const leaveDialog = page.getByRole('alertdialog')
	await expect(leaveDialog).toBeVisible()
	await leaveDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
	await expect(page).toHaveURL(/\/admin\/configuration\/general$/)

	await openConfigurationTab(page, 'email')
	await leaveDialog.getByRole('button', { name: 'Discard changes', exact: true }).click()
	await expect(page).toHaveURL(/\/admin\/configuration\/email$/)

	await goToHydrated(page, '/en/admin/configuration/general')
	await expect(docsSwitch).toBeVisible()
	const concurrentPage: Page = await context.newPage()
	await goToHydrated(concurrentPage, '/en/admin/configuration/general')
	await docsSwitch.click()
	await expect(page.getByText('Unsaved changes')).toBeVisible()
	await openConfigurationTab(page, 'email')
	await leaveDialog.getByRole('button', { name: 'Save', exact: true }).click()
	await expect(page).toHaveURL(/\/admin\/configuration\/email$/)
	await expect(page.getByText('Configuration saved')).toBeVisible()

	await concurrentPage.locator('#configuration-docs-enabled').click()
	await concurrentPage.getByRole('button', { name: 'Save', exact: true }).click()
	await expect(concurrentPage.getByRole('button', { name: 'Refresh current data', exact: true })).toBeVisible()
	await concurrentPage.getByRole('button', { name: 'Refresh current data', exact: true }).click()
	await expect(concurrentPage.getByRole('button', { name: 'Refresh current data', exact: true })).toHaveCount(0)

	await verifyConfigurationTabs(page)
	await openConfigurationTab(page, 'email')
	const anonymousContext: BrowserContext = await browser.newContext()
	const anonymousPage: Page = await anonymousContext.newPage()
	await goToHydrated(anonymousPage, '/en/login')
	await expect(anonymousPage.getByRole('link', { name: 'Forgot password?', exact: true })).toHaveCount(0)
	await anonymousContext.close()

	await page.locator('#email-provider').click()
	await page.getByRole('option', { name: 'Cloudflare Email', exact: true }).click()
	await page.getByRole('button', { name: 'Save', exact: true }).click()
	await expect(page.getByText('Configuration saved')).toBeVisible()
	await page.locator('#email-provider').click()
	await page.getByRole('option', { name: 'Not configured', exact: true }).click()
	await page.getByRole('button', { name: 'Save', exact: true }).click()
	await expect(page.getByText('Configuration saved')).toBeVisible()

	await page.locator('#email-provider').click()
	await page.getByRole('option', { name: 'Resend', exact: true }).click()
	await page.getByRole('button', { name: 'Save', exact: true }).click()
	await expect(page.getByText('Resend API key is required')).toBeVisible()
	await page.getByRole('button', { name: 'Discard', exact: true }).click()

	await verifyPaymentProductJourney(page, concurrentPage)
	await verifyAIProviderJourney(page, concurrentPage)

	await goToHydrated(page, '/en')
	const docsNavigation = page.locator('header nav a[href="/en/docs"]')
	if (docsWereEnabled) {
		await expect(docsNavigation).toHaveCount(0)
	} else {
		await expect(docsNavigation).toBeVisible()
	}
	await context.close()

	const changedContext: BrowserContext = await browser.newContext()
	const changedPage: Page = await changedContext.newPage()
	await signIn(changedPage, nextEmail, nextPassword)
	await goToHydrated(changedPage, '/en/admin/configuration/general')
	await expect(changedPage.getByRole('heading', { name: 'Configuration' })).toBeVisible()
	await changedContext.close()
})

async function signIn(page: Page, email: string, password: string): Promise<void> {
	await goToHydrated(page, '/en/login')
	await page.locator('#login-email').fill(email)
	await page.locator('#login-password').fill(password)
	await page.getByRole('button', { name: 'Sign in', exact: true }).click()
	await expect(page).toHaveURL(/\/en$/)
}

async function goToHydrated(page: Page, path: string): Promise<void> {
	for (let attempt: number = 0; attempt < 3; attempt += 1) {
		const response = await page.goto(path)
		if (response === null || response.status() < 500) {
			await page.waitForLoadState('networkidle')
			return
		}
		await page.waitForTimeout(100 * (attempt + 1))
	}
	throw new Error(`Navigation kept returning a server error: ${path}`)
}

async function openConfigurationTab(page: Page, domain: string): Promise<void> {
	await page.locator(`a[href="/en/admin/configuration/${domain}"]`).click()
}

async function verifyConfigurationTabs(page: Page): Promise<void> {
	const domains: string[] = ['general', 'authentication', 'email', 'storage', 'credits', 'affiliate']
	for (const domain of domains) {
		await openConfigurationTab(page, domain)
		await expect(page).toHaveURL(new RegExp(`/admin/configuration/${domain}$`))
		await expect(page.getByRole('heading', { name: 'Configuration' })).toBeVisible()
	}
}

async function verifyPaymentProductJourney(page: Page, concurrentPage: Page): Promise<void> {
	await goToHydrated(page, '/en/admin/configuration/payment')
	await page.getByRole('button', { name: 'Expand configuration', exact: true }).click()
	await page.getByRole('button', { name: 'Add override', exact: true }).click()
	await page.locator('#payment-country-0').fill('US')
	await page.locator('#payment-dodo-webhook-url').locator('xpath=..').getByRole('button', { name: 'Copy', exact: true }).click()
	await expect(page.getByText('Copied', { exact: true })).toBeVisible()

	await page.getByRole('button', { name: 'Create product', exact: true }).first().click()
	let productSheet = page.getByRole('dialog')
	await productSheet.locator('#payment-product-id').fill('browser-credits')
	await productSheet.locator('#payment-product-credits').fill('100')
	await productSheet.locator('#payment-product-dodo').fill('browser-dodo-product')
	await productSheet.getByRole('button', { name: 'Save', exact: true }).click()
	const productRow = page.getByRole('row').filter({ hasText: 'browser-credits' })
	await expect(productRow).toContainText('100')
	await expect(page.locator('#payment-country-0')).toHaveValue('US')
	await page.getByRole('button', { name: 'Discard', exact: true }).click()

	await goToHydrated(concurrentPage, '/en/admin/configuration/payment')
	await productRow.scrollIntoViewIfNeeded()
	await productRow.evaluate((element: HTMLElement): void => element.scrollIntoView({ block: 'center' }))
	await productRow.getByRole('button', { name: 'Edit', exact: true }).click()
	await concurrentPage.getByRole('row').filter({ hasText: 'browser-credits' }).getByRole('button', { name: 'Edit', exact: true }).click()
	productSheet = page.getByRole('dialog')
	const concurrentProductSheet = concurrentPage.getByRole('dialog')
	await productSheet.locator('#payment-product-credits').fill('101')
	await concurrentProductSheet.locator('#payment-product-credits').fill('102')
	await productSheet.getByRole('button', { name: 'Save', exact: true }).click()
	await concurrentProductSheet.getByRole('button', { name: 'Save', exact: true }).click()
	await expect(concurrentProductSheet.locator('#payment-product-credits')).toHaveValue('102')
	await expect(concurrentProductSheet.getByRole('button', { name: 'Refresh current data', exact: true })).toBeVisible()
	await concurrentProductSheet.getByRole('button', { name: 'Refresh current data', exact: true }).click()
	await expect(productRow).toContainText('101')

	await productRow.getByRole('button', { name: 'Delete', exact: true }).click()
	await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click()
	await expect(productRow).toHaveCount(0)
}

async function verifyAIProviderJourney(page: Page, concurrentPage: Page): Promise<void> {
	await goToHydrated(page, '/en/admin/configuration/ai')
	await expect(page.locator('#ai-routing-error')).toBeVisible()
	const routingErrorInput = page.locator('#ai-routing-error')
	const routingErrorOriginal: string = await routingErrorInput.inputValue()
	const routingErrorDraft: string = routingErrorOriginal === '2' ? '3' : '2'
	await routingErrorInput.fill(routingErrorDraft)
	await page.getByRole('button', { name: 'Create provider', exact: true }).first().click()
	let providerSheet = page.getByRole('dialog')
	await providerSheet.locator('#ai-provider-id').fill('browser-gemini')
	await providerSheet.locator('#ai-provider-name').fill('Browser Gemini')
	await providerSheet.locator('#ai-provider-base-url').fill('https://example.com')
	await providerSheet.locator('#ai-provider-models').fill('browser-image-model')
	await providerSheet.locator('#ai-provider-api-key').fill('browser-provider-secret')
	await providerSheet.getByRole('button', { name: 'Save', exact: true }).click()
	const providerRow = page.getByRole('row').filter({ hasText: 'browser-gemini' })
	await expect(providerRow).toContainText('Browser Gemini')
	await expect(providerRow).toContainText('Configured')
	await expect(page.getByText('browser-provider-secret', { exact: true })).toHaveCount(0)
	await expect(routingErrorInput).toHaveValue(routingErrorDraft)

	await goToHydrated(concurrentPage, '/en/admin/configuration/ai')
	await providerRow.scrollIntoViewIfNeeded()
	await providerRow.evaluate((element: HTMLElement): void => element.scrollIntoView({ block: 'center' }))
	await providerRow.getByRole('button', { name: 'Edit', exact: true }).click()
	await concurrentPage.getByRole('row').filter({ hasText: 'browser-gemini' }).getByRole('button', { name: 'Edit', exact: true }).click()
	providerSheet = page.getByRole('dialog')
	const concurrentProviderSheet = concurrentPage.getByRole('dialog')
	await providerSheet.locator('#ai-provider-name').fill('Browser Gemini disabled')
	await providerSheet.locator('#ai-provider-enabled').click()
	await concurrentProviderSheet.locator('#ai-provider-name').fill('Browser Gemini stale')
	await providerSheet.getByRole('button', { name: 'Save', exact: true }).click()
	await concurrentProviderSheet.getByRole('button', { name: 'Save', exact: true }).click()
	await expect(concurrentProviderSheet.locator('#ai-provider-name')).toHaveValue('Browser Gemini stale')
	await expect(concurrentProviderSheet.getByRole('button', { name: 'Refresh current data', exact: true })).toBeVisible()
	await concurrentProviderSheet.getByRole('button', { name: 'Refresh current data', exact: true }).click()
	await expect(providerRow).toContainText('Browser Gemini disabled')
	await expect(providerRow).toContainText('Disabled')

	await providerRow.getByRole('button', { name: 'Delete', exact: true }).click()
	await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click()
	await expect(providerRow).toHaveCount(0)
	await page.getByRole('button', { name: 'Discard', exact: true }).click()
	await expect(routingErrorInput).toHaveValue(routingErrorOriginal)
}
