<script lang="ts">
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

	// BH comparison criteria with icons
	const BH_ROWS = [
		{ criterion: 'Timing', icon: Clock, bh: 'Irregular timing', real: 'Regular timing, getting closer' },
		{ criterion: 'Pattern', icon: Activity, bh: 'Do not get closer together', real: 'Keep coming regardless of activity' },
		{ criterion: 'Rest response', icon: Footprints, bh: 'Stop with movement or position change', real: 'Do not stop with rest or movement' },
		{ criterion: 'Location', icon: MapPinned, bh: 'Felt mainly in front', real: 'Radiate from back or wrap around' },
		{ criterion: 'Intensity', icon: TrendingUp, bh: 'Do not get stronger over time', real: 'Get progressively stronger' },
	];

	// Warning signs with icons
	const WARNING_SIGNS = [
		{ text: 'Vaginal bleeding like a period or heavier', icon: Droplets },
		{ text: 'Baby stops moving or moves much less', icon: Baby },
		{ text: 'Severe abdominal pain that does not ease', icon: AlertTriangle },
		{ text: 'Severe headache with vision changes', icon: Eye },
		{ text: 'Fever above 100.4°F (38°C)', icon: Flame },
		{ text: 'Fluid is green or brown (meconium)', icon: Droplet },
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
				reasons: advice.reasons,
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
		{ id: 'advisor', title: 'Departure advice', defaultExpanded: true, visible: true, badge: advice.urgency === 'go-now' ? 'Go now' : advice.urgency === 'time-to-go' ? 'Time to go' : undefined, hasSettings: true, settingsSection: 'advisor' },
		{ id: 'rule-511', title: '5-1-1 rule progress', defaultExpanded: true, visible: $settings.showThresholdRule && stats.totalContractions >= 3, hasSettings: true, settingsSection: 'threshold' },
		{ id: 'water-break', title: 'Water break', defaultExpanded: true, visible: !!waterBreak },
		{ id: 'tips', title: 'Tips', defaultExpanded: true, visible: $settings.showContextualTips && tipCount > 0 },
		{ id: 'clinical-reference', title: 'Labor guide', defaultExpanded: false, visible: $settings.showClinicalReference },
	]);

	let orderedSections = $derived(
		sectionOrder.map(id => sections.find(s => s.id === id)).filter((s): s is SectionDef => !!s && s.visible)
	);
</script>

<div class="page">
	<h2 class="page-title">Labor advisor</h2>

	<!-- Location toggle -->
	<div class="location-toggle">
		<button class="location-pill" class:active={!enRoute} onclick={() => enRoute = false}>
			<MapPin size={14} aria-hidden="true" />
			At home
		</button>
		<button class="location-pill" class:active={enRoute} onclick={() => enRoute = true}>
			<Car size={14} aria-hidden="true" />
			On the way
		</button>
	</div>
	<p class="location-hint">
		{#if enRoute}
			Travel time removed — estimates show time from now
		{:else if $settings.hospitalAdvisor.travelTimeUncertain}
			Travel time unknown — using ~30 min conservative estimate
		{:else}
			{$settings.hospitalAdvisor.travelTimeMinutes} min travel time included in estimates
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
					<div class="advisor-headline {urgencyColor}">{advice.headline}</div>
					{#if rangeEstimate.patternSummary}
						<p class="advisor-detail">{rangeEstimate.patternSummary}</p>
					{/if}
				{:else if $settings.advisorMode === 'range'}
					<!-- Range: structured layout with clear visual hierarchy -->
					<div class="urgency-badge {urgencyColor}">{advice.headline}</div>
					<p class="advisor-action">{rangeEstimate.recommendation}</p>

					{#if rangeEstimate.likelyMinutes > 0}
						<div class="time-range-card">
							<span class="time-range-value">{formatDurationApprox(rangeEstimate.earliestMinutes)} – {formatDurationApprox(rangeEstimate.latestMinutes)}</span>
							<span class="confidence-pill confidence--{rangeEstimate.confidence}">
								{rangeEstimate.confidence} confidence
							</span>
						</div>
					{/if}

					{#if rangeEstimate.patternSummary || rangeEstimate.trendSummary}
						<div class="pattern-block">
							<div class="block-label">Your pattern</div>
							{#if rangeEstimate.patternSummary}
								<p class="pattern-line">{rangeEstimate.patternSummary}</p>
							{/if}
							{#if rangeEstimate.trendSummary}
								<p class="pattern-line pattern-trend">{rangeEstimate.trendSummary}</p>
							{/if}
						</div>
					{/if}

					{#if rangeEstimate.factors.length > 0}
						<div class="factors-block">
							<div class="block-label">Factors</div>
							<div class="advisor-factors">
								{#each rangeEstimate.factors as factor}
									<span class="factor-tag">{factor}</span>
								{/each}
							</div>
						</div>
					{/if}
				{:else}
					<!-- Urgency (default): headline + detail + factors -->
					<div class="urgency-badge {urgencyColor}">{advice.headline}</div>
					<p class="advisor-action">{advice.detail}</p>
					{#if advice.factors.length > 0}
						<div class="factors-block">
							<div class="block-label">Factors</div>
							<div class="advisor-factors">
								{#each advice.factors as factor}
									<span class="factor-tag">{factor}</span>
								{/each}
							</div>
						</div>
					{/if}
				{/if}

				<!-- Provider phone call button when urgency is high -->
				{#if (advice.urgency === 'go-now' || advice.urgency === 'time-to-go') && $settings.hospitalAdvisor.providerPhone}
					<a href="tel:{$settings.hospitalAdvisor.providerPhone}" class="call-provider-btn">
						Call provider ({$settings.hospitalAdvisor.providerPhone})
					</a>
				{/if}

			{:else if sec.id === 'rule-511'}
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

			{:else if sec.id === 'water-break'}
				<div class="water-header">
					<span class="water-icon">💧</span>
					<span>Water broke {formatElapsedApprox(waterBreakMinutesAgo)} ago</span>
				</div>
				{#if $settings.hospitalAdvisor.providerPhone}
					<a href="tel:{$settings.hospitalAdvisor.providerPhone}" class="call-btn">
						Call provider ({$settings.hospitalAdvisor.providerPhone})
					</a>
				{:else if showInlinePhone}
					<div class="inline-phone-entry">
						<div class="inline-phone-row">
							<input
								type="tel"
								class="inline-phone-input"
								placeholder="e.g. 555-0123"
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
								Save
							</button>
							<button class="inline-phone-cancel" onclick={() => { showInlinePhone = false; inlinePhoneValue = ''; }}>
								Cancel
							</button>
						</div>
					</div>
				{:else}
					<button class="water-note-link" onclick={() => showInlinePhone = true}>
						Add provider phone for quick call access
					</button>
				{/if}
				<p class="water-safety">Note fluid color. Clear/pale yellow is normal. Green/brown → call immediately.</p>
				<div class="water-stats">
					<div class="stat-card">
						<div class="stat-bar-track"><div class="stat-bar-fill" style="width:12%"></div></div>
						<div class="stat-main"><span class="stat-pct">{WATER_BREAK_STATS.beforeContractions}</span> <span class="stat-chance">chance</span></div>
						<div class="stat-label">Water breaks before contractions start</div>
					</div>
					<div class="stat-card">
						<div class="stat-bar-track"><div class="stat-bar-fill stat-bar--mid" style="width:45%"></div></div>
						<div class="stat-main"><span class="stat-pct">{WATER_BREAK_STATS.laborWithin12Hours}</span> <span class="stat-chance">chance</span></div>
						<div class="stat-label">Active labor within 12 hours</div>
					</div>
					<div class="stat-card stat-card--highlight">
						<div class="stat-bar-track"><div class="stat-bar-fill stat-bar--high" style="width:86%"></div></div>
						<div class="stat-main"><span class="stat-pct">{WATER_BREAK_STATS.laborWithin24Hours}</span> <span class="stat-chance">chance</span></div>
						<div class="stat-label">Active labor within 24 hours</div>
						<div class="stat-reassure">Most people start labor naturally within a day</div>
					</div>
				</div>

			{:else if sec.id === 'tips'}
				<ContextualTips />

			{:else if sec.id === 'clinical-reference'}
				<div class="clinical-section">
					<div class="clinical-card">
						<div class="clinical-title">Labor stages</div>
						<div class="clinical-note">Dilation = opening of uterus (0 cm = closed, 10 cm = fully open)</div>
						{#each ['pre-labor', 'early', 'active', 'transition'] as stage}
							{@const ref = STAGE_REFERENCE[stage]}
							{@const frac = stageDilationFraction(stage)}
							{@const isCurrent = stats.laborStage === stage}
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
										<div class="stage-name">{stage === 'pre-labor' ? 'Pre-labor' : stage === 'early' ? 'Early' : stage === 'active' ? 'Active' : 'Transition'}</div>
										{#if isCurrent}
											<span class="stage-current-badge">Current</span>
										{/if}
										<span class="stage-location-tag">{ref.location}</span>
									</div>
									<div class="stage-details">
										<span class="stage-pattern">{ref.contractionPattern}</span>
										<span class="stage-cervix">{ref.cervix}</span>
									</div>
									{#if isCurrent && ref.description}
										<div class="stage-desc">{ref.description}</div>
									{/if}
								</div>
							{/if}
						{/each}
					</div>

					<div class="clinical-card">
						<div class="clinical-title">Braxton Hicks vs. real labor</div>
						<div class="bh-intro">Compare your symptoms to help distinguish practice from real labor.</div>
						<div class="bh-rows">
							{#each BH_ROWS as row}
								<div class="bh-row">
									<div class="bh-row-header">
										<svelte:component this={row.icon} size={14} aria-hidden="true" />
										<span class="bh-criterion">{row.criterion}</span>
									</div>
									<div class="bh-row-items">
										<div class="bh-item bh-item--practice">
											<span class="bh-tag bh-tag--practice">BH</span>
											<span>{row.bh}</span>
										</div>
										<div class="bh-item bh-item--real">
											<span class="bh-tag bh-tag--real">Real</span>
											<span>{row.real}</span>
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>

					<div class="clinical-card clinical-card--warning">
						<div class="warning-title-row">
							<AlertTriangle size={16} aria-hidden="true" />
							<div class="clinical-title">When to call provider immediately</div>
						</div>
						<div class="warning-items">
							{#each WARNING_SIGNS as sign}
								<div class="warning-item">
									<div class="warning-icon">
										<svelte:component this={sign.icon} size={14} aria-hidden="true" />
									</div>
									<span>{sign.text}</span>
								</div>
							{/each}
						</div>
					</div>

					<div class="sources">
						<div class="sources-title">Sources</div>
						{#each Object.values(CLINICAL_SOURCES) as source}
							<a href={source.url} target="_blank" rel="noopener" class="source-link">{source.label}</a>
						{/each}
					</div>

					<div class="clinical-disclaimer">General guidelines only. Always follow your provider's instructions.</div>
				</div>
			{/if}
		</CollapsibleSection>
	{/each}

	{#if stats.totalContractions < 3 && !waterBreak}
		<div class="empty-state">
			<div class="empty-state-icon">
				<Stethoscope size={24} aria-hidden="true" />
			</div>
			<p class="empty-state-title">Labor advisor</p>
			<p class="empty-state-hint">Record at least 3 contractions to see 5-1-1 progress, departure advice, and time estimates.</p>
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

	/* Water break info */
	.water-header { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-base); color: var(--water); font-weight: 600; margin-bottom: var(--space-2); }
	.water-icon { font-size: var(--text-lg); }
	.call-btn { display: block; padding: var(--space-2); border-radius: var(--radius-sm); background: var(--water-muted); color: var(--water); text-decoration: none; text-align: center; font-size: var(--text-base); margin-bottom: var(--space-2); }
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
		background: var(--water-muted);
		color: var(--water);
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
