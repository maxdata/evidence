<script context="module">
	/** @type {import('@storybook/addon-svelte-csf').MetaProps}*/
	export const meta = {
		title: 'Viz/BigValue',
		component: BigValue,
		argTypes: {
			title: {
				control: 'text'
			},
			minWidth: {
				control: 'number'
			},
			maxWidth: {
				control: 'number'
			},
			fmt: {
				control: 'text'
			},
			emptySet: {
				control: 'select',
				options: ['pass', 'warn', 'error']
			},
			emptyMessage: {
				control: 'text'
			}
		}
	};
</script>

<script>
	import { Story } from '@storybook/addon-svelte-csf';
	import { Query } from '@evidence-dev/sdk/usql';
	import { query } from '@evidence-dev/universal-sql/client-duckdb';

	import BigValue from './BigValue.svelte';

	const data = Query.create(`select sum(fare) as total FROM  flights`, query);

	const data2 = Query.create(
		`SELECT sum(x) as total_x,sum(y) as total_y, series from numeric_series group by series`,
		query
	);
</script>

<Story name="Basic" args={{ title: 'Basic Big Value', fmt: 'usd0', emptySet: 'pass' }} let:args>
	<BigValue {...args} {data} value="total" />
</Story>

<Story name="Data as Array" let:args>
	{#each $data2 as my_row}
		<BigValue {...args} data={my_row} value="total_y" />
	{/each}
</Story>
