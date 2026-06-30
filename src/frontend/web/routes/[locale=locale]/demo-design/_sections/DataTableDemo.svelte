<script lang="ts">
	import { createSvelteTable, FlexRender } from "$frontend/ui/data-table";
	import { getCoreRowModel, type ColumnDef } from "@tanstack/table-core";
	import * as Table from "$frontend/ui/table";
	import { Badge } from "$frontend/ui/badge";

	type Order = { id: string; customer: string; total: string; status: "paid" | "refunded" | "pending" };

	const data: Order[] = [
		{ id: "ORD-9012", customer: "Lina Chen", total: "$129.00", status: "paid" },
		{ id: "ORD-9011", customer: "Marcus Lee", total: "$58.00", status: "pending" },
		{ id: "ORD-9010", customer: "Sara Park", total: "$219.00", status: "paid" },
		{ id: "ORD-9009", customer: "Omar Nasser", total: "$48.00", status: "refunded" },
	];

	const columns: ColumnDef<Order>[] = [
		{ accessorKey: "id", header: () => "Order" },
		{ accessorKey: "customer", header: () => "Customer" },
		{ accessorKey: "total", header: () => "Total" },
		{ accessorKey: "status", header: () => "Status" },
	];

	const table = createSvelteTable({
		get data() { return data; },
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	const statusVariant = (s: Order["status"]) =>
		s === "paid" ? "default" : s === "refunded" ? "destructive" : "secondary";
</script>

<Table.Root>
	<Table.Header>
		{#each table.getHeaderGroups() as hg (hg.id)}
			<Table.Row>
				{#each hg.headers as h (h.id)}
					<Table.Head><FlexRender content={h.column.columnDef.header} context={h.getContext()} /></Table.Head>
				{/each}
			</Table.Row>
		{/each}
	</Table.Header>
	<Table.Body>
		{#each table.getRowModel().rows as row (row.id)}
			<Table.Row>
				{#each row.getVisibleCells() as cell (cell.id)}
					<Table.Cell>
						{#if cell.column.id === "status"}
							{@const s = cell.getValue() as Order["status"]}
							<Badge variant={statusVariant(s)}>{s}</Badge>
						{:else}
							{cell.getValue()}
						{/if}
					</Table.Cell>
				{/each}
			</Table.Row>
		{/each}
	</Table.Body>
</Table.Root>
