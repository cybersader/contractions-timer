<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import { getSessionStats, getTimeInCurrentStage } from '../../lib/labor-logic/calculations';
	import { formatElapsedApprox, formatDurationRange } from '../../lib/labor-logic/formatters';

	let stats = $derived(getSessionStats($session.contractions, $settings.threshold, $settings.stageThresholds));
	let stage = $derived(stats.laborStage);
	let stageTime = $derived(stage ? getTimeInCurrentStage($session.contractions, $settings.stageThresholds) : null);
	let minutesInStage = $derived(stageTime?.minutesInStage ?? 0);

	let config = $derived(stage ? $settings.stageThresholds[stage] : null);
	let range = $derived.by((): [number, number] => {
		if (!config) return [0, 0];
		return $settings.parity === 'first-baby' ? config.typicalDurationFirstMin : config.typicalDurationSubsequentMin;
	});
	let show = $derived(stage && !(range[0] === 0 && range[1] === 0));
	let progress = $derived(range[1] > 0 ? Math.min(1, minutesInStage / range[1]) : 0);

	const stageLabelKeys: Record<string, string> = {
		'pre-labor': 'timer.laborStages.preLabor',
		'early': 'timer.laborStages.early',
		'active': 'timer.laborStages.active',
		'transition': 'timer.laborStages.transition',
	};
	let stageLabel = $derived(stage ? $_(stageLabelKeys[stage] ?? stage) : '');
</script>

{#if show && stage}
	<div class="stage-bar">
		<div class="stage-header">
			<span class="stage-label stage--{stage}">{stageLabel}</span>
			<span class="stage-time">{$_('dashboard.stageBar.beenHere', { values: { elapsed: formatElapsedApprox(minutesInStage) } })}</span>
		</div>
		<div class="bar-track">
			<div class="bar-fill bar-fill--{stage}" style="width: {Math.round(progress * 100)}%"></div>
		</div>
		<div class="stage-tip">
			{#if formatDurationRange(range)}{$_('dashboard.stageBar.typical', { values: { range: formatDurationRange(range) } })}{/if}
			{#if config?.location} · {$_('dashboard.stageBar.location', { values: { location: config.location } })}{/if}
		</div>
	</div>
{/if}

<style>
	.stage-bar {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: var(--space-3);
		margin-bottom: var(--space-3);
	}

	.stage-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-2);
	}

	.stage-label {
		font-size: var(--text-base);
		font-weight: 600;
	}

	.stage--early { color: var(--success); }
	.stage--active { color: var(--warning); }
	.stage--transition { color: var(--danger); }
	.stage--pre-labor { color: var(--text-muted); }

	.stage-time {
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.bar-track {
		height: 6px;
		background: var(--border);
		border-radius: 3px;
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		border-radius: 3px;
		transition: width 0.5s ease;
	}

	.bar-fill--early { background: var(--success); }
	.bar-fill--active { background: var(--warning); }
	.bar-fill--transition { background: var(--danger); }

	.stage-tip {
		font-size: var(--text-xs);
		color: var(--text-faint);
		margin-top: var(--space-2);
	}
</style>
