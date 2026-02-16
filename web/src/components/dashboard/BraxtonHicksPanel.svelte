<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import { assessBraxtonHicks } from '../../lib/labor-logic/braxtonHicksAssessment';

	let assessment = $derived.by(() => {
		const completedCount = $session.contractions.filter(c => c.end !== null).length;
		if (completedCount < 4) return null;
		return assessBraxtonHicks($session.contractions, $session.events, $settings.bhThresholds, $settings.chartGapThresholdMin);
	});

	let verdictColor = $derived(
		assessment?.verdict === 'likely-real-labor' ? 'verdict--real'
		: assessment?.verdict === 'likely-braxton-hicks' ? 'verdict--bh'
		: 'verdict--uncertain'
	);

	let verdictLabel = $derived(
		assessment?.verdict === 'likely-real-labor' ? $_('dashboard.braxtonHicks.likelyRealLabor')
		: assessment?.verdict === 'likely-braxton-hicks' ? $_('dashboard.braxtonHicks.likelyPractice')
		: $_('dashboard.braxtonHicks.mixedSignals')
	);

	let expandedCriterion = $state<string | null>(null);

	function toggleCriterion(name: string) {
		expandedCriterion = expandedCriterion === name ? null : name;
	}
</script>

{#if assessment && !assessment.requiresMore}
	<div class="bh-panel">
		<div class="panel-header">
			<span class="panel-title">{$_('dashboard.braxtonHicks.panelTitle')}</span>
			<span class="verdict-badge {verdictColor}">{verdictLabel}</span>
		</div>

		<div class="criteria-list">
			{#each assessment.criteria as criterion}
				<button
					class="criterion"
					class:met={criterion.result === 'real-labor'}
					class:bh={criterion.result === 'braxton-hicks'}
					onclick={() => toggleCriterion(criterion.name)}
				>
					<span class="criterion-check">{criterion.result === 'real-labor' ? '●' : criterion.result === 'braxton-hicks' ? '○' : '◐'}</span>
					<span class="criterion-name">{criterion.name}</span>
					{#if criterion.detail && expandedCriterion !== criterion.name}
						<span class="criterion-detail">— {criterion.detail}</span>
					{/if}
				</button>
				{#if expandedCriterion === criterion.name && criterion.detail}
					<div class="criterion-expanded">
						{criterion.detail}
					</div>
				{/if}
			{/each}
		</div>

		<div class="disclaimer">{$_('dashboard.braxtonHicks.disclaimer')}</div>
	</div>
{/if}

<style>
	.bh-panel {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: var(--space-3);
		margin-bottom: var(--space-3);
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-3);
	}

	.panel-title {
		font-size: var(--text-base);
		font-weight: 600;
		color: var(--text-secondary);
	}

	.verdict-badge {
		font-size: var(--text-xs);
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-sm);
		font-weight: 600;
	}

	.verdict--real {
		background: var(--danger-muted);
		color: var(--danger);
	}

	.verdict--bh {
		background: var(--border);
		color: var(--text-muted);
	}

	.verdict--uncertain {
		background: var(--warning-muted);
		color: var(--warning);
	}

	.criteria-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.criterion {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		font-size: var(--text-sm);
		color: var(--text-muted);
		background: none;
		border: none;
		padding: var(--space-1) 0;
		cursor: pointer;
		text-align: left;
		width: 100%;
		-webkit-tap-highlight-color: transparent;
	}

	.criterion.met { color: var(--danger); }
	.criterion.bh { color: var(--text-faint); }

	.criterion-check { font-size: var(--text-xs); flex-shrink: 0; }
	.criterion-name { white-space: nowrap; }

	.criterion-detail {
		color: var(--text-faint);
		font-size: var(--text-xs);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.criterion-expanded {
		font-size: var(--text-xs);
		color: var(--text-muted);
		background: var(--bg-card-hover);
		border-radius: var(--radius-sm);
		padding: var(--space-2) var(--space-2);
		margin: 0 0 var(--space-1) var(--space-5);
		line-height: 1.4;
	}

	.disclaimer {
		font-size: var(--text-xs);
		color: var(--text-faint);
		margin-top: var(--space-3);
		text-align: center;
		font-style: italic;
	}
</style>
