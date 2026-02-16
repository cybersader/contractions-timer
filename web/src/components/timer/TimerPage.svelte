<script lang="ts">
	import { _ } from '../../lib/i18n/index';
	import { session } from '../../lib/stores/session';
	import { timerPhase, tick } from '../../lib/stores/timer';
	import { getSessionStats, getElapsedSeconds, getRestSeconds } from '../../lib/labor-logic/calculations';
	import { getLaborStageLabel } from '../../lib/labor-logic/formatters';
	import { getDepartureAdvice } from '../../lib/labor-logic/hospitalAdvisor';
	import { getRelevantTipCount } from '../../lib/labor-logic/clinicalData';
	import { settings } from '../../lib/stores/settings';
	import { tabRequest } from '../../lib/stores/navigation';
	import BigButton from './BigButton.svelte';
	import TimerDisplay from './TimerDisplay.svelte';
	import PostRating from './PostRating.svelte';
	import EventButtons from './EventButtons.svelte';
	import SessionControls from './SessionControls.svelte';
	import UntimedEntry from './UntimedEntry.svelte';
	import LiveRatingOverlay from './LiveRatingOverlay.svelte';
	import HeroAction from './HeroAction.svelte';
	import HeroCompactTimer from './HeroCompactTimer.svelte';
	import CollapsibleSection from '../shared/CollapsibleSection.svelte';
	import QuickStats from './QuickStats.svelte';
	import RecentContractions from './RecentContractions.svelte';
	import ContextualTips from '../shared/ContextualTips.svelte';
	import WelcomeState from './WelcomeState.svelte';
	import HospitalBanner from './HospitalBanner.svelte';
	import WaterBreakQuickAction from './WaterBreakQuickAction.svelte';
	import { isP2PActive, peerState, peerCount } from '../../lib/stores/p2p';
	import { shareRequest } from '../../lib/stores/navigation';
	import { Wifi } from 'lucide-svelte';

	let completed = $derived($session.contractions.filter(c => c.end !== null));
	let stats = $derived(getSessionStats($session.contractions, $settings.threshold, $settings.stageThresholds));
	let phase = $derived($timerPhase);
	let paused = $derived($session.paused);
	let waterBroke = $derived($session.events.some(e => e.type === 'water-break'));
	let tipCount = $derived(getRelevantTipCount($session.contractions, $session.events, stats.laborStage));

	// Active contraction (if any)
	let active = $derived($session.contractions.find(c => c.end === null));

	// Live elapsed seconds (tick-driven)
	let elapsed = $derived.by(() => {
		void $tick;
		if (!active) return 0;
		return getElapsedSeconds(active);
	});

	// Live rest seconds (tick-driven, frozen when paused, offset by accumulated pause)
	let rest = $derived.by(() => {
		void $tick;
		return getRestSeconds($session.contractions, $session.pausedAt, $session.pauseAccumulatedMs ?? 0);
	});

	function togglePause() {
		session.update(s => {
			if (s.paused && s.pausedAt) {
				// Unpausing: accumulate the pause duration
				const pauseDuration = Date.now() - Date.parse(s.pausedAt);
				return {
					...s,
					paused: false,
					pausedAt: null,
					pauseAccumulatedMs: (s.pauseAccumulatedMs ?? 0) + pauseDuration,
				};
			} else {
				// Pausing: freeze at current time
				return {
					...s,
					paused: true,
					pausedAt: new Date().toISOString(),
				};
			}
		});
	}

	// === Progressive Disclosure Tiers ===
	// 0: Empty (no contractions, no active)
	// 1: First (1 completed contraction)
	// 2: Tracking (2-4 completed)
	// 3: Pattern (5+ completed)
	// 4: Active (5-1-1 approaching/met, or transition stage)
	let tier = $derived.by(() => {
		const count = completed.length;
		const hasActive = active != null;

		// During active contraction, don't drop tier
		if (count === 0 && !hasActive) return 0;
		if (count <= 1) return 1;
		if (count <= 4) return 2;

		// Check for hospital-worthy patterns
		if (stats.rule511Met || stats.laborStage === 'transition' || stats.laborStage === 'active') {
			return 4;
		}

		return 3;
	});

	// Hospital departure advice (only computed at tier 4)
	let departureAdvice = $derived.by(() => {
		if (tier < 4) return null;
		return getDepartureAdvice(
			$session.contractions,
			$session.events,
			stats,
			$settings.hospitalAdvisor,
			$settings.stageThresholds,
			null
		);
	});

	// Timer page section ordering
	const STORAGE_KEY = 'ct-timer-sections';
	const DEFAULT_ORDER = ['quick-stats', 'recent', 'guidance'];

	let sectionOrder = $state<string[]>(
		(() => {
			try {
				if (typeof localStorage === 'undefined') return [...DEFAULT_ORDER];
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

	type SectionDef = { id: string; title: string; defaultExpanded: boolean; visible: boolean; minTier: number };
	let sections = $derived<SectionDef[]>([
		{ id: 'quick-stats', title: $_('timer.timerPage.sections.quickStats'), defaultExpanded: true, visible: completed.length > 0, minTier: 2 },
		{ id: 'recent', title: $_('timer.timerPage.sections.recent'), defaultExpanded: true, visible: completed.length > 0, minTier: 2 },
		{ id: 'guidance', title: $_('timer.timerPage.sections.guidance'), defaultExpanded: false, visible: $settings.showContextualTips && tipCount > 0, minTier: 3 },
	]);

	let orderedSections = $derived(
		sectionOrder
			.map(id => sections.find(s => s.id === id))
			.filter((s): s is SectionDef => !!s && s.visible && tier >= s.minTier)
	);
</script>

<div class="page">
	<!-- P2P sharing indicator -->
	{#if $isP2PActive}
		<button class="sharing-banner" onclick={() => shareRequest.set(true)}>
			<Wifi size={14} />
			<span>{$_('timer.timerPage.sharingBanner', { values: { count: $peerCount - 1 } })}</span>
			<code class="sharing-code">{$peerState.roomCode}</code>
		</button>
	{/if}

	<!-- Tier 0: Welcome state -->
	{#if tier === 0}
		<WelcomeState />
	{/if}

	<!-- Tier 4: Hospital banner -->
	{#if tier >= 4 && departureAdvice && departureAdvice.urgency !== 'not-yet'}
		<HospitalBanner
			urgency={departureAdvice.urgency}
			headline={$_(departureAdvice.headline.key, { values: departureAdvice.headline.values })}
			detail={$_(departureAdvice.detail.key, { values: departureAdvice.detail.values })}
			onNavigate={() => tabRequest.set(3)}
		/>
	{/if}

	<!-- Hero area: stage badge, action card, or compact timer (tier 1+) -->
	{#if tier >= 1}
		{#if $settings.heroMode === 'action-card'}
			<HeroAction
				{phase}
				laborStage={stats.laborStage}
				avgIntervalMin={stats.avgIntervalMin}
				avgDurationSec={stats.avgDurationSec}
				{waterBroke}
				{paused}
				onNavigate={() => tabRequest.set(3)}
			/>
		{:else if $settings.heroMode === 'compact-timer'}
			<HeroCompactTimer
				{phase}
				{elapsed}
				{rest}
				lastDurationSec={stats.lastDurationSec}
				{paused}
			/>
		{:else if stats.laborStage}
			<div class="stage-badge"
				class:early={stats.laborStage === 'early'}
				class:active={stats.laborStage === 'active'}
				class:transition={stats.laborStage === 'transition'}
			>
				{getLaborStageLabel(stats.laborStage)}
			</div>
		{/if}
	{/if}

	<!-- Timer display with pause overlay -->
	<TimerDisplay {paused} pausedAt={$session.pausedAt} pauseAccumulatedMs={$session.pauseAccumulatedMs ?? 0} onPauseToggle={togglePause} />

	<!-- Big start/stop button -->
	<BigButton />

	<!-- Live rating overlay ("Past the peak?") -->
	<LiveRatingOverlay {phase} {elapsed} />

	<!-- Post-contraction rating (tier 1+) -->
	{#if phase !== 'contracting'}
		<PostRating />
	{/if}

	<!-- Water broke quick action (tier 2+, resting phase) -->
	{#if tier >= 2 && phase !== 'contracting'}
		<WaterBreakQuickAction />
	{/if}

	<!-- Other events: mucus plug, bloody show (tier 2+, hidden during contracting) -->
	{#if tier >= 2 && phase !== 'contracting'}
		<EventButtons hideWaterBreak={true} />
	{/if}

	<!-- Collapsible sections (tier 2+) -->
	{#if orderedSections.length > 0}
		<div class="timer-sections" class:section-appear={tier >= 2}>
			{#each orderedSections as sec, i (sec.id)}
				<CollapsibleSection
					title={sec.title}
					id={`timer-${sec.id}`}
					defaultExpanded={sec.defaultExpanded}
					showMoveControls={true}
					canMoveUp={i > 0}
					canMoveDown={i < orderedSections.length - 1}
					onMoveUp={() => moveSection(sec.id, -1)}
					onMoveDown={() => moveSection(sec.id, 1)}
				>
					{#if sec.id === 'quick-stats'}
						<QuickStats />
					{:else if sec.id === 'recent'}
						<RecentContractions />
					{:else if sec.id === 'guidance'}
						<ContextualTips maxTips={2} />
					{/if}
				</CollapsibleSection>
			{/each}
		</div>
	{/if}

	<!-- Log past contraction (tier 2+, hidden during contracting) -->
	{#if tier >= 2 && phase !== 'contracting'}
		<UntimedEntry />
	{/if}

	<!-- Session controls (tier 1+) -->
	<SessionControls />
</div>

<style>
	.sharing-banner {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		margin-bottom: var(--space-2);
		background: var(--accent-muted);
		border: 1px solid var(--accent);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
		color: var(--accent);
		cursor: pointer;
		width: 100%;
		-webkit-tap-highlight-color: transparent;
	}

	.sharing-banner:active {
		filter: brightness(0.95);
	}

	.sharing-code {
		font-family: monospace;
		font-weight: 600;
		font-size: var(--text-xs);
		opacity: 0.8;
	}

	.stage-badge {
		text-align: center;
		margin-bottom: var(--space-2);
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
		font-weight: 600;
		width: fit-content;
		margin-left: auto;
		margin-right: auto;
		background: var(--border);
		color: var(--text-secondary);
	}

	.stage-badge.early {
		background: var(--success-muted);
		color: var(--success);
	}

	.stage-badge.active {
		background: var(--warning-muted);
		color: var(--warning);
	}

	.stage-badge.transition {
		background: var(--danger-muted);
		color: var(--danger);
	}

	.timer-sections {
		margin-top: var(--space-4);
	}

	.section-appear {
		animation: fadeSlideIn 300ms ease-out;
	}

	@keyframes fadeSlideIn {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
