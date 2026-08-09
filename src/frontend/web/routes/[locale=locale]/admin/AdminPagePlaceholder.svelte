<script lang="ts">
	import { _ } from '$frontend/i18n'
	import { Skeleton } from '$frontend/ui/skeleton'
</script>

<section class="flex-1 px-4 py-5 md:px-6 md:py-6" aria-busy="true">
	<span class="sr-only">{$_('admin.loading')}</span>
	<div class="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
		<div class="flex items-center justify-between gap-4">
			<div class="space-y-2">
				<Skeleton class="h-7 w-40" />
				<Skeleton class="h-4 w-64 max-w-[70vw]" />
			</div>
			<Skeleton class="h-9 w-28" />
		</div>
		<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
			{#each Array(4) as _item}
				<div class="space-y-3 border-b border-border p-4">
					<Skeleton class="h-3 w-20" />
					<Skeleton class="h-7 w-24" />
				</div>
			{/each}
		</div>
		<div class="overflow-hidden border-y border-border">
			{#each Array(7) as _item}
				<div class="grid h-12 grid-cols-[minmax(8rem,1.5fr)_minmax(6rem,1fr)_7rem] items-center gap-4 border-b border-border px-3 last:border-b-0">
					<Skeleton class="h-4 w-full max-w-48" />
					<Skeleton class="h-4 w-full max-w-32" />
					<Skeleton class="h-4 w-20" />
				</div>
			{/each}
		</div>
	</div>
</section>
