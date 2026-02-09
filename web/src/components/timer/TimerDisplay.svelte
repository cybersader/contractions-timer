<script lang="ts">
	import { session } from '../../lib/stores/session';
	import { tick, timerPhase } from '../../lib/stores/timer';
	import { isContractionActive, getElapsedSeconds, getRestSeconds } from '../../lib/labor-logic/calculations';
	import { formatDuration, formatRestTime } from '../../lib/labor-logic/formatters';
	import { settings } from '../../lib/stores/settings';

	$: phase = $timerPhase;
	$: void $tick; // reactive dependency on tick

	$: activeContraction = $session.contractions.find(c => isContractionActive(c));
	$: elapsed = activeContraction ? getElapsedSeconds(activeContraction) : 0;
	$: rest = getRestSeconds($session.contractions);

	$: displayTime = phase === 'contracting'
		? formatDuration(elapsed)
		: phase === 'resting'
			? formatRestTime(rest, $settings.showRestSeconds)
			: '0:00';

	$: label = phase === 'contracting'
		? 'Contraction'
		: phase === 'resting'
			? 'Rest'
			: 'Ready';
</script>

<div class="timer-display">
	<div class="timer-label">{label}</div>
	<div class="timer-time" class:contracting={phase === 'contracting'} class:resting={phase === 'resting'}>
		{displayTime}
	</div>
</div>

<style>
	.timer-display {
		text-align: center;
		padding: 16px 0;
	}

	.timer-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: rgba(255, 255, 255, 0.5);
		margin-bottom: 4px;
	}

	.timer-time {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 3rem;
		font-weight: 300;
		color: rgba(255, 255, 255, 0.9);
		line-height: 1;
	}

	.timer-time.contracting {
		color: #f87171;
	}

	.timer-time.resting {
		color: #4ade80;
	}
</style>
