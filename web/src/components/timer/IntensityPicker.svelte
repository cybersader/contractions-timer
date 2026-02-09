<script lang="ts">
	import { getIntensityLabel } from '../../lib/labor-logic/formatters';
	import { haptic } from '../../lib/haptic';

	export let value: number | null = null;
	export let onSelect: (level: number) => void = () => {};
	export let onSkip: () => void = () => {};

	const levels = [1, 2, 3, 4, 5];

	function select(level: number) {
		haptic(30);
		value = level;
		onSelect(level);
	}
</script>

<div class="picker-card">
	<div class="picker-label">How strong was that?</div>
	<div class="intensity-buttons">
		{#each levels as level}
			<button
				class="intensity-btn"
				class:selected={value === level}
				style="--dot-color: var(--color-intensity-{level})"
				on:click={() => select(level)}
			>
				<span class="intensity-dot" style="background: var(--color-intensity-{level})"></span>
				<span class="intensity-text">{getIntensityLabel(level)}</span>
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

	.intensity-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		justify-content: center;
	}

	.intensity-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 10px;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: transparent;
		color: rgba(255, 255, 255, 0.7);
		font-size: 0.72rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.intensity-btn:active {
		transform: scale(0.95);
	}

	.intensity-btn.selected {
		border-color: var(--dot-color);
		background: rgba(255, 255, 255, 0.05);
		color: white;
	}

	.intensity-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
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

	.skip-btn:hover {
		color: rgba(255, 255, 255, 0.6);
	}
</style>
