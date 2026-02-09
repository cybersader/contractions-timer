<script lang="ts">
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import { assessBraxtonHicks } from '../../lib/labor-logic/braxtonHicksAssessment';

	$: assessment = $session.contractions.filter(c => c.end !== null).length >= 4
		? assessBraxtonHicks($session.contractions, $session.events, $settings.bhThresholds, $settings.chartGapThresholdMin)
		: null;

	$: verdictColor = assessment?.verdict === 'likely-real-labor' ? 'verdict--real'
		: assessment?.verdict === 'likely-braxton-hicks' ? 'verdict--bh'
		: 'verdict--uncertain';

	$: verdictLabel = assessment?.verdict === 'likely-real-labor' ? 'Likely real labor'
		: assessment?.verdict === 'likely-braxton-hicks' ? 'Likely practice contractions'
		: 'Mixed signals';
</script>

{#if assessment && !assessment.requiresMore}
	<div class="bh-panel">
		<div class="panel-header">
			<span class="panel-title">Pattern assessment</span>
			<span class="verdict-badge {verdictColor}">{verdictLabel}</span>
		</div>

		<div class="criteria-list">
			{#each assessment.criteria as criterion}
				<div class="criterion" class:met={criterion.result === 'real-labor'} class:bh={criterion.result === 'braxton-hicks'}>
					<span class="criterion-check">{criterion.result === 'real-labor' ? '●' : criterion.result === 'braxton-hicks' ? '○' : '◐'}</span>
					<span class="criterion-name">{criterion.name}</span>
					{#if criterion.detail}
						<span class="criterion-detail">— {criterion.detail}</span>
					{/if}
				</div>
			{/each}
		</div>

		<div class="disclaimer">This is a pattern estimate, not a diagnosis.</div>
	</div>
{/if}

<style>
	.bh-panel {
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 12px;
		padding: 14px;
		margin-bottom: 12px;
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10px;
	}

	.panel-title {
		font-size: 0.82rem;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.7);
	}

	.verdict-badge {
		font-size: 0.68rem;
		padding: 2px 8px;
		border-radius: 6px;
		font-weight: 600;
	}

	.verdict--real {
		background: rgba(248, 113, 113, 0.12);
		color: #f87171;
	}

	.verdict--bh {
		background: rgba(255, 255, 255, 0.06);
		color: rgba(255, 255, 255, 0.5);
	}

	.verdict--uncertain {
		background: rgba(251, 191, 36, 0.1);
		color: #fbbf24;
	}

	.criteria-list {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.criterion {
		display: flex;
		align-items: baseline;
		gap: 6px;
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.4);
	}

	.criterion.met { color: #f87171; }
	.criterion.bh { color: rgba(255, 255, 255, 0.35); }

	.criterion-check { font-size: 0.6rem; flex-shrink: 0; }
	.criterion-name { white-space: nowrap; }

	.criterion-detail {
		color: rgba(255, 255, 255, 0.25);
		font-size: 0.68rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.disclaimer {
		font-size: 0.65rem;
		color: rgba(255, 255, 255, 0.2);
		margin-top: 10px;
		text-align: center;
		font-style: italic;
	}
</style>
