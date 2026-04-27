<script lang="ts">
	import * as Sidebar from '$web/ui/sidebar'
	import AppHeader from '$web/components/AppHeader.svelte'

	let {
		data,
		children
	}: {
		data: {
			locale: string
			groups: Array<{ id: string; title: string; docs: Array<{ slug: string; title: string }> }>
		}
		children: import('svelte').Snippet
	} = $props()
</script>

<div class="docs-shell">
	<Sidebar.Provider class="flex min-h-svh flex-col">
		<AppHeader logoHref={`/${data.locale}/docs`} showSidebarTrigger />
		<div class="flex min-h-0 flex-1">
			<Sidebar.Root class="md:top-12 md:h-[calc(100svh-3rem)]">
				<Sidebar.Content class="pt-2">
					{#each data.groups as group}
						<Sidebar.Group class="px-3 py-2">
							<Sidebar.GroupLabel
								class="px-2 text-[11px] uppercase tracking-wider text-muted-foreground"
								>{group.title}</Sidebar.GroupLabel
							>
							<Sidebar.GroupContent>
								<Sidebar.Menu class="gap-0.5">
									{#each group.docs as doc}
										<Sidebar.MenuItem>
											<Sidebar.MenuButton
												class="h-9 px-2.5"
											>
												{#snippet child({ props })}
													<a
														href={`/${data.locale}/docs/${doc.slug}`}
														{...props}
													>
														{doc.title}
													</a>
												{/snippet}
											</Sidebar.MenuButton>
										</Sidebar.MenuItem>
									{/each}
								</Sidebar.Menu>
							</Sidebar.GroupContent>
						</Sidebar.Group>
					{/each}
				</Sidebar.Content>
			</Sidebar.Root>
			<Sidebar.Inset>
				{@render children()}
			</Sidebar.Inset>
		</div>
	</Sidebar.Provider>
</div>
