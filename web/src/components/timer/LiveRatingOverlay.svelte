<script lang="ts">
	import { _ } from '../../lib/i18n/index';
	import type { TimerPhase } from '../../lib/stores/timer';
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import { haptic } from '../../lib/haptic';

	interface Props {
		phase: TimerPhase;
		elapsed: number;
	}
	let { phase, elapsed } = $props<Props>();

	let peakMarked = $state(false);
	let showConfirmation = $state(false);

	// Reset when a new contraction starts
	let prevPhase = $state<TimerPhase>('idle');
	$effect(() => {
		if (phase === 'contracting' && prevPhase !== 'contracting') {
			peakMarked = false;
			showConfirmation = false;
		}
		prevPhase = phase;
	});

	let visible = $derived(
		$settings.showLiveRating &&
		phase === 'contracting' &&
		elapsed >= 5 &&
		!peakMarked
	);

	function markPeak() {
		const peakOffsetSec = Math.round(elapsed);
		session.update(s => ({
			...s,
			contractions: s.contractions.map(c =>
				c.end === null
					? { ...c, phases: { building: null, peak: null, easing: null, peakOffsetSec } }
					: c
			),
		}));
		peakMarked = true;
		showConfirmation = true;
		if ($settings.hapticFeedback) haptic(10);
		setTimeout(() => { showConfirmation = false; }, 800);
	}
</script>

{#if visible}
	<button class="peak-btn" onclick={markPeak}>{$_('timer.liveRating.pastThePeak')}</button>
{:else if showConfirmation}
	<div class="peak-confirmed">{$_('timer.liveRating.peakMarked')}</div>
{/if}

<style>
	.peak-btn {
		display: block;
		margin: var(--space-2) auto 0;
		padding: var(--space-2) var(--space-5);
		min-height: var(--btn-height-sm);
		border-radius: var(--radius-xl);
		border: 1px solid var(--accent-muted);
		background: var(--accent-muted);
		color: var(--accent);
		font-size: var(--text-sm);
		font-weight: 500;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		animation: fadeIn var(--transition-slow);
	}

	.peak-btn:active {
		transform: scale(0.95);
	}

	.peak-confirmed {
		text-align: center;
		margin: var(--space-2) auto 0;
		padding: var(--space-2) var(--space-4);
		font-size: var(--text-sm);
		color: var(--success);
		font-weight: 500;
		animation: fadeIn var(--transition-base);
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(var(--space-1)); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
