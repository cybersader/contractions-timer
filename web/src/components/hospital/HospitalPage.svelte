<script lang="ts">
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import { getSessionStats, estimateTimeTo511 } from '../../lib/labor-logic/calculations';
	import { getDepartureAdvice } from '../../lib/labor-logic/hospitalAdvisor';
	import { getRelevantTips, dismissTip, STAGE_REFERENCE, BH_VS_REAL, WATER_BREAK_STATS, CLINICAL_SOURCES } from '../../lib/labor-logic/clinicalData';
	import { formatElapsedApprox } from '../../lib/labor-logic/formatters';

	$: stats = getSessionStats($session.contractions, $settings.threshold, $settings.stageThresholds);
	$: timeTo511 = estimateTimeTo511($session.contractions, $settings.threshold, $settings.chartGapThresholdMin);
	$: advice = getDepartureAdvice(
		$session.contractions,
		$session.events,
		stats,
		$settings.hospitalAdvisor,
		$settings.stageThresholds,
		timeTo511
	);

	$: urgencyColor = advice.urgency === 'go-now' ? 'urgency--red' :
		advice.urgency === 'time-to-go' ? 'urgency--yellow' :
		advice.urgency === 'start-preparing' ? 'urgency--amber' :
		'urgency--green';

	// Water break info
	$: waterBreak = $session.events.find(e => e.type === 'water-break');
	$: waterBreakMinutesAgo = waterBreak
		? (Date.now() - new Date(waterBreak.timestamp).getTime()) / 60000
		: 0;

	// Contextual tips
	$: tips = $settings.showContextualTips
		? getRelevantTips($session.contractions, $session.events, stats.laborStage, null)
		: [];

	let showClinical = false;

	function handleDismissTip(id: string) {
		dismissTip(id);
		tips = tips.filter(t => t.id !== id);
	}
</script>

<div class="page">
	<h2 class="page-title">Hospital advisor</h2>

	<!-- Advisor card -->
	<div class="advisor-card">
		<div class="advisor-headline {urgencyColor}">{advice.headline}</div>
		<p class="advisor-detail">{advice.detail}</p>
		{#if advice.factors.length > 0}
			<div class="advisor-factors">
				{#each advice.factors as factor}
					<span class="factor-tag">{factor}</span>
				{/each}
			</div>
		{/if}
	</div>

	<!-- 5-1-1 progress -->
	{#if stats.totalContractions >= 3}
		<div class="rule-card">
			<div class="rule-title">5-1-1 rule progress</div>
			<div class="rule-items">
				<div class="rule-item" class:met={stats.rule511Progress.intervalOk}>
					<span class="rule-check">{stats.rule511Progress.intervalOk ? '✓' : '○'}</span>
					<span>{$settings.threshold.intervalMinutes} min apart (avg {stats.rule511Progress.intervalValue.toFixed(1)} min)</span>
				</div>
				<div class="rule-item" class:met={stats.rule511Progress.durationOk}>
					<span class="rule-check">{stats.rule511Progress.durationOk ? '✓' : '○'}</span>
					<span>{Math.round($settings.threshold.durationSeconds / 60)} min long (avg {Math.round(stats.rule511Progress.durationValue)}s)</span>
				</div>
				<div class="rule-item" class:met={stats.rule511Progress.sustainedOk}>
					<span class="rule-check">{stats.rule511Progress.sustainedOk ? '✓' : '○'}</span>
					<span>{$settings.threshold.sustainedMinutes} min sustained ({Math.round(stats.rule511Progress.sustainedValue)} min)</span>
				</div>
			</div>
		</div>
	{:else}
		<div class="empty-hint">Record at least 3 contractions to see hospital advice.</div>
	{/if}

	<!-- Water break info -->
	{#if waterBreak}
		<div class="water-card">
			<div class="water-header">
				<span class="water-icon">💧</span>
				<span>Water broke {formatElapsedApprox(waterBreakMinutesAgo)} ago</span>
			</div>
			{#if $settings.hospitalAdvisor.providerPhone}
				<a href="tel:{$settings.hospitalAdvisor.providerPhone}" class="call-btn">
					📞 Call provider ({$settings.hospitalAdvisor.providerPhone})
				</a>
			{:else}
				<p class="water-note">Add your provider's phone number in Settings for quick access here.</p>
			{/if}
			<p class="water-safety">Note fluid color. Clear/pale yellow is normal. Green/brown → call immediately.</p>
			<div class="water-stats">
				<div class="stat-row"><span>Water breaks before contractions</span><span>{WATER_BREAK_STATS.beforeContractions}</span></div>
				<div class="stat-row"><span>Active labor within 12h</span><span>{WATER_BREAK_STATS.laborWithin12Hours}</span></div>
				<div class="stat-row"><span>Active labor within 24h</span><span>{WATER_BREAK_STATS.laborWithin24Hours}</span></div>
			</div>
		</div>
	{/if}

	<!-- Contextual tips -->
	{#if tips.length > 0}
		<div class="tips-section">
			{#each tips.slice(0, 2) as tip (tip.id)}
				<div class="tip-card tip--{tip.category}">
					<span class="tip-icon">
						{tip.category === 'safety' ? '⚠️' : tip.category === 'action' ? '➡️' : tip.category === 'timing' ? '⏰' : tip.category === 'comfort' ? '❤️' : '📖'}
					</span>
					<span class="tip-text">{tip.text}</span>
					<button class="tip-dismiss" on:click={() => handleDismissTip(tip.id)}>✕</button>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Clinical reference toggle -->
	<button class="clinical-toggle" on:click={() => showClinical = !showClinical}>
		{showClinical ? 'Hide' : 'Show'} labor guide
	</button>

	{#if showClinical}
		<div class="clinical-section">
			<!-- Labor stages table -->
			<div class="clinical-card">
				<div class="clinical-title">Labor stages</div>
				<div class="clinical-note">Dilation = opening of uterus (0 cm = closed, 10 = fully open)</div>
				{#each ['pre-labor', 'early', 'active', 'transition'] as stage}
					{@const ref = STAGE_REFERENCE[stage]}
					{#if ref}
						<div class="stage-row" class:current={stats.laborStage === stage}>
							<div class="stage-name">{stage === 'pre-labor' ? 'Pre-labor' : stage === 'early' ? 'Early' : stage === 'active' ? 'Active' : 'Transition'}</div>
							<div class="stage-info">
								<span class="stage-pattern">{ref.contractionPattern}</span>
								<span class="stage-cervix">{ref.cervix}</span>
								<span class="stage-location">{ref.location}</span>
							</div>
						</div>
					{/if}
				{/each}
			</div>

			<!-- BH vs Real -->
			<div class="clinical-card">
				<div class="clinical-title">Braxton Hicks vs. real labor</div>
				<div class="comparison-grid">
					<div class="comparison-col">
						<div class="col-header">Practice (Braxton Hicks)</div>
						{#each BH_VS_REAL.braxtonHicks as item}
							<div class="col-item">○ {item}</div>
						{/each}
					</div>
					<div class="comparison-col comparison-col--real">
						<div class="col-header">Real labor</div>
						{#each BH_VS_REAL.realLabor as item}
							<div class="col-item">● {item}</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- When to call -->
			<div class="clinical-card clinical-card--warning">
				<div class="clinical-title">When to call provider immediately</div>
				<ul class="warning-list">
					<li>Vaginal bleeding like a period or heavier</li>
					<li>Baby stops moving or moves much less</li>
					<li>Severe abdominal pain that does not ease</li>
					<li>Severe headache with vision changes</li>
					<li>Fever above 100.4°F (38°C)</li>
					<li>Fluid is green or brown (meconium)</li>
				</ul>
			</div>

			<!-- Sources -->
			<div class="sources">
				<div class="sources-title">Sources</div>
				{#each Object.values(CLINICAL_SOURCES) as source}
					<a href={source.url} target="_blank" rel="noopener" class="source-link">{source.label}</a>
				{/each}
			</div>

			<div class="clinical-disclaimer">General guidelines only. Always follow your provider's instructions.</div>
		</div>
	{/if}
</div>

<style>
	.advisor-card {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		padding: 16px;
		margin-bottom: 12px;
	}

	.advisor-headline { font-size: 1.2rem; font-weight: 700; margin-bottom: 4px; }
	.urgency--red { color: #f87171; }
	.urgency--yellow { color: #fbbf24; }
	.urgency--amber { color: #fb923c; }
	.urgency--green { color: #4ade80; }

	.advisor-detail { font-size: 0.82rem; color: rgba(255, 255, 255, 0.6); line-height: 1.4; }

	.advisor-factors { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px; }
	.factor-tag { font-size: 0.68rem; padding: 2px 8px; border-radius: 6px; background: rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.4); }

	.rule-card { background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; padding: 14px; margin-bottom: 12px; }
	.rule-title { font-size: 0.82rem; font-weight: 600; color: rgba(255, 255, 255, 0.7); margin-bottom: 8px; }
	.rule-items { display: flex; flex-direction: column; gap: 6px; }
	.rule-item { display: flex; align-items: center; gap: 8px; font-size: 0.78rem; color: rgba(255, 255, 255, 0.4); }
	.rule-item.met { color: #4ade80; }
	.rule-check { font-size: 0.9rem; }

	.empty-hint { text-align: center; padding: 32px 16px; color: rgba(255, 255, 255, 0.3); font-size: 0.82rem; }

	/* Water break info */
	.water-card { background: rgba(59, 130, 246, 0.04); border: 1px solid rgba(59, 130, 246, 0.15); border-radius: 12px; padding: 14px; margin-bottom: 12px; }
	.water-header { display: flex; align-items: center; gap: 8px; font-size: 0.88rem; color: #60a5fa; font-weight: 600; margin-bottom: 8px; }
	.water-icon { font-size: 1.1rem; }
	.call-btn { display: block; padding: 8px; border-radius: 8px; background: rgba(59, 130, 246, 0.1); color: #60a5fa; text-decoration: none; text-align: center; font-size: 0.82rem; margin-bottom: 8px; }
	.water-note { font-size: 0.75rem; color: rgba(255, 255, 255, 0.4); margin-bottom: 8px; }
	.water-safety { font-size: 0.78rem; color: #fbbf24; margin-bottom: 8px; }
	.water-stats { display: flex; flex-direction: column; gap: 4px; }
	.stat-row { display: flex; justify-content: space-between; font-size: 0.72rem; color: rgba(255, 255, 255, 0.4); }

	/* Tips */
	.tips-section { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
	.tip-card { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 10px; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); }
	.tip--safety { border-color: rgba(251, 191, 36, 0.2); }
	.tip--action { border-color: rgba(129, 140, 248, 0.2); }
	.tip-icon { flex-shrink: 0; font-size: 0.9rem; }
	.tip-text { font-size: 0.78rem; color: rgba(255, 255, 255, 0.6); line-height: 1.4; flex: 1; }
	.tip-dismiss { background: none; border: none; color: rgba(255, 255, 255, 0.25); font-size: 0.8rem; cursor: pointer; padding: 0 2px; flex-shrink: 0; }

	/* Clinical toggle */
	.clinical-toggle { width: 100%; padding: 10px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.02); color: rgba(255, 255, 255, 0.5); font-size: 0.82rem; cursor: pointer; margin-bottom: 12px; }

	/* Clinical reference */
	.clinical-section { display: flex; flex-direction: column; gap: 12px; }
	.clinical-card { background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; padding: 14px; }
	.clinical-card--warning { border-color: rgba(248, 113, 113, 0.15); }
	.clinical-title { font-size: 0.82rem; font-weight: 600; color: rgba(255, 255, 255, 0.7); margin-bottom: 8px; }
	.clinical-note { font-size: 0.68rem; color: rgba(255, 255, 255, 0.3); margin-bottom: 8px; }

	.stage-row { padding: 8px; border-radius: 8px; margin-bottom: 4px; }
	.stage-row.current { background: rgba(129, 140, 248, 0.06); border: 1px solid rgba(129, 140, 248, 0.15); }
	.stage-name { font-size: 0.78rem; font-weight: 600; color: rgba(255, 255, 255, 0.7); margin-bottom: 2px; }
	.stage-info { display: flex; flex-wrap: wrap; gap: 8px; font-size: 0.68rem; color: rgba(255, 255, 255, 0.4); }

	.comparison-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
	.comparison-col { display: flex; flex-direction: column; gap: 4px; }
	.col-header { font-size: 0.72rem; font-weight: 600; color: rgba(255, 255, 255, 0.5); margin-bottom: 2px; }
	.comparison-col--real .col-header { color: #f87171; }
	.col-item { font-size: 0.68rem; color: rgba(255, 255, 255, 0.4); }

	.warning-list { margin: 0; padding-left: 16px; }
	.warning-list li { font-size: 0.78rem; color: #f87171; margin-bottom: 4px; }

	.sources { padding: 8px 0; }
	.sources-title { font-size: 0.72rem; font-weight: 600; color: rgba(255, 255, 255, 0.4); margin-bottom: 4px; }
	.source-link { display: block; font-size: 0.68rem; color: #818cf8; text-decoration: none; margin-bottom: 2px; }

	.clinical-disclaimer { font-size: 0.65rem; color: rgba(255, 255, 255, 0.2); text-align: center; font-style: italic; }
</style>
