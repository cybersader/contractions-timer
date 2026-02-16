<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import { getSessionStats } from '../../lib/labor-logic/calculations';

	let stats = $derived(getSessionStats($session.contractions, $settings.threshold, $settings.stageThresholds));
</script>

<div class="quick-stats">
	<div class="stat-card">
		<div class="stat-value">{stats.avgDurationSec > 0 ? `${Math.round(stats.avgDurationSec)}s` : $_('timer.quickStats.noDataPlaceholder')}</div>
		<div class="stat-label">{$_('timer.quickStats.avgDuration')}</div>
	</div>
	<div class="stat-card">
		<div class="stat-value">{stats.avgIntervalMin > 0 ? `${stats.avgIntervalMin.toFixed(1)}m` : $_('timer.quickStats.noDataPlaceholder')}</div>
		<div class="stat-label">{$_('timer.quickStats.avgInterval')}</div>
	</div>
	<div class="stat-card">
		<div class="stat-value">{stats.totalContractions}</div>
		<div class="stat-label">{$_('timer.quickStats.total')}</div>
	</div>
</div>

<style>
	.quick-stats {
		display: flex;
		gap: var(--space-2);
	}

	.stat-card {
		flex: 1;
		text-align: center;
		padding: var(--space-2) var(--space-1);
		background: var(--bg-card-hover);
		border-radius: var(--radius-sm);
	}

	.stat-value {
		font-size: var(--text-lg);
		font-weight: 700;
		color: var(--text-primary);
		font-family: 'JetBrains Mono', monospace;
	}

	.stat-label {
		font-size: var(--text-xs);
		color: var(--text-muted);
		margin-top: var(--space-1);
	}
</style>
