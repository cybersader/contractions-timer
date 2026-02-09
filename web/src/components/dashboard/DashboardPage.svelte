<script lang="ts">
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import SummaryCards from './SummaryCards.svelte';
	import WaveChart from './WaveChart.svelte';
	import StageDurationBar from './StageDurationBar.svelte';
	import ProgressionInsight from './ProgressionInsight.svelte';
	import BraxtonHicksPanel from './BraxtonHicksPanel.svelte';

	$: hasData = $session.contractions.filter(c => c.end !== null).length > 0;
</script>

<div class="page">
	<h2 class="page-title">Dashboard</h2>

	{#if hasData}
		<SummaryCards />

		{#if $settings.showWaveChart}
			<WaveChart />
		{/if}

		<StageDurationBar />

		{#if $settings.showProgressionInsight}
			<ProgressionInsight />
		{/if}

		{#if $settings.showBraxtonHicksAssessment}
			<BraxtonHicksPanel />
		{/if}
	{:else}
		<div class="empty-state">
			<p>Start timing contractions to see your dashboard.</p>
			<p class="hint">Swipe left to the Timer tab to begin.</p>
		</div>
	{/if}
</div>

<style>
	.empty-state {
		text-align: center;
		padding: 48px 16px;
		color: rgba(255, 255, 255, 0.4);
		font-size: 0.9rem;
	}

	.hint {
		font-size: 0.78rem;
		color: rgba(255, 255, 255, 0.25);
		margin-top: 8px;
	}
</style>
