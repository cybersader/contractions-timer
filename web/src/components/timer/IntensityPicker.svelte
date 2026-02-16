<script lang="ts">
	import { _ } from '../../lib/i18n/index';

	const INTENSITY_KEYS: Record<number, string> = {
		1: 'timer.intensityPicker.mild',
		2: 'timer.intensityPicker.moderate',
		3: 'timer.intensityPicker.strong',
		4: 'timer.intensityPicker.veryStrong',
		5: 'timer.intensityPicker.intense',
	};
	import { haptic } from '../../lib/haptic';

	interface Props {
		value: number | null;
		onSelect?: (level: number) => void;
		onSkip?: () => void;
	}
	let { value, onSelect = () => {}, onSkip = () => {} } = $props<Props>();

	const levels = [1, 2, 3, 4, 5];

	function select(level: number) {
		haptic(30);
		onSelect(level);
	}
</script>

<div class="picker-card">
	<div class="picker-label">{$_('timer.intensityPicker.prompt')}</div>
	<div class="intensity-buttons">
		{#each levels as level}
			<button
				class="intensity-btn"
				class:selected={value === level}
				style="--dot-color: var(--color-intensity-{level})"
				onclick={() => select(level)}
			>
				<span class="intensity-dot" style="background: var(--color-intensity-{level})"></span>
				<span class="intensity-text">{$_(INTENSITY_KEYS[level] || 'timer.intensityPicker.levelFallback', { values: { level } })}</span>
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

	.picker-label {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		margin-bottom: var(--space-2);
		text-align: center;
	}

	.intensity-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		justify-content: center;
	}

	.intensity-btn {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-3) var(--space-3);
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

	.intensity-btn:active {
		transform: scale(0.95);
	}

	.intensity-btn.selected {
		border-color: var(--dot-color);
		background: var(--bg-card-hover);
		color: var(--text-primary);
	}

	.intensity-dot {
		width: var(--space-2);
		height: var(--space-2);
		border-radius: var(--radius-full);
		flex-shrink: 0;
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

	.skip-btn:hover {
		color: var(--text-secondary);
	}
</style>
