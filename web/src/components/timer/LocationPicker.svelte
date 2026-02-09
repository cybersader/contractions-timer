<script lang="ts">
	import type { ContractionLocation } from '../../lib/labor-logic/types';
	import { getLocationLabel } from '../../lib/labor-logic/formatters';
	import { haptic } from '../../lib/haptic';

	export let value: ContractionLocation | null = null;
	export let onSelect: (loc: ContractionLocation) => void = () => {};
	export let onSkip: () => void = () => {};

	const locations: ContractionLocation[] = ['front', 'back', 'wrapping'];

	function select(loc: ContractionLocation) {
		haptic(30);
		value = loc;
		onSelect(loc);
	}
</script>

<div class="picker-card">
	<div class="picker-label">Where did you feel it?</div>
	<div class="location-buttons">
		{#each locations as loc}
			<button
				class="location-btn"
				class:selected={value === loc}
				on:click={() => select(loc)}
			>
				{getLocationLabel(loc)}
			</button>
		{/each}
	</div>
	<button class="skip-btn" on:click={onSkip}>Skip</button>
</div>

<style>
	.picker-card {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		padding: 12px;
		margin: 8px 0;
	}

	.picker-label {
		font-size: 0.78rem;
		color: rgba(255, 255, 255, 0.6);
		margin-bottom: 8px;
		text-align: center;
	}

	.location-buttons {
		display: flex;
		gap: 6px;
		justify-content: center;
	}

	.location-btn {
		padding: 8px 14px;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: transparent;
		color: rgba(255, 255, 255, 0.7);
		font-size: 0.78rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.location-btn:active {
		transform: scale(0.95);
	}

	.location-btn.selected {
		border-color: #818cf8;
		background: rgba(129, 140, 248, 0.1);
		color: #818cf8;
	}

	.skip-btn {
		display: block;
		margin: 8px auto 0;
		padding: 4px 16px;
		border: none;
		background: transparent;
		color: rgba(255, 255, 255, 0.4);
		font-size: 0.72rem;
		cursor: pointer;
	}
</style>
