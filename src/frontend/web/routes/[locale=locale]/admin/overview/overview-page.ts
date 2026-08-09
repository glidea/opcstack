import type { GetAdminOverviewResponse } from '$apiContract/admin-overview'

export type AdminOverviewState =
	| { status: 'loading' }
	| { status: 'loaded'; data: GetAdminOverviewResponse }
	| { status: 'error' }

export type OverviewDrilldowns = {
	failedTasks: string
	claimedCodes: string
	disputedPayments: string
}

export type TaskDistributionItem = {
	type: 'image' | 'tts' | 'video'
	count: number
	percentage: number
}

export function createOverviewInitialState(): AdminOverviewState {
	return { status: 'loading' }
}

export async function loadAdminOverview(
	request: () => Promise<GetAdminOverviewResponse>
): Promise<AdminOverviewState> {
	try {
		return { status: 'loaded', data: await request() }
	} catch {
		return { status: 'error' }
	}
}

export function createOverviewDrilldowns(
	locale: string,
	overview: GetAdminOverviewResponse
): OverviewDrilldowns {
	const window = overview.windows.last_24_hours
	const failedTaskParams: URLSearchParams = new URLSearchParams({
		status: 'failed',
		created_at_start: String(window.start_at),
		created_at_end: String(window.end_at)
	})
	return {
		failedTasks: `/${locale}/admin/ai-tasks?${failedTaskParams.toString()}`,
		claimedCodes: `/${locale}/admin/credit-codes?status=claimed`,
		disputedPayments: `/${locale}/admin/payments?status=disputed`
	}
}

export function getProcessingTaskCount(overview: GetAdminOverviewResponse): number {
	return overview.ai_tasks.total_24h - overview.ai_tasks.terminal_count_24h
}

export function createTaskDistribution(
	overview: GetAdminOverviewResponse
): TaskDistributionItem[] {
	const total: number = overview.ai_tasks.total_24h
	return (
		[
			['image', overview.ai_tasks.by_type_24h.image],
			['tts', overview.ai_tasks.by_type_24h.tts],
			['video', overview.ai_tasks.by_type_24h.video]
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
