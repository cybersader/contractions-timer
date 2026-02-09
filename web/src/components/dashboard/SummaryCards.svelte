<script lang="ts">
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import { getSessionStats } from '../../lib/labor-logic/calculations';
	import { formatDurationShort, formatInterval } from '../../lib/labor-logic/formatters';

	$: stats = getSessionStats($session.contractions, $settings.threshold, $settings.stageThresholds);
</script>

<div class="summary-grid">
	<div class="summary-card">
		<div class="card-value">{stats.totalContractions}</div>
		<div class="card-label">Contractions</div>
	</div>
	<div class="summary-card">
		<div class="card-value">
			{stats.avgDurationSec > 0 ? formatDurationShort(stats.avgDurationSec) : '--'}
		</div>
		<div class="card-label">Avg duration</div>
	</div>
	<div class="summary-card">
		<div class="card-value">
			{stats.avgIntervalMin > 0 ? formatInterval(stats.avgIntervalMin) : '--'}
		</div>
		<div class="card-label">Avg interval</div>
	</div>
</div>

<style>
	.summary-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		margin-bottom: 16px;
	}

	.summary-card {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 12px;
		padding: 12px 8px;
		text-align: center;
	}

	.card-value {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 1.25rem;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.9);
	}

	.card-label {
		font-size: 0.68rem;
		color: rgba(255, 255, 255, 0.4);
		margin-top: 2px;
	}
</style>
