<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { TimerPhase } from '../../lib/stores/timer';
	import { formatDuration, formatRestTime } from '../../lib/labor-logic/formatters';
	import { settings } from '../../lib/stores/settings';

	interface Props {
		phase: TimerPhase;
		elapsed: number;
		rest: number;
		lastDurationSec: number;
		paused: boolean;
	}
	let { phase, elapsed, rest, lastDurationSec, paused } = $props<Props>();

	let text = $derived.by(() => {
		if (paused) return $_('timer.heroCompactTimer.paused');
		if (phase === 'idle') return $_('timer.heroCompactTimer.readyToStart');
		if (phase === 'contracting') return $_('timer.heroCompactTimer.contractingPrefix', { values: { time: formatDuration(elapsed) } });
		// resting
		const restStr = formatRestTime(rest, $settings.showRestSeconds);
		const lastStr = lastDurationSec > 0 ? formatDuration(lastDurationSec) : '';
		return lastStr
			? $_('timer.heroCompactTimer.restAndLast', { values: { restTime: restStr, lastTime: lastStr } })
			: $_('timer.heroCompactTimer.restPrefix', { values: { restTime: restStr } });
	});
</script>

<div class="hero-compact" class:contracting={phase === 'contracting'} class:resting={phase === 'resting'} class:paused>
	{text}
</div>

<style>
	.hero-compact {
		text-align: center;
		padding: var(--space-2) var(--space-3);
		margin-bottom: var(--space-2);
		border-radius: var(--radius-sm);
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--text-muted);
		background: var(--bg-card);
		border: 1px solid var(--border);
	}

	.hero-compact.contracting {
		color: var(--danger);
		border-color: var(--danger-muted);
		background: var(--danger-muted);
	}

	.hero-compact.resting {
		color: var(--success);
	}

	.hero-compact.paused {
		opacity: 0.6;
	}
</style>
