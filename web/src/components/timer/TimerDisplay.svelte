<script lang="ts">
	import { session } from '../../lib/stores/session';
	import { tick, timerPhase } from '../../lib/stores/timer';
	import { isContractionActive, getElapsedSeconds, getRestSeconds } from '../../lib/labor-logic/calculations';
	import { formatDuration, formatRestTime } from '../../lib/labor-logic/formatters';
	import { settings } from '../../lib/stores/settings';
	import PauseOverlay from './PauseOverlay.svelte';

	interface Props {
		paused?: boolean;
		onPauseToggle?: () => void;
	}
	let { paused = false, onPauseToggle = () => {} } = $props<Props>();

	let phase = $derived($timerPhase);

	let elapsed = $derived.by(() => {
		void $tick; // force re-evaluate every 200ms
		const active = $session.contractions.find(c => isContractionActive(c));
		if (!active) return 0;
		return getElapsedSeconds(active);
	});

	let rest = $derived.by(() => {
		void $tick;
		if (paused) return getRestSeconds($session.contractions); // still compute but don't animate
		return getRestSeconds($session.contractions);
	});

	let displayTime = $derived(
		phase === 'contracting'
			? formatDuration(elapsed)
			: phase === 'resting'
				? formatRestTime(rest, $settings.showRestSeconds)
				: '0:00'
	);

	let label = $derived(
		phase === 'contracting'
			? 'Contraction'
			: phase === 'resting'
				? (paused ? 'Paused' : 'Rest')
				: 'Ready'
	);
</script>

<div class="timer-display">
	<div class="timer-label">{label}</div>
	<div class="timer-wrapper">
		<div class="timer-time" class:contracting={phase === 'contracting'} class:resting={phase === 'resting'} class:dimmed={paused}>
			{displayTime}
		</div>
	</div>
	<PauseOverlay {paused} {phase} onToggle={onPauseToggle} />
</div>

<style>
	.timer-display {
		text-align: center;
		padding: var(--space-4) 0;
		position: relative;
	}

	.timer-label {
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-muted);
		margin-bottom: var(--space-1);
	}

	.timer-wrapper {
		display: inline-block;
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius-md);
	}

	.timer-time {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: var(--text-3xl);
		font-weight: 300;
		color: var(--text-primary);
		line-height: 1;
		transition: opacity var(--transition-base);
	}

	.timer-time.contracting {
		color: var(--danger);
	}

	.timer-time.resting {
		color: var(--success);
	}

	.timer-time.dimmed {
		opacity: 0.3;
	}
</style>
