<script lang="ts">
	import { _ } from '../../lib/i18n/index';
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import { settingsRequest } from '../../lib/stores/navigation';
	import { BarChart3, Timer } from 'lucide-svelte';
	import CollapsibleSection from '../shared/CollapsibleSection.svelte';
	import SummaryCards from './SummaryCards.svelte';
	import WaveChart from './WaveChart.svelte';
	import StageDurationBar from './StageDurationBar.svelte';
	import ProgressionInsight from './ProgressionInsight.svelte';
	import BraxtonHicksPanel from './BraxtonHicksPanel.svelte';

	let completed = $derived($session.contractions.filter(c => c.end !== null));
	let hasData = $derived(completed.length > 0);

	// Section ordering
	const STORAGE_KEY = 'ct-dashboard-sections';
	const DEFAULT_ORDER = ['summary', 'wave-chart', 'stage-progress', 'trend-analysis', 'pattern-assessment'];

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

	function openSettings(section: string) { settingsRequest.set(section); }

	type SectionDef = { id: string; title: string; defaultExpanded: boolean; visible: boolean; badge?: string; hasSettings?: boolean; settingsSection?: string };
	let sections = $derived<SectionDef[]>([
		{ id: 'summary', title: $_('dashboard.sections.summary'), defaultExpanded: true, visible: true },
		{ id: 'wave-chart', title: $_('dashboard.sections.waveChart'), defaultExpanded: true, visible: $settings.showWaveChart },
		{ id: 'stage-progress', title: $_('dashboard.sections.stageProgress'), defaultExpanded: true, visible: true, hasSettings: true, settingsSection: 'advanced' },
		{ id: 'trend-analysis', title: $_('dashboard.sections.trendAnalysis'), defaultExpanded: false, visible: $settings.showProgressionInsight, hasSettings: true, settingsSection: 'features' },
		{ id: 'pattern-assessment', title: $_('dashboard.sections.patternAssessment'), defaultExpanded: false, visible: $settings.showBraxtonHicksAssessment, hasSettings: true, settingsSection: 'features' },
	]);

	let orderedSections = $derived(
		sectionOrder.map(id => sections.find(s => s.id === id)).filter((s): s is SectionDef => !!s && s.visible)
	);
</script>

<div class="page">
	<h2 class="page-title">{$_('dashboard.pageTitle')}</h2>

	{#if hasData}
		{#each orderedSections as sec, i (sec.id)}
			<CollapsibleSection
				title={sec.title}
				id={`dash-${sec.id}`}
				defaultExpanded={sec.defaultExpanded}
				badge={sec.badge}
				showMoveControls={true}
				canMoveUp={i > 0}
				canMoveDown={i < orderedSections.length - 1}
				onMoveUp={() => moveSection(sec.id, -1)}
				onMoveDown={() => moveSection(sec.id, 1)}
				onSettingsClick={sec.hasSettings ? () => openSettings(sec.settingsSection ?? 'features') : undefined}
			>
				{#if sec.id === 'summary'}
					<SummaryCards />
				{:else if sec.id === 'wave-chart'}
					<WaveChart />
				{:else if sec.id === 'stage-progress'}
					<StageDurationBar />
				{:else if sec.id === 'trend-analysis'}
					<ProgressionInsight />
				{:else if sec.id === 'pattern-assessment'}
					<BraxtonHicksPanel />
				{/if}
			</CollapsibleSection>
		{/each}
	{:else}
		<div class="empty-state">
			<div class="empty-state-icon">
				<BarChart3 size={24} aria-hidden="true" />
			</div>
			<p class="empty-state-title">{$_('dashboard.emptyState.title')}</p>
			<p class="empty-state-hint">{$_('dashboard.emptyState.hint')}</p>
		</div>
	{/if}
</div>

<style>
	/* empty-state styles are in app.css */
</style>
