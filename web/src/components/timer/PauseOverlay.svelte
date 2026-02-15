<script lang="ts">
	import type { TimerPhase } from '../../lib/stores/timer';
	import { haptic } from '../../lib/haptic';
	import { settings } from '../../lib/stores/settings';
	import { Play, Pause } from 'lucide-svelte';

	interface Props {
		paused: boolean;
		phase: TimerPhase;
		onToggle: () => void;
	}
	let { paused, phase, onToggle } = $props<Props>();

	let canPause = $derived(phase === 'resting');

	function handleClick(e: MouseEvent | TouchEvent) {
		e.stopPropagation();
		if (!canPause) return;
		if ($settings.hapticFeedback) haptic(30);
		onToggle();
	}
</script>

{#if paused}
	<!-- Paused: full overlay with play icon -->
	<button
		class="pause-overlay paused"
		onclick={handleClick}
		aria-label="Resume timer"
	>
		<span class="pause-icon play"><Play size={40} /></span>
		<span class="pause-label">Tap to resume</span>
	</button>
{:else if canPause}
	<!-- Resting: invisible tappable area, icon only on hover (desktop) -->
	<button
		class="pause-overlay resting"
		onclick={handleClick}
		aria-label="Pause timer"
	>
		<span class="pause-icon"><Pause size={28} /></span>
	</button>
{/if}

<style>
	.pause-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		background: transparent;
		-webkit-tap-highlight-color: transparent;
		z-index: 2;
		transition: background var(--transition-base);
	}

	/* --- Resting (not paused): hidden by default --- */
	.pause-overlay.resting .pause-icon {
		color: var(--text-primary);
		opacity: 0.15;
		transition: opacity var(--transition-base);
	}

	/* Desktop hover: reveal icon */
	@media (hover: hover) {
		.pause-overlay.resting:hover {
			background: var(--bg-card-hover);
		}
		.pause-overlay.resting:hover .pause-icon {
			opacity: 0.5;
		}
	}

	/* Touch active feedback */
	.pause-overlay.resting:active {
		background: var(--bg-card-hover);
	}

	/* --- Paused: full overlay --- */
	.pause-overlay.paused {
		background: var(--bg-overlay, rgba(0, 0, 0, 0.6));
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
	}

	.pause-overlay.paused .pause-icon {
		color: var(--success);
		opacity: 1;
	}

	.pause-label {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		font-weight: 500;
	}
</style>
