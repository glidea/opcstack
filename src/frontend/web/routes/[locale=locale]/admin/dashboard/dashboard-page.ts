import type { GetDashboardResponse } from '$apiContract/dashboard'

export type DashboardState =
	| { status: 'loading' }
	| { status: 'loaded'; data: GetDashboardResponse }
	| { status: 'error' }

export type AttentionItemId = 'failedTasks' | 'claimedCodes' | 'disputedPayments'

export type AttentionItem = {
	id: AttentionItemId
	count: number
	href: string
}

export type TaskDistributionItem = {
	type: 'image' | 'tts' | 'video'
	count: number
	percentage: number
}

export function createDashboardInitialState(): DashboardState {
	return { status: 'loading' }
}

export async function loadDashboard(
	request: () => Promise<GetDashboardResponse>
): Promise<DashboardState> {
	try {
		return { status: 'loaded', data: await request() }
	} catch {
		return { status: 'error' }
	}
}

export function createAttentionItems(
	locale: string,
	dashboard: GetDashboardResponse
): AttentionItem[] {
	const window = dashboard.windows.last_24_hours
	const failedTaskParams: URLSearchParams = new URLSearchParams({
		status: 'failed',
		created_at_start: String(window.start_at),
		created_at_end: String(window.end_at)
	})
	const items: AttentionItem[] = [
		{
			id: 'failedTasks',
			count: dashboard.ai_tasks.failed_count_24h,
			href: `/${locale}/admin/ai-tasks?${failedTaskParams.toString()}`
		},
		{
			id: 'claimedCodes',
			count: dashboard.redemption_codes.claimed_count,
			href: `/${locale}/admin/credit-codes?status=claimed`
		},
		{
			id: 'disputedPayments',
			count: dashboard.payments.disputed_count,
			href: `/${locale}/admin/payments?status=disputed`
		}
	]
	return items.filter((item: AttentionItem): boolean => item.count > 0)
}

export function getProcessingTaskCount(dashboard: GetDashboardResponse): number {
	return dashboard.ai_tasks.total_24h - dashboard.ai_tasks.terminal_count_24h
}

export function createTaskDistribution(
	dashboard: GetDashboardResponse
): TaskDistributionItem[] {
	const total: number = dashboard.ai_tasks.total_24h
	return (
		[
			['image', dashboard.ai_tasks.by_type_24h.image],
			['tts', dashboard.ai_tasks.by_type_24h.tts],
			['video', dashboard.ai_tasks.by_type_24h.video]
		] as const
	).map(([type, count]): TaskDistributionItem => {
		return {
			type,
			count,
			percentage: total === 0 ? 0 : (count / total) * 100
		}
	})
}

export function formatPaidAmount(amount: number, currency: string, locale: string): string {
	const formatter: Intl.NumberFormat = new Intl.NumberFormat(locale, {
		style: 'currency',
		currency
	})
	const fractionDigits: number = formatter.resolvedOptions().maximumFractionDigits!
	return formatter.format(amount / 10 ** fractionDigits)
}
