<script lang="ts">
	import { session } from '../../lib/stores/session';
	import { timerPhase } from '../../lib/stores/timer';
	import { getSessionStats } from '../../lib/labor-logic/calculations';
	import { getLaborStageLabel } from '../../lib/labor-logic/formatters';
	import { settings } from '../../lib/stores/settings';
	import BigButton from './BigButton.svelte';
	import TimerDisplay from './TimerDisplay.svelte';
	import PostRating from './PostRating.svelte';
	import EventButtons from './EventButtons.svelte';
	import SessionControls from './SessionControls.svelte';

	$: completed = $session.contractions.filter(c => c.end !== null);
	$: stats = getSessionStats($session.contractions, $settings.threshold, $settings.stageThresholds);
	$: phase = $timerPhase;
</script>

<div class="page">
	<!-- Stage badge -->
	{#if stats.laborStage}
		<div class="stage-badge"
			class:early={stats.laborStage === 'early'}
			class:active={stats.laborStage === 'active'}
			class:transition={stats.laborStage === 'transition'}
		>
			{getLaborStageLabel(stats.laborStage)}
		</div>
	{/if}

	<!-- Timer display -->
	<TimerDisplay />

	<!-- Big start/stop button -->
	<BigButton />

	<!-- Contraction count -->
	{#if completed.length > 0}
		<div class="contraction-count">
			{completed.length} contraction{completed.length !== 1 ? 's' : ''} recorded
		</div>
	{/if}

	<!-- Post-contraction rating -->
	{#if phase !== 'contracting'}
		<PostRating />
	{/if}

	<!-- Water break button -->
	{#if phase !== 'contracting'}
		<EventButtons />
	{/if}

	<!-- Session controls -->
	<SessionControls />
</div>

<style>
	.stage-badge {
		text-align: center;
		margin-bottom: 8px;
		padding: 4px 12px;
		border-radius: 12px;
		font-size: 0.72rem;
		font-weight: 600;
		width: fit-content;
		margin-left: auto;
		margin-right: auto;
		background: rgba(255, 255, 255, 0.06);
		color: rgba(255, 255, 255, 0.6);
	}

	.stage-badge.early {
		background: rgba(74, 222, 128, 0.1);
		color: #4ade80;
	}

	.stage-badge.active {
		background: rgba(251, 191, 36, 0.12);
		color: #fbbf24;
	}

	.stage-badge.transition {
		background: rgba(248, 113, 113, 0.12);
		color: #f87171;
	}

	.contraction-count {
		text-align: center;
		margin-top: 12px;
		font-size: 0.78rem;
		color: rgba(255, 255, 255, 0.4);
	}
</style>
