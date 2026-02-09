<script lang="ts">
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import { getSessionStats, getTimeInCurrentStage } from '../../lib/labor-logic/calculations';
	import { getLaborStageLabel, formatElapsedApprox, formatDurationRange } from '../../lib/labor-logic/formatters';

	$: stats = getSessionStats($session.contractions, $settings.threshold, $settings.stageThresholds);
	$: stage = stats.laborStage;
	$: minutesInStage = stage ? getTimeInCurrentStage($session.contractions, $settings.stageThresholds) : 0;

	$: config = stage ? $settings.stageThresholds[stage] : null;
	$: range = config
		? ($settings.parity === 'first-baby' ? config.typicalDurationFirstMin : config.typicalDurationSubsequentMin)
		: [0, 0] as [number, number];
	$: show = stage && !(range[0] === 0 && range[1] === 0);
	$: progress = range[1] > 0 ? Math.min(1, minutesInStage / range[1]) : 0;
</script>

{#if show && stage}
	<div class="stage-bar">
		<div class="stage-header">
			<span class="stage-label stage--{stage}">{getLaborStageLabel(stage)}</span>
			<span class="stage-time">You've been here {formatElapsedApprox(minutesInStage)}</span>
		</div>
		<div class="bar-track">
			<div class="bar-fill bar-fill--{stage}" style="width: {Math.round(progress * 100)}%"></div>
		</div>
		<div class="stage-tip">
			{#if formatDurationRange(range)}Typical: {formatDurationRange(range)}{/if}
			{#if config?.location} · Location: {config.location}{/if}
		</div>
	</div>
{/if}

<style>
	.stage-bar {
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 12px;
		padding: 12px;
		margin-bottom: 12px;
	}

	.stage-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}

	.stage-label {
		font-size: 0.82rem;
		font-weight: 600;
	}

	.stage--early { color: #4ade80; }
	.stage--active { color: #fbbf24; }
	.stage--transition { color: #f87171; }
	.stage--pre-labor { color: rgba(255, 255, 255, 0.5); }

	.stage-time {
		font-size: 0.72rem;
		color: rgba(255, 255, 255, 0.4);
	}

	.bar-track {
		height: 6px;
		background: rgba(255, 255, 255, 0.06);
		border-radius: 3px;
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		border-radius: 3px;
		transition: width 0.5s ease;
	}

	.bar-fill--early { background: #4ade80; }
	.bar-fill--active { background: #fbbf24; }
	.bar-fill--transition { background: #f87171; }

	.stage-tip {
		font-size: 0.68rem;
		color: rgba(255, 255, 255, 0.3);
		margin-top: 6px;
	}
</style>
