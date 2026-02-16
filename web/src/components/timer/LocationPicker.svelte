<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { ContractionLocation } from '../../lib/labor-logic/types';

	const LOCATION_KEYS: Record<string, string> = {
		front: 'timer.locationPicker.lowerBelly',
		back: 'timer.locationPicker.lowerBack',
		wrapping: 'timer.locationPicker.allAround',
	};
	import { haptic } from '../../lib/haptic';
	import { ChevronLeft } from 'lucide-svelte';

	interface Props {
		value: ContractionLocation | null;
		onSelect?: (loc: ContractionLocation) => void;
		onSkip?: () => void;
		onBack?: () => void;
	}
	let { value, onSelect = () => {}, onSkip = () => {}, onBack } = $props<Props>();

	const locations: ContractionLocation[] = ['front', 'back', 'wrapping'];

	function select(loc: ContractionLocation) {
		haptic(30);
		onSelect(loc);
	}
</script>

<div class="picker-card">
	<div class="picker-top">
		{#if onBack}
			<button class="back-btn" onclick={onBack} aria-label={$_('timer.locationPicker.backToIntensityAriaLabel')}>
				<ChevronLeft size={16} />
			</button>
		{/if}
		<div class="picker-label">{$_('timer.locationPicker.prompt')}</div>
	</div>
	<div class="location-buttons">
		{#each locations as loc}
			<button
				class="location-btn"
				class:selected={value === loc}
				onclick={() => select(loc)}
			>
				{$_(LOCATION_KEYS[loc] || loc)}
			</button>
		{/each}
	</div>
	<button class="skip-btn" onclick={onSkip}>{$_('common.skip')}</button>
</div>

<style>
	.picker-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: var(--space-3);
		margin: var(--space-2) 0;
	}

	.picker-top {
		display: flex;
		align-items: center;
		margin-bottom: var(--space-2);
	}

	.back-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--btn-height-sm);
		height: var(--btn-height-sm);
		border: none;
		background: none;
		color: var(--text-muted);
		cursor: pointer;
		border-radius: var(--radius-sm);
		-webkit-tap-highlight-color: transparent;
		flex-shrink: 0;
	}

	.back-btn:active {
		background: var(--bg-card-hover);
	}

	.picker-label {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		text-align: center;
		flex: 1;
	}

	.location-buttons {
		display: flex;
		gap: var(--space-2);
		justify-content: center;
	}

	.location-btn {
		padding: var(--space-3) var(--space-4);
		min-height: var(--btn-height-md);
		border-radius: var(--radius-sm);
		border: 1px solid var(--input-border);
		background: transparent;
		color: var(--text-secondary);
		font-size: var(--text-sm);
		cursor: pointer;
		transition: all var(--transition-fast);
		-webkit-tap-highlight-color: transparent;
	}

	.location-btn:active {
		transform: scale(0.95);
	}

	.location-btn.selected {
		border-color: var(--accent);
		background: var(--accent-muted);
		color: var(--accent);
	}

	.skip-btn {
		display: block;
		margin: var(--space-2) auto 0;
		padding: var(--space-2) var(--space-4);
		min-height: var(--btn-height-sm);
		border: none;
		background: transparent;
		color: var(--text-muted);
		font-size: var(--text-sm);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
</style>
