<script lang="ts">
	import { _ } from 'svelte-i18n';
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
		aria-label={$_('timer.pauseOverlay.resumeTimerAriaLabel')}
	>
		<span class="pause-icon play"><Play size={28} /></span>
		<span class="pause-label">{$_('timer.pauseOverlay.tapToResume')}</span>
	</button>
{:else if canPause}
	<!-- Resting: invisible tappable area, subtle periodic hint -->
	<button
		class="pause-overlay resting"
		onclick={handleClick}
		aria-label={$_('timer.pauseOverlay.pauseTimerAriaLabel')}
	>
		<span class="pause-icon"><Pause size={28} /></span>
		<span class="pause-hint">{$_('timer.pauseOverlay.tapToPause')}</span>
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
		opacity: 0;
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
		.pause-overlay.resting:hover .pause-hint {
			opacity: 0 !important;
			animation: none;
		}
	}

	/* Touch active feedback */
	.pause-overlay.resting:active {
		background: var(--bg-card-hover);
	}

	/* --- Periodic hint --- */
	.pause-hint {
		position: absolute;
		bottom: var(--space-1);
		font-size: 10px;
		color: var(--text-faint);
		font-weight: 500;
		letter-spacing: 0.03em;
		opacity: 0;
		animation: pause-hint-pulse 30s ease-in-out infinite;
		animation-delay: 12s;
		pointer-events: none;
	}

	@keyframes pause-hint-pulse {
		0%, 90% { opacity: 0; }
		94% { opacity: 0.45; }
		97% { opacity: 0.45; }
		100% { opacity: 0; }
	}

	@media (prefers-reduced-motion: reduce) {
		.pause-hint {
			animation: none;
			opacity: 0;
		}
	}

	/* --- Paused: semi-transparent overlay (frozen time visible) --- */
	.pause-overlay.paused {
		background: var(--bg-overlay, rgba(0, 0, 0, 0.35));
	}

	.pause-overlay.paused .pause-icon {
		color: #4ade80;
		opacity: 0.9;
	}

	.pause-label {
		font-size: var(--text-xs);
		color: rgba(255, 255, 255, 0.7);
		font-weight: 500;
	}
</style>
