<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import { getSessionStats } from '../../lib/labor-logic/calculations';
	import { formatDurationShort, formatInterval } from '../../lib/labor-logic/formatters';

	let stats = $derived(getSessionStats($session.contractions, $settings.threshold, $settings.stageThresholds));
</script>

<div class="summary-grid">
	<div class="summary-card">
		<div class="card-value">{stats.totalContractions}</div>
		<div class="card-label">{$_('dashboard.summary.contractions')}</div>
	</div>
	<div class="summary-card">
		<div class="card-value">
			{stats.avgDurationSec > 0 ? formatDurationShort(stats.avgDurationSec) : '--'}
		</div>
		<div class="card-label">{$_('dashboard.summary.avgDuration')}</div>
	</div>
	<div class="summary-card">
		<div class="card-value">
			{stats.avgIntervalMin > 0 ? formatInterval(stats.avgIntervalMin) : '--'}
		</div>
		<div class="card-label">{$_('dashboard.summary.avgInterval')}</div>
	</div>
</div>

<style>
	.summary-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-2);
		margin-bottom: var(--space-4);
	}

	.summary-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: var(--space-3) var(--space-2);
		text-align: center;
	}

	.card-value {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: var(--text-xl);
		font-weight: 600;
		color: var(--text-primary);
	}

	.card-label {
		font-size: var(--text-xs);
		color: var(--text-muted);
		margin-top: var(--space-1);
	}
</style>
