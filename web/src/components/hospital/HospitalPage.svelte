<script lang="ts">
	import { _ } from '../../lib/i18n/index';
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import { settingsRequest } from '../../lib/stores/navigation';
	import { Stethoscope, Car, MapPin, Clock, Activity, Footprints, MapPinned, TrendingUp, Droplets, Baby, Flame, Eye, AlertTriangle, Droplet } from 'lucide-svelte';
	import { getSessionStats, estimateTimeTo511 } from '../../lib/labor-logic/calculations';
	import { getDepartureAdvice, getRangeEstimate } from '../../lib/labor-logic/hospitalAdvisor';
	import { STAGE_REFERENCE, BH_VS_REAL, WATER_BREAK_STATS, CLINICAL_SOURCES, getRelevantTipCount } from '../../lib/labor-logic/clinicalData';
	import { formatElapsedApprox, formatDurationApprox } from '../../lib/labor-logic/formatters';
	import { tick } from '../../lib/stores/timer';
	import { dlog } from '../../lib/debug-log';
	import CollapsibleSection from '../shared/CollapsibleSection.svelte';
	import ContextualTips from '../shared/ContextualTips.svelte';

	// BH comparison criteria with icons — i18n keys used inline in template
	const BH_ROWS = [
		{ criterionKey: 'timing', icon: Clock, bhKey: 'timingBH', realKey: 'timingReal' },
		{ criterionKey: 'pattern', icon: Activity, bhKey: 'patternBH', realKey: 'patternReal' },
		{ criterionKey: 'restResponse', icon: Footprints, bhKey: 'restBH', realKey: 'restReal' },
		{ criterionKey: 'location', icon: MapPinned, bhKey: 'locationBH', realKey: 'locationReal' },
		{ criterionKey: 'intensity', icon: TrendingUp, bhKey: 'intensityBH', realKey: 'intensityReal' },
	];

	// Warning signs with icons — i18n keys used inline in template
	const WARNING_SIGNS = [
		{ key: 'bleeding', icon: Droplets },
		{ key: 'babyMovement', icon: Baby },
		{ key: 'abdominalPain', icon: AlertTriangle },
		{ key: 'headache', icon: Eye },
		{ key: 'fever', icon: Flame },
		{ key: 'meconium', icon: Droplet },
	];

	// Cervix dilation fraction for SVG ring visual
	const CIRCUMFERENCE = 2 * Math.PI * 11; // ~69.1
	function stageDilationFraction(stage: string): number {
		switch (stage) {
			case 'pre-labor': return 0;
			case 'early': return 0.3;
			case 'active': return 0.8;
			case 'transition': return 0.95;
			default: return 0;
		}
	}

	let enRoute = $state(false);

	let effectiveAdvisor = $derived({
		...$settings.hospitalAdvisor,
		travelTimeMinutes: enRoute ? 0 : $settings.hospitalAdvisor.travelTimeMinutes,
	});

	let stats = $derived(getSessionStats($session.contractions, $settings.threshold, $settings.stageThresholds));
	let timeTo511 = $derived(estimateTimeTo511($session.contractions, $settings.threshold, $settings.chartGapThresholdMin));
	let advice = $derived(getDepartureAdvice(
		$session.contractions,
		$session.events,
		stats,
		effectiveAdvisor,
		$settings.stageThresholds,
		timeTo511
	));

	let rangeEstimate = $derived(getRangeEstimate(
		$session.contractions,
		$session.events,
		stats,
		effectiveAdvisor,
		$settings.advisorProgressionRate,
		timeTo511
	));

	let tipCount = $derived(getRelevantTipCount($session.contractions, $session.events, stats.laborStage));

	// Log advisor results when urgency or 5-1-1 progress changes
	let lastLoggedUrgency = '';
	$effect(() => {
		const u = advice.urgency;
		if (u !== lastLoggedUrgency && stats.totalContractions > 0) {
			dlog('advisor', `Urgency: ${u}`, {
				stage: stats.laborStage,
				rule511Met: stats.rule511Met,
				interval: stats.rule511Progress.intervalValue.toFixed(1),
				duration: stats.rule511Progress.durationValue.toFixed(0),
				sustained: stats.rule511Progress.sustainedValue.toFixed(0),
				timeTo511: timeTo511,
				factors: advice.factors.map(f => f.key),
			}, { src: 'HospitalPage' });
			lastLoggedUrgency = u;
		}
	});

	let urgencyColor = $derived(
		advice.urgency === 'go-now' ? 'urgency--red' :
		advice.urgency === 'time-to-go' ? 'urgency--yellow' :
		advice.urgency === 'start-preparing' ? 'urgency--amber' :
		'urgency--green'
	);

	// Water break info
	let waterBreak = $derived($session.events.find(e => e.type === 'water-break'));
	let waterBreakMinutesAgo = $derived.by(() => {
		void $tick;
		if (!waterBreak) return 0;
		return (Date.now() - new Date(waterBreak.timestamp).getTime()) / 60000;
	});

	// Inline phone entry
	let showInlinePhone = $state(false);
	let showRuleExplainer = $state(false);
	let inlinePhoneValue = $state('');

	// Section ordering
	const STORAGE_KEY = 'ct-hospital-sections';
	const DEFAULT_ORDER = ['advisor', 'rule-511', 'water-break', 'tips', 'clinical-reference'];

	let sectionOrder = $state<string[]>(
		(() => {
			try {
				const saved = localStorage.getItem(STORAGE_KEY);
				return saved ? JSON.parse(saved) : [...DEFAULT_ORDER];
			} catch { return [...DEFAULT_ORDER]; }
		})()
	);

	$effect(() => {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(sectionOrder));
		}
	});

	function moveSection(id: string, dir: -1 | 1) {
		const idx = sectionOrder.indexOf(id);
		if (idx < 0) return;
		const newIdx = idx + dir;
		if (newIdx < 0 || newIdx >= sectionOrder.length) return;
		const copy = [...sectionOrder];
		[copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
		sectionOrder = copy;
	}

	function openSettings(section: string = 'advisor') { settingsRequest.set(section); }

	type SectionDef = { id: string; title: string; defaultExpanded: boolean; visible: boolean; badge?: string; hasSettings?: boolean; settingsSection?: string };
	let sections = $derived<SectionDef[]>([
		{ id: 'advisor', title: $_('hospital.sections.departureAdvice'), defaultExpanded: true, visible: true, badge: advice.urgency === 'go-now' ? $_('hospital.badges.goNow') : advice.urgency === 'time-to-go' ? $_('hospital.badges.timeToGo') : undefined, hasSettings: true, settingsSection: 'advisor' },
		{ id: 'rule-511', title: $_('hospital.sections.ruleProgress'), defaultExpanded: true, visible: $settings.showThresholdRule && stats.totalContractions >= 3, hasSettings: true, settingsSection: 'threshold' },
		{ id: 'water-break', title: $_('hospital.sections.waterBreak'), defaultExpanded: true, visible: !!waterBreak },
		{ id: 'tips', title: $_('hospital.sections.tips'), defaultExpanded: true, visible: $settings.showContextualTips && tipCount > 0 },
		{ id: 'clinical-reference', title: $_('hospital.sections.laborGuide'), defaultExpanded: false, visible: $settings.showClinicalReference },
	]);

	let orderedSections = $derived(
		sectionOrder.map(id => sections.find(s => s.id === id)).filter((s): s is SectionDef => !!s && s.visible)
	);
</script>

<div class="page">
	<h2 class="page-title">{$_('hospital.pageTitle')}</h2>

	<!-- Location toggle -->
	<div class="location-toggle">
		<button class="location-pill" class:active={!enRoute} onclick={() => enRoute = false}>
			<MapPin size={14} aria-hidden="true" />
			{$_('hospital.locationToggle.atHome')}
		</button>
		<button class="location-pill" class:active={enRoute} onclick={() => enRoute = true}>
			<Car size={14} aria-hidden="true" />
			{$_('hospital.locationToggle.onTheWay')}
		</button>
	</div>
	<p class="location-hint">
		{#if enRoute}
			{$_('hospital.locationHint.enRoute')}
		{:else if $settings.hospitalAdvisor.travelTimeUncertain}
			{$_('hospital.locationHint.uncertain')}
		{:else}
			{$_('hospital.locationHint.withTravel', { values: { minutes: $settings.hospitalAdvisor.travelTimeMinutes } })}
		{/if}
	</p>

	{#each orderedSections as sec, i (sec.id)}
		<CollapsibleSection
			title={sec.title}
			id={`hosp-${sec.id}`}
			defaultExpanded={sec.defaultExpanded}
			badge={sec.badge}
			showMoveControls={true}
			canMoveUp={i > 0}
			canMoveDown={i < orderedSections.length - 1}
			onMoveUp={() => moveSection(sec.id, -1)}
			onMoveDown={() => moveSection(sec.id, 1)}
			onSettingsClick={sec.hasSettings ? () => openSettings(sec.settingsSection ?? 'advisor') : undefined}
		>
			{#if sec.id === 'advisor'}
				{#if $settings.advisorMode === 'minimal'}
					<!-- Minimal: single-line summary -->
					<div class="advisor-headline {urgencyColor}">{$_(advice.headline.key, { values: advice.headline.values })}</div>
					{#if rangeEstimate.patternSummary.key}
						<p class="advisor-detail">{$_(rangeEstimate.patternSummary.key, { values: rangeEstimate.patternSummary.values })}</p>
					{/if}
				{:else if $settings.advisorMode === 'range'}
					<!-- Range: structured layout with clear visual hierarchy -->
					<div class="urgency-badge {urgencyColor}">{$_(advice.headline.key, { values: advice.headline.values })}</div>
					<p class="advisor-action">{$_(rangeEstimate.recommendation.key, { values: rangeEstimate.recommendation.values })}</p>

					{#if rangeEstimate.likelyMinutes > 0}
						<div class="time-range-card">
							<span class="time-range-value">{formatDurationApprox(rangeEstimate.earliestMinutes)} – {formatDurationApprox(rangeEstimate.latestMinutes)}</span>
							<span class="confidence-pill confidence--{rangeEstimate.confidence}">
								{$_('hospital.range.confidence', { values: { level: rangeEstimate.confidence } })}
							</span>
						</div>
					{/if}

					{#if rangeEstimate.patternSummary.key || rangeEstimate.trendSummary}
						<div class="pattern-block">
							<div class="block-label">{$_('hospital.range.yourPattern')}</div>
							{#if rangeEstimate.patternSummary.key}
								<p class="pattern-line">{$_(rangeEstimate.patternSummary.key, { values: rangeEstimate.patternSummary.values })}</p>
							{/if}
							{#if rangeEstimate.trendSummary}
								<p class="pattern-line pattern-trend">{$_(rangeEstimate.trendSummary.key, { values: rangeEstimate.trendSummary.values })}</p>
							{/if}
						</div>
					{/if}

					{#if rangeEstimate.factors.length > 0}
						<div class="factors-block">
							<div class="block-label">{$_('hospital.range.factors')}</div>
							<div class="advisor-factors">
								{#each rangeEstimate.factors as factor}
									<span class="factor-tag" class:factor-tag--water={factor.key.includes('water')}>{$_(factor.key, { values: factor.values })}</span>
								{/each}
							</div>
						</div>
					{/if}
				{:else}
					<!-- Urgency (default): headline + detail + factors -->
					<div class="urgency-badge {urgencyColor}">{$_(advice.headline.key, { values: advice.headline.values })}</div>
					<p class="advisor-action">{$_(advice.detail.key, { values: advice.detail.values })}</p>
					{#if advice.factors.length > 0}
						<div class="factors-block">
							<div class="block-label">{$_('hospital.range.factors')}</div>
							<div class="advisor-factors">
								{#each advice.factors as factor}
									<span class="factor-tag" class:factor-tag--water={factor.key.includes('water')}>{$_(factor.key, { values: factor.values })}</span>
								{/each}
							</div>
						</div>
					{/if}
				{/if}

				<!-- Provider phone call button when urgency is high -->
				{#if (advice.urgency === 'go-now' || advice.urgency === 'time-to-go') && $settings.hospitalAdvisor.providerPhone}
					<a href="tel:{$settings.hospitalAdvisor.providerPhone}" class="call-provider-btn">
						{$_('hospital.callProvider', { values: { phone: $settings.hospitalAdvisor.providerPhone } })}
					</a>
				{/if}

			{:else if sec.id === 'rule-511'}
				<div class="rule-items">
					<div class="rule-item" class:met={stats.rule511Progress.intervalOk}>
						<span class="rule-check">{stats.rule511Progress.intervalOk ? '✓' : '○'}</span>
						<span>{$_('hospital.rule511.intervalCheck', { values: { target: $settings.threshold.intervalMinutes, actual: stats.rule511Progress.intervalValue.toFixed(1) } })}</span>
					</div>
					<div class="rule-item" class:met={stats.rule511Progress.durationOk}>
						<span class="rule-check">{stats.rule511Progress.durationOk ? '✓' : '○'}</span>
						<span>{$_('hospital.rule511.durationCheck', { values: { target: Math.round($settings.threshold.durationSeconds / 60), actual: Math.round(stats.rule511Progress.durationValue) } })}</span>
					</div>
					<div class="rule-item" class:met={stats.rule511Progress.sustainedOk}>
						<span class="rule-check">{stats.rule511Progress.sustainedOk ? '✓' : '○'}</span>
						<span>{$_('hospital.rule511.sustainedCheck', { values: { target: $settings.threshold.sustainedMinutes, actual: Math.round(stats.rule511Progress.sustainedValue) } })}</span>
					</div>
				</div>
				<button class="rule-how-toggle" onclick={() => showRuleExplainer = !showRuleExplainer}>
					{showRuleExplainer ? $_('hospital.rule511.howWeCalculateHide') : $_('hospital.rule511.howWeCalculateShow')}
				</button>
				{#if showRuleExplainer}
					<div class="rule-explainer">
						<p>{@html $_('hospital.rule511.explainerInterval', { values: { target: $settings.threshold.intervalMinutes } })}</p>
						<p>{@html $_('hospital.rule511.explainerDuration', { values: { target: $settings.threshold.durationSeconds } })}</p>
						<p>{@html $_('hospital.rule511.explainerSustained', { values: { target: $settings.threshold.sustainedMinutes } })}</p>
						<p class="rule-explainer-note">{@html $_('hospital.rule511.explainerNote')}</p>
					</div>
				{/if}

			{:else if sec.id === 'water-break'}
				<div class="water-header">
					<span class="water-icon">💧</span>
					<span>{$_('hospital.waterBreakInfo.waterBrokeAgo', { values: { elapsed: formatElapsedApprox(waterBreakMinutesAgo) } })}</span>
				</div>
				{#if $settings.hospitalAdvisor.providerPhone}
					<a href="tel:{$settings.hospitalAdvisor.providerPhone}" class="call-btn">
						{$_('hospital.callProvider', { values: { phone: $settings.hospitalAdvisor.providerPhone } })}
					</a>
				{:else if showInlinePhone}
					<div class="inline-phone-entry">
						<div class="inline-phone-row">
							<input
								type="tel"
								class="inline-phone-input"
								placeholder={$_('hospital.waterBreakInfo.phonePlaceholder')}
								bind:value={inlinePhoneValue}
							/>
							<button
								class="inline-phone-save"
								disabled={!inlinePhoneValue.trim()}
								onclick={() => {
									settings.update(s => ({
										...s,
										hospitalAdvisor: { ...s.hospitalAdvisor, providerPhone: inlinePhoneValue.trim() }
									}));
									showInlinePhone = false;
								}}
							>
								{$_('common.save')}
							</button>
							<button class="inline-phone-cancel" onclick={() => { showInlinePhone = false; inlinePhoneValue = ''; }}>
								{$_('common.cancel')}
							</button>
						</div>
					</div>
				{:else}
					<button class="water-note-link" onclick={() => showInlinePhone = true}>
						{$_('hospital.waterBreakInfo.addProviderPhone')}
					</button>
				{/if}
				<p class="water-safety">{$_('hospital.waterBreakInfo.safetyNote')}</p>
				<div class="water-stats">
					<div class="stat-card">
						<div class="stat-bar-track"><div class="stat-bar-fill" style="width:12%"></div></div>
						<div class="stat-main"><span class="stat-pct">{WATER_BREAK_STATS.beforeContractions}</span> <span class="stat-chance">{$_('hospital.waterBreakInfo.statChance')}</span></div>
						<div class="stat-label">{$_('hospital.waterBreakInfo.statBeforeContractions')}</div>
					</div>
					<div class="stat-card">
						<div class="stat-bar-track"><div class="stat-bar-fill stat-bar--mid" style="width:45%"></div></div>
						<div class="stat-main"><span class="stat-pct">{WATER_BREAK_STATS.laborWithin12Hours}</span> <span class="stat-chance">{$_('hospital.waterBreakInfo.statChance')}</span></div>
						<div class="stat-label">{$_('hospital.waterBreakInfo.statWithin12Hours')}</div>
					</div>
					<div class="stat-card stat-card--highlight">
						<div class="stat-bar-track"><div class="stat-bar-fill stat-bar--high" style="width:86%"></div></div>
						<div class="stat-main"><span class="stat-pct">{WATER_BREAK_STATS.laborWithin24Hours}</span> <span class="stat-chance">{$_('hospital.waterBreakInfo.statChance')}</span></div>
						<div class="stat-label">{$_('hospital.waterBreakInfo.statWithin24Hours')}</div>
						<div class="stat-reassure">{$_('hospital.waterBreakInfo.statReassure')}</div>
					</div>
				</div>

			{:else if sec.id === 'tips'}
				<ContextualTips />

			{:else if sec.id === 'clinical-reference'}
				<div class="clinical-section">
					<div class="clinical-card">
						<div class="clinical-title">{$_('hospital.clinicalReference.laborStagesTitle')}</div>
						<div class="clinical-note">{$_('hospital.clinicalReference.dilationNote')}</div>
						{#each ['pre-labor', 'early', 'active', 'transition'] as stage}
							{@const ref = STAGE_REFERENCE[stage]}
							{@const frac = stageDilationFraction(stage)}
							{@const isCurrent = stats.laborStage === stage}
							{@const stageNameKey = stage === 'pre-labor' ? 'preLabor' : stage}
							{#if ref}
								<div class="stage-row" class:current={isCurrent}>
									<div class="stage-header">
										<svg class="dilation-ring" viewBox="0 0 28 28" width="28" height="28">
											<circle cx="14" cy="14" r="11" fill="none" stroke="var(--border)" stroke-width="2.5" />
											{#if frac > 0}
												<circle cx="14" cy="14" r="11" fill="none"
													stroke={isCurrent ? 'var(--accent)' : 'var(--text-muted)'}
													stroke-width="2.5"
													stroke-dasharray="{frac * CIRCUMFERENCE} {CIRCUMFERENCE}"
													stroke-dashoffset="{CIRCUMFERENCE * 0.25}"
													stroke-linecap="round" />
											{/if}
											{#if frac >= 0.9}
												<circle cx="14" cy="14" r="3" fill={isCurrent ? 'var(--accent)' : 'var(--text-muted)'} opacity="0.4" />
											{/if}
										</svg>
										<div class="stage-name">{$_(`hospital.clinicalReference.stageNames.${stageNameKey}`)}</div>
										{#if isCurrent}
											<span class="stage-current-badge">{$_('hospital.clinicalReference.currentBadge')}</span>
										{/if}
										<span class="stage-location-tag">{$_(ref.locationKey)}</span>
									</div>
									<div class="stage-details">
										<span class="stage-pattern">{$_(ref.patternKey)}</span>
										<span class="stage-cervix">{$_(ref.cervixKey)}</span>
									</div>
									{#if isCurrent && ref.descriptionKey}
										<div class="stage-desc">{$_(ref.descriptionKey)}</div>
									{/if}
								</div>
							{/if}
						{/each}
					</div>

					<div class="clinical-card">
						<div class="clinical-title">{$_('hospital.clinicalReference.bhVsRealTitle')}</div>
						<div class="bh-intro">{$_('hospital.clinicalReference.bhIntro')}</div>
						<div class="bh-rows">
							{#each BH_ROWS as row}
								<div class="bh-row">
									<div class="bh-row-header">
										<svelte:component this={row.icon} size={14} aria-hidden="true" />
										<span class="bh-criterion">{$_(`hospital.clinicalReference.bhCriteria.${row.criterionKey}`)}</span>
									</div>
									<div class="bh-row-items">
										<div class="bh-item bh-item--practice">
											<span class="bh-tag bh-tag--practice">{$_('hospital.clinicalReference.bhTag')}</span>
											<span>{$_(`hospital.clinicalReference.bhDescriptions.${row.bhKey}`)}</span>
										</div>
										<div class="bh-item bh-item--real">
											<span class="bh-tag bh-tag--real">{$_('hospital.clinicalReference.realTag')}</span>
											<span>{$_(`hospital.clinicalReference.bhDescriptions.${row.realKey}`)}</span>
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>

					<div class="clinical-card clinical-card--warning">
						<div class="warning-title-row">
							<AlertTriangle size={16} aria-hidden="true" />
							<div class="clinical-title">{$_('hospital.clinicalReference.warningTitle')}</div>
						</div>
						<div class="warning-items">
							{#each WARNING_SIGNS as sign}
								<div class="warning-item">
									<div class="warning-icon">
										<svelte:component this={sign.icon} size={14} aria-hidden="true" />
									</div>
									<span>{$_(`hospital.clinicalReference.warningSigns.${sign.key}`)}</span>
								</div>
							{/each}
						</div>
					</div>

					<div class="sources">
						<div class="sources-title">{$_('hospital.clinicalReference.sourcesTitle')}</div>
						{#each Object.values(CLINICAL_SOURCES) as source}
							<a href={source.url} target="_blank" rel="noopener" class="source-link">{source.label}</a>
						{/each}
					</div>

					<div class="clinical-disclaimer">{$_('hospital.clinicalReference.disclaimer')}</div>
				</div>
			{/if}
		</CollapsibleSection>
	{/each}

	{#if stats.totalContractions < 3 && !waterBreak}
		<div class="empty-state">
			<div class="empty-state-icon">
				<Stethoscope size={24} aria-hidden="true" />
			</div>
			<p class="empty-state-title">{$_('hospital.emptyState.title')}</p>
			<p class="empty-state-hint">{$_('hospital.emptyState.hint')}</p>
		</div>
	{/if}
</div>

<style>
	.location-toggle {
		display: flex;
		gap: var(--space-2);
		margin-bottom: var(--space-1);
	}

	.location-pill {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		background: var(--bg-card);
		color: var(--text-muted);
		font-size: var(--text-sm);
		font-weight: 500;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.location-pill:active {
		transform: scale(0.97);
	}

	.location-pill.active {
		border-color: var(--accent-muted);
		background: var(--accent-muted);
		color: var(--accent);
	}

	.location-hint {
		font-size: var(--text-xs);
		color: var(--text-faint);
		text-align: center;
		margin-bottom: var(--space-3);
	}

	/* Advisor: urgency badge (largest visual weight) */
	.urgency-badge {
		font-size: var(--text-lg);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		margin-bottom: var(--space-2);
	}
	.urgency--red { color: var(--danger); }
	.urgency--yellow { color: var(--warning); }
	.urgency--amber { color: #fb923c; }
	.urgency--green { color: var(--success); }

	/* Advisor: primary action sentence */
	.advisor-action {
		font-size: var(--text-base);
		font-weight: 500;
		color: var(--text-primary);
		line-height: 1.4;
		margin-bottom: var(--space-3);
	}

	/* Advisor: minimal mode headline */
	.advisor-headline {
		font-size: var(--text-xl);
		font-weight: 700;
		margin-bottom: var(--space-1);
	}

	.advisor-detail {
		font-size: var(--text-base);
		color: var(--text-secondary);
		line-height: 1.4;
	}

	/* Time range card */
	.time-range-card {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-3);
		border-radius: var(--radius-md);
		background: var(--bg-card);
		border: 1px solid var(--border);
		margin-bottom: var(--space-3);
	}

	.time-range-value {
		font-size: var(--text-lg);
		font-weight: 600;
		color: var(--text-primary);
		font-family: 'JetBrains Mono', monospace;
	}

	.confidence-pill {
		font-size: var(--text-xs);
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-md);
		font-weight: 500;
	}
	.confidence--low { background: var(--danger-muted); color: var(--danger); }
	.confidence--medium { background: var(--warning-muted); color: var(--warning); }
	.confidence--high { background: var(--success-muted); color: var(--success); }

	/* Pattern + factors blocks */
	.pattern-block, .factors-block {
		margin-bottom: var(--space-3);
	}

	.block-label {
		font-size: var(--text-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-faint);
		margin-bottom: var(--space-1);
	}

	.pattern-line {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		line-height: 1.4;
		margin: 0 0 var(--space-1) 0;
	}

	.pattern-trend {
		color: var(--text-muted);
		font-style: italic;
	}

	.advisor-factors { display: flex; flex-wrap: wrap; gap: var(--space-1); }
	.factor-tag { font-size: var(--text-xs); padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); background: var(--bg-card-hover); color: var(--text-muted); }
	.factor-tag--water { background: var(--danger-muted); color: var(--danger); font-weight: 600; }

	/* Provider call button in advisor section */
	.call-provider-btn {
		display: block;
		padding: var(--space-3);
		border-radius: var(--radius-md);
		background: var(--accent-muted);
		color: var(--accent);
		text-decoration: none;
		text-align: center;
		font-size: var(--text-base);
		font-weight: 600;
		margin-top: var(--space-3);
	}

	/* 5-1-1 rule */
	.rule-items { display: flex; flex-direction: column; gap: var(--space-2); }
	.rule-item { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); color: var(--text-muted); }
	.rule-item.met { color: var(--success); }
	.rule-check { font-size: var(--text-base); }

	/* Rule explainer */
	.rule-how-toggle {
		display: inline-block;
		margin-top: var(--space-2);
		padding: 0;
		border: none;
		background: none;
		color: var(--text-muted);
		font-size: var(--text-xs);
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.rule-explainer {
		margin-top: var(--space-2);
		padding: var(--space-3);
		border-radius: var(--radius-sm);
		background: var(--bg-secondary);
		font-size: var(--text-xs);
		color: var(--text-secondary);
		line-height: 1.5;
	}
	.rule-explainer p { margin: 0 0 var(--space-2) 0; }
	.rule-explainer p:last-child { margin-bottom: 0; }
	.rule-explainer-note {
		border-top: 1px solid var(--border);
		padding-top: var(--space-2);
		color: var(--text-muted);
	}

	/* Water break info */
	.water-header { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-base); color: var(--danger); font-weight: 600; margin-bottom: var(--space-2); }
	.water-icon { font-size: var(--text-lg); }
	.call-btn { display: block; padding: var(--space-2); border-radius: var(--radius-sm); background: var(--danger-muted); color: var(--danger); text-decoration: none; text-align: center; font-size: var(--text-base); font-weight: 600; margin-bottom: var(--space-2); }
	.water-note-link {
		display: block;
		width: 100%;
		padding: var(--space-2) var(--space-3);
		margin-bottom: var(--space-2);
		border: 1px dashed var(--accent-muted);
		border-radius: var(--radius-sm);
		background: none;
		color: var(--accent);
		font-size: var(--text-sm);
		text-decoration: underline;
		text-underline-offset: 2px;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		text-align: left;
	}
	.water-note-link:active { background: var(--accent-muted); }
	.water-safety { font-size: var(--text-sm); color: var(--warning); margin-bottom: var(--space-2); }
	.water-stats { display: flex; flex-direction: column; gap: var(--space-2); }

	/* Stat cards with progress bars */
	.stat-card {
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-sm);
		background: var(--border-muted);
	}
	.stat-card--highlight {
		background: var(--success-muted);
		border: 1px solid var(--success-muted);
	}
	.stat-bar-track {
		height: 4px;
		border-radius: 2px;
		background: var(--border);
		margin-bottom: var(--space-1);
		overflow: hidden;
	}
	.stat-bar-fill {
		height: 100%;
		border-radius: 2px;
		background: var(--text-faint);
	}
	.stat-bar--mid { background: var(--accent); }
	.stat-bar--high { background: var(--success); }
	.stat-main { margin-bottom: 2px; }
	.stat-pct {
		font-family: 'JetBrains Mono', monospace;
		font-size: var(--text-lg);
		font-weight: 700;
		color: var(--text-primary);
	}
	.stat-card--highlight .stat-pct { color: var(--success); }
	.stat-label { font-size: var(--text-xs); color: var(--text-muted); }
	.stat-card--highlight .stat-label { color: var(--text-secondary); }
	.stat-chance { font-size: var(--text-sm); font-weight: 400; color: var(--text-muted); }
	.stat-card--highlight .stat-chance { color: var(--success); opacity: 0.7; }
	.stat-reassure { font-size: var(--text-xs); color: var(--success); font-style: italic; margin-top: var(--space-1); }

	/* Inline phone entry */
	.inline-phone-entry { margin-bottom: var(--space-2); }
	.inline-phone-row {
		display: flex;
		gap: var(--space-2);
		align-items: center;
	}
	.inline-phone-input {
		flex: 1;
		background: var(--input-bg);
		border: 1px solid var(--input-border);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		padding: var(--space-2) var(--space-3);
		font-size: var(--text-sm);
	}
	.inline-phone-save {
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-sm);
		border: none;
		background: var(--danger-muted);
		color: var(--danger);
		font-size: var(--text-sm);
		font-weight: 600;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		white-space: nowrap;
	}
	.inline-phone-save:disabled { opacity: 0.4; cursor: default; }
	.inline-phone-cancel {
		padding: var(--space-2);
		border: none;
		background: none;
		color: var(--text-muted);
		font-size: var(--text-sm);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	/* Clinical reference */
	.clinical-section { display: flex; flex-direction: column; gap: var(--space-3); }
	.clinical-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--space-3); }
	.clinical-card--warning { border-color: var(--danger-muted); }
	.clinical-title { font-size: var(--text-base); font-weight: 600; color: var(--text-secondary); margin-bottom: var(--space-2); }
	.clinical-note { font-size: var(--text-xs); color: var(--text-faint); margin-bottom: var(--space-2); }

	/* Labor stages with dilation rings */
	.stage-row { padding: var(--space-2); border-radius: var(--radius-sm); margin-bottom: var(--space-1); }
	.stage-row.current { background: var(--accent-muted); border: 1px solid var(--accent-muted); }
	.stage-header { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-1); }
	.dilation-ring { flex-shrink: 0; }
	.stage-name { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); }
	.stage-current-badge {
		font-size: var(--text-xs);
		padding: 1px var(--space-2);
		border-radius: var(--radius-sm);
		background: var(--accent-muted);
		color: var(--accent);
		font-weight: 500;
	}
	.stage-location-tag {
		margin-left: auto;
		font-size: var(--text-xs);
		padding: 1px var(--space-2);
		border-radius: var(--radius-sm);
		background: var(--border-muted);
		color: var(--text-faint);
	}
	.stage-details { display: flex; flex-wrap: wrap; gap: var(--space-2); font-size: var(--text-xs); color: var(--text-muted); padding-left: 36px; }
	.stage-desc { font-size: var(--text-xs); color: var(--accent); padding-left: 36px; margin-top: var(--space-1); }

	/* BH vs Real Labor rows */
	.bh-intro { font-size: var(--text-xs); color: var(--text-muted); margin-bottom: var(--space-2); }
	.bh-rows { display: flex; flex-direction: column; gap: var(--space-2); }
	.bh-row {
		padding: var(--space-2);
		border-radius: var(--radius-sm);
		background: var(--border-muted);
	}
	.bh-row-header {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--text-secondary);
		margin-bottom: var(--space-1);
	}
	.bh-criterion { font-size: var(--text-sm); font-weight: 600; }
	.bh-row-items { display: flex; flex-direction: column; gap: var(--space-1); }
	.bh-item {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		font-size: var(--text-xs);
	}
	.bh-item--practice { color: var(--text-muted); }
	.bh-item--real { color: var(--text-primary); font-weight: 500; }
	.bh-tag {
		flex-shrink: 0;
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		padding: 1px var(--space-1);
		border-radius: 3px;
		letter-spacing: 0.03em;
	}
	.bh-tag--practice { background: var(--border); color: var(--text-faint); }
	.bh-tag--real { background: var(--danger-muted); color: var(--danger); }

	/* Warning signs with icons */
	.warning-title-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--danger);
		margin-bottom: var(--space-2);
	}
	.warning-title-row .clinical-title { margin-bottom: 0; color: var(--danger); }
	.warning-items { display: flex; flex-direction: column; gap: var(--space-1); }
	.warning-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		border-radius: var(--radius-sm);
		background: var(--danger-muted);
		font-size: var(--text-sm);
		color: var(--danger);
	}
	.warning-icon {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		opacity: 0.7;
	}

	.sources { padding: var(--space-2) 0; }
	.sources-title { font-size: var(--text-sm); font-weight: 600; color: var(--text-muted); margin-bottom: var(--space-1); }
	.source-link { display: block; font-size: var(--text-xs); color: var(--accent); text-decoration: none; margin-bottom: var(--space-1); }

	.clinical-disclaimer { font-size: var(--text-xs); color: var(--text-faint); text-align: center; font-style: italic; }
</style>
