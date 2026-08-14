import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'

const initialEmail: string = process.env['E2E_ADMIN_EMAIL'] ?? ''
const initialPassword: string = process.env['E2E_ADMIN_PASSWORD'] ?? ''
const nextPassword: string = process.env['E2E_NEW_ADMIN_PASSWORD'] ?? ''

test('completes the first-run administrator journey in the browser', async ({ browser }: { browser: Browser }): Promise<void> => {
	test.setTimeout(600_000)
	for (const value of [initialEmail, initialPassword, nextPassword]) {
		expect(value).not.toBe('')
	}

	const context: BrowserContext = await browser.newContext({
		permissions: ['clipboard-read', 'clipboard-write']
	})
	context.setDefaultTimeout(15_000)
	const page: Page = await context.newPage()
	console.log('E2E stage: account settings')
	await signIn(page, initialEmail, initialPassword)

	await goToHydrated(page, '/en/settings')
	await expect(page.locator('#settings-email')).toHaveCount(0)
	await expect(page.getByRole('heading', { name: 'Connected accounts', exact: true })).toBeVisible()
	await expect(page.getByRole('heading', { name: 'API access', exact: true })).toBeVisible()
	await expect(page).not.toHaveURL(/settings\/api-access/)

	await page.locator('#current-password').fill(initialPassword)
	await page.locator('#new-password').fill(nextPassword)
	await page.getByRole('button', { name: 'Change password', exact: true }).click()
	await expect(page.getByText('Password changed', { exact: true })).toBeVisible()

	console.log('E2E stage: system settings')
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

	console.log('E2E stage: payment products')
	await verifyPaymentProductJourney(page, concurrentPage)
	console.log('E2E stage: AI providers')
	await verifyAIProviderJourney(page, concurrentPage)
	console.log('E2E stage: administration workspaces')
	await verifyAdminBetaCodes(page)
	await verifyAdminCreditCodes(page)
	await verifyAdminListLayout(page)
	await verifyAdminUsers(page, initialEmail)
	await verifyCreditActivity(page, initialEmail)
	await verifyInvitations(page)
	await verifyAdminNotifications(page)

	await goToHydrated(page, '/en')
	const docsNavigation = page.locator('header nav a[href="/en/docs"]')
	if (docsWereEnabled) {
		await expect(docsNavigation).toHaveCount(0)
	} else {
		await expect(docsNavigation).toBeVisible()
	}
	await context.close()

	console.log('E2E stage: changed password sign-in')
	const changedContext: BrowserContext = await browser.newContext()
	changedContext.setDefaultTimeout(15_000)
	const changedPage: Page = await changedContext.newPage()
	await signIn(changedPage, initialEmail, nextPassword)
	await goToHydrated(changedPage, '/en/admin/configuration/general')
	await expect(changedPage.getByRole('heading', { name: 'System settings' })).toBeVisible()
	await changedContext.close()
})

async function verifyAdminBetaCodes(page: Page): Promise<void> {
	await goToHydrated(page, '/en/admin/beta-codes')
	const generateButton = page.getByRole('button', { name: 'Generate codes', exact: true })
	await expect(generateButton).toHaveCSS('height', '36px')
	const positions = await Promise.all([
		page.locator('#beta-code-filter').boundingBox(),
		page.locator('#beta-user-filter').boundingBox(),
		page.locator('#beta-status-filter').boundingBox(),
		page.getByRole('button', { name: 'Apply filters', exact: true }).boundingBox()
	])
	for (const position of positions) {
		expect(position).not.toBeNull()
	}
	const controlTopPositions: number[] = positions.map((position): number => position?.y ?? -1)
	expect(Math.max(...controlTopPositions) - Math.min(...controlTopPositions)).toBeLessThanOrEqual(1)
	await expect(page.getByText('Advanced filters', { exact: true })).toBeVisible()
}

async function verifyAdminCreditCodes(page: Page): Promise<void> {
	await goToHydrated(page, '/en/admin/credit-codes')
	const generateButton = page.getByRole('button', { name: 'Generate codes', exact: true })
	await expect(generateButton).toHaveCSS('height', '36px')
	const positions = await Promise.all([
		page.locator('#credit-code-filter').boundingBox(),
		page.locator('#credit-user-filter').boundingBox(),
		page.locator('#credit-status-filter').boundingBox(),
		page.getByRole('button', { name: 'Apply filters', exact: true }).boundingBox()
	])
	for (const position of positions) {
		expect(position).not.toBeNull()
	}
	const controlTopPositions: number[] = positions.map((position): number => position?.y ?? -1)
	expect(Math.max(...controlTopPositions) - Math.min(...controlTopPositions)).toBeLessThanOrEqual(1)
	await expect(page.getByText('Advanced filters', { exact: true })).toBeVisible()
}

async function verifyAdminListLayout(page: Page): Promise<void> {
	const listPages: string[] = [
		'/en/admin/users',
		'/en/admin/credit-transactions',
		'/en/admin/affiliate-referrals',
		'/en/admin/beta-codes',
		'/en/admin/credit-codes',
		'/en/admin/feedback',
		'/en/admin/notifications',
		'/en/admin/payments',
		'/en/admin/ai-tasks'
	]
	for (const path of listPages) {
		await goToHydrated(page, path)
		const refreshButton = page.locator('.admin-page-header button[aria-label]').last()
		await expect(refreshButton).toHaveCSS('height', '36px')
		const filterBar = page.locator('form.admin-filter-bar')
		const style = await filterBar.evaluate((element: HTMLElement): { borderTopWidth: string; paddingTop: string; backgroundColor: string } => {
			const computedStyle: CSSStyleDeclaration = window.getComputedStyle(element)
			return {
				borderTopWidth: computedStyle.borderTopWidth,
				paddingTop: computedStyle.paddingTop,
				backgroundColor: computedStyle.backgroundColor
			}
		})
		expect(style).toEqual({ borderTopWidth: '0px', paddingTop: '0px', backgroundColor: 'rgba(0, 0, 0, 0)' })
	}
}

async function verifyAdminUsers(page: Page, administratorEmail: string): Promise<void> {
	await goToHydrated(page, '/en/admin/users')
	await expect(page.locator('label[for="user-search"]')).toHaveClass(/sr-only/)
	await expect(page.getByRole('columnheader', { name: 'Remaining credits', exact: true })).toBeVisible()
	await expect(page.getByText('No beta access', { exact: true })).toHaveCount(0)
	const administratorRow = page.getByRole('row').filter({ hasText: administratorEmail })
	await expect(administratorRow).toBeVisible()
	await expect(administratorRow.getByRole('cell').nth(2)).toHaveText('0')
	await administratorRow.getByRole('button', { name: 'View', exact: true }).click()
	const userSheet = page.getByRole('dialog')
	await expect(userSheet.getByRole('heading', { name: administratorEmail, exact: true })).toBeVisible()
	await expect(userSheet.getByText('Email verified', { exact: true })).toHaveCount(0)
	await expect(userSheet.getByRole('heading', { name: 'Access', exact: true })).toHaveCount(0)
	await expect(userSheet.getByText('Database', { exact: true })).toHaveCount(0)
	await expect(userSheet.getByText('Database ID', { exact: true })).toHaveCount(0)
	await page.getByRole('button', { name: 'Grant credits', exact: true }).click()
	const grantDialog = page.getByRole('dialog', { name: 'Grant credits', exact: true })
	await expect(grantDialog.getByRole('radio', { name: 'Never expires', exact: true })).toBeVisible()
	await expect(grantDialog.getByRole('radio', { name: 'One week', exact: true })).toBeVisible()
	await expect(grantDialog.getByRole('radio', { name: 'One month', exact: true })).toBeVisible()
	await expect(grantDialog.locator('#grant-expires')).toHaveCount(0)
	await page.locator('#grant-amount').fill('2.5')
	await page.getByRole('button', { name: 'Review grant', exact: true }).click()
	await page.getByRole('button', { name: 'Confirm grant', exact: true }).click()
	await expect(page.getByText('Balance updated to 2.500000', { exact: true })).toBeVisible()
	await page.keyboard.press('Escape')
	await expect(administratorRow.getByRole('cell').nth(2)).toHaveText('2.5')
	await goToHydrated(page, '/en/admin/users')
	await expect(page.getByRole('row').filter({ hasText: administratorEmail }).getByRole('cell').nth(2)).toHaveText('2.5')
}

async function verifyCreditActivity(page: Page, administratorEmail: string): Promise<void> {
	await goToHydrated(page, '/en/admin/credit-transactions')
	await expect(page.getByRole('heading', { name: 'Credit activity', exact: true })).toBeVisible()
	await expect(page.getByRole('link', { name: 'Credit activity', exact: true })).toBeVisible()
	await page.locator('#credit-transaction-user').click()
	await page.getByPlaceholder('Search by name or email').fill(administratorEmail)
	await page.getByRole('option').filter({ hasText: administratorEmail }).click()
	await page.getByRole('button', { name: 'View activity', exact: true }).click()
	await expect(page.getByRole('row').filter({ hasText: '2.5' })).toBeVisible()
}

async function verifyInvitations(page: Page): Promise<void> {
	await goToHydrated(page, '/en/admin/affiliate-referrals')
	await expect(page.getByRole('heading', { name: 'Invitations', exact: true })).toBeVisible()
	await expect(page.getByRole('link', { name: 'Invitations', exact: true })).toBeVisible()
	await expect(page.getByText('No invitations found', { exact: true })).toBeVisible()
}

async function verifyAdminNotifications(page: Page): Promise<void> {
	const title: string = `Browser notification ${Date.now()}`
	const updatedTitle: string = `${title} updated`

	await goToHydrated(page, '/en/admin/notifications')
	await page.getByRole('button', { name: 'Publish notification', exact: true }).click()
	await page.locator('#notification-title').fill(title)
	await page.locator('#notification-content').fill('Initial browser notification content')
	await page.getByRole('button', { name: 'Review publication', exact: true }).click()
	await page.getByRole('button', { name: 'Publish now', exact: true }).click()

	const notificationRow = page.getByRole('row').filter({ hasText: title })
	await expect(notificationRow).toBeVisible()
	await notificationRow.getByRole('button', { name: 'View', exact: true }).click()
	const notificationSheet = page.getByRole('dialog')
	await expect(notificationSheet.getByRole('heading', { name: title, exact: true })).toBeVisible()
	await expect(notificationSheet.getByText('Notification ID', { exact: true })).toHaveCount(0)

	await notificationSheet.getByRole('button', { name: 'Edit', exact: true }).click()
	await notificationSheet.locator('#notification-edit-title').fill(updatedTitle)
	await notificationSheet.locator('#notification-edit-content').fill('Updated browser notification content')
	await notificationSheet.getByRole('button', { name: 'Save', exact: true }).click()
	await expect(notificationSheet.getByRole('heading', { name: updatedTitle, exact: true })).toBeVisible()

	await notificationSheet.getByRole('button', { name: 'Archive', exact: true }).click()
	await expect(notificationSheet.getByText('Archive this notification', { exact: true })).toBeVisible()
	await notificationSheet.getByRole('button', { name: 'Archive', exact: true }).click()
	await expect(notificationSheet.locator('[data-slot="badge"]').filter({ hasText: 'Archived' })).toBeVisible()
	await expect(notificationSheet.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
	await page.keyboard.press('Escape')
	await expect(page.getByRole('row').filter({ hasText: updatedTitle }).getByText('Archived', { exact: true })).toBeVisible()
}

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
	const domains: string[] = ['general', 'authentication', 'email', 'credits', 'affiliate', 'payment', 'ai']
	for (const domain of domains) {
		await openConfigurationTab(page, domain)
		await expect(page).toHaveURL(new RegExp(`/admin/configuration/${domain}$`))
		await expect(page.getByRole('heading', { name: 'System settings' })).toBeVisible()
	}
	await expect(page.locator('a[href="/en/admin/configuration/storage"]')).toHaveCount(0)

	await goToHydrated(page, '/en/admin/configuration/authentication')
	await expect(page.locator('#auth-beta-code')).toHaveCount(0)
	await page.locator('#auth-registration').click()
	await expect(page.locator('#auth-beta-code')).toBeVisible()
	const registrationPosition = await page.locator('#auth-registration').boundingBox()
	const betaCodePosition = await page.locator('#auth-beta-code').boundingBox()
	expect(registrationPosition).not.toBeNull()
	expect(betaCodePosition).not.toBeNull()
	expect(betaCodePosition?.y ?? 0).toBeGreaterThan(registrationPosition?.y ?? 0)
	await expect(page.locator('#auth-turnstile-enabled')).toBeVisible()
	await expect(page.locator('#auth-turnstile-site-key')).toHaveCount(0)
	await expect(page.locator('#auth-turnstile-secret')).toHaveCount(0)
	const googleSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Google', exact: true }) })
	await googleSection.locator('#auth-google-enabled').click()
	await expect(googleSection.getByText('Callback URL', { exact: true })).toBeVisible()
	await expect(googleSection.locator('#auth-google-callback-url')).toHaveCount(0)
	await expect(googleSection.locator('#auth-google-callback-copy')).toBeVisible()
	await page.getByRole('button', { name: 'Discard', exact: true }).click()
	await goToHydrated(page, '/en/admin/configuration/ai')
	await expect(page.locator('#ai-routing-error')).toHaveCount(0)
	await page.locator('#ai-routing-custom').click()
	await expect(page.locator('#ai-routing-error')).toBeVisible()
	await expect(page.getByRole('link', { name: 'Account / Security', exact: true })).toHaveCount(0)
	const workerLogsLink = page.getByRole('link', { name: /Worker logs/ })
	if (await workerLogsLink.count() > 0) {
		const workerLogsPosition = await workerLogsLink.boundingBox()
		expect(workerLogsPosition).not.toBeNull()
		expect(workerLogsPosition?.x ?? 9999).toBeLessThan(400)
	}
}

async function verifyPaymentProductJourney(page: Page, concurrentPage: Page): Promise<void> {
	await goToHydrated(page, '/en/admin/configuration/payment')
	await page.locator('#payment-dodo-webhook-url').locator('xpath=..').getByRole('button', { name: 'Copy', exact: true }).click()
	await expect(page.getByText('Copied', { exact: true })).toBeVisible()
	const dodoSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Dodo Payments', exact: true }) })
	await dodoSection.getByRole('button', { name: 'Add value', exact: true }).first().click()
	await page.locator('#payment-dodo-api-key').fill('browser-dodo-api-key')
	await dodoSection.getByRole('button', { name: 'Add value', exact: true }).first().click()
	await page.locator('#payment-dodo-webhook-secret').fill('browser-dodo-webhook-secret')
	await page.getByRole('button', { name: 'Save', exact: true }).click()
	await expect(page.getByText('Configuration saved', { exact: true })).toBeVisible()

	await goToHydrated(concurrentPage, '/en/admin/payment-products')
	await expect(concurrentPage.getByRole('heading', { name: 'Payment products', exact: true })).toBeVisible()
	await concurrentPage.getByRole('button', { name: 'Create product', exact: true }).first().click()
	let productSheet = concurrentPage.getByRole('dialog')
	await productSheet.locator('#payment-product-id').fill('browser-credits')
	await productSheet.locator('#payment-product-credits').fill('100')
	await productSheet.locator('#provider-product-id').fill('browser-dodo-product')
	await productSheet.getByRole('button', { name: 'Save', exact: true }).click()
	const productRow = concurrentPage.getByRole('row').filter({ hasText: 'browser-credits' })
	await expect(productRow).toContainText('100')

	const stalePage: Page = await concurrentPage.context().newPage()
	await goToHydrated(stalePage, '/en/admin/payment-products')
	await productRow.scrollIntoViewIfNeeded()
	await productRow.getByRole('button', { name: 'Edit', exact: true }).click()
	await stalePage.getByRole('row').filter({ hasText: 'browser-credits' }).getByRole('button', { name: 'Edit', exact: true }).click()
	productSheet = concurrentPage.getByRole('dialog')
	const staleProductSheet = stalePage.getByRole('dialog')
	await productSheet.locator('#payment-product-credits').fill('101')
	await staleProductSheet.locator('#payment-product-credits').fill('102')
	await productSheet.getByRole('button', { name: 'Save', exact: true }).click()
	await staleProductSheet.getByRole('button', { name: 'Save', exact: true }).click()
	await expect(staleProductSheet.locator('#payment-product-credits')).toHaveValue('102')
	await expect(staleProductSheet.getByRole('button', { name: 'Refresh current data', exact: true })).toBeVisible()
	await staleProductSheet.getByRole('button', { name: 'Refresh current data', exact: true }).click()
	await expect(productRow).toContainText('101')
	await stalePage.close()

	await productRow.getByRole('button', { name: 'Delete', exact: true }).click()
	await concurrentPage.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click()
	await expect(productRow).toHaveCount(0)
}

async function verifyAIProviderJourney(page: Page, concurrentPage: Page): Promise<void> {
	await goToHydrated(page, '/en/admin/configuration/ai')
	await page.locator('#ai-routing-custom').click()
	await expect(page.locator('#ai-routing-error')).toBeVisible()
	const routingErrorInput = page.locator('#ai-routing-error')
	const routingErrorOriginal: string = await routingErrorInput.inputValue()
	const routingErrorDraft: string = routingErrorOriginal === '2' ? '3' : '2'
	await routingErrorInput.fill(routingErrorDraft)
	await goToHydrated(concurrentPage, '/en/admin/ai-providers')
	await expect(concurrentPage.getByRole('heading', { name: 'AI providers', exact: true })).toBeVisible()
	await concurrentPage.getByRole('button', { name: 'Create provider', exact: true }).first().click()
	let providerSheet = concurrentPage.getByRole('dialog')
	await providerSheet.locator('#ai-provider-id').fill('browser-gemini')
	await providerSheet.locator('#ai-provider-name').fill('Browser Gemini')
	await providerSheet.locator('#ai-provider-base-url').fill('https://example.com')
	await providerSheet.locator('#ai-provider-models').fill('browser-image-model')
	await providerSheet.locator('#ai-provider-api-key').fill('browser-provider-secret')
	await providerSheet.getByRole('button', { name: 'Save', exact: true }).click()
	const providerRow = concurrentPage.getByRole('row').filter({ hasText: 'browser-gemini' })
	await expect(providerRow).toContainText('Browser Gemini')
	await expect(providerRow).toContainText('Configured')
	await expect(concurrentPage.getByText('browser-provider-secret', { exact: true })).toHaveCount(0)
	await expect(routingErrorInput).toHaveValue(routingErrorDraft)

	const stalePage: Page = await concurrentPage.context().newPage()
	await goToHydrated(stalePage, '/en/admin/ai-providers')
	await providerRow.scrollIntoViewIfNeeded()
	await providerRow.getByRole('button', { name: 'Edit', exact: true }).click()
	await stalePage.getByRole('row').filter({ hasText: 'browser-gemini' }).getByRole('button', { name: 'Edit', exact: true }).click()
	providerSheet = concurrentPage.getByRole('dialog')
	const staleProviderSheet = stalePage.getByRole('dialog')
	await providerSheet.locator('#ai-provider-name').fill('Browser Gemini disabled')
	await providerSheet.locator('#ai-provider-enabled').click()
	await staleProviderSheet.locator('#ai-provider-name').fill('Browser Gemini stale')
	await providerSheet.getByRole('button', { name: 'Save', exact: true }).click()
	await staleProviderSheet.getByRole('button', { name: 'Save', exact: true }).click()
	await expect(staleProviderSheet.locator('#ai-provider-name')).toHaveValue('Browser Gemini stale')
	await expect(staleProviderSheet.getByRole('button', { name: 'Refresh current data', exact: true })).toBeVisible()
	await staleProviderSheet.getByRole('button', { name: 'Refresh current data', exact: true }).click()
	await expect(providerRow).toContainText('Browser Gemini disabled')
	await expect(providerRow).toContainText('Disabled')
	await stalePage.close()

	await providerRow.getByRole('button', { name: 'Delete', exact: true }).click()
	await concurrentPage.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click()
	await expect(providerRow).toHaveCount(0)
	await page.getByRole('button', { name: 'Discard', exact: true }).click()
	await expect(routingErrorInput).toHaveValue(routingErrorOriginal)
}
