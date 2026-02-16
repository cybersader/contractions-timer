<script lang="ts">
	import { _ } from '../../lib/i18n/index';
	import type { TimerPhase } from '../../lib/stores/timer';
	import type { LaborStage } from '../../lib/labor-logic/types';
	import { ChevronRight } from 'lucide-svelte';

	interface Props {
		phase: TimerPhase;
		laborStage: LaborStage | null;
		avgIntervalMin: number;
		avgDurationSec: number;
		waterBroke: boolean;
		paused: boolean;
		onNavigate?: () => void;
	}
	let { phase, laborStage, avgIntervalMin, avgDurationSec, waterBroke, paused, onNavigate } = $props<Props>();

	let showCta = $derived(
		phase !== 'contracting' && !paused &&
		(laborStage === 'active' || laborStage === 'transition' || waterBroke)
	);

	const STAGE_ACTION_KEYS: Record<string, string> = {
		'pre-labor': 'timer.heroAction.stageActions.preLabor',
		early: 'timer.heroAction.stageActions.early',
		active: 'timer.heroAction.stageActions.active',
		transition: 'timer.heroAction.stageActions.transition',
	};

	const CONTRACTION_MESSAGE_KEYS: Record<string, string> = {
		'pre-labor': 'timer.heroAction.contractionMessages.preLabor',
		early: 'timer.heroAction.contractionMessages.early',
		active: 'timer.heroAction.contractionMessages.active',
		transition: 'timer.heroAction.contractionMessages.transition',
	};

	let actionText = $derived.by(() => {
		if (paused) return $_('timer.heroAction.paused');
		if (phase === 'idle') return $_('timer.heroAction.tapStartPrompt');
		if (phase === 'contracting') {
			const key = CONTRACTION_MESSAGE_KEYS[laborStage ?? ''];
			return key ? $_(key) : $_('timer.heroAction.defaultContractionMessage');
		}
		// Resting phase
		if (waterBroke) {
			if (laborStage === 'active') return $_('timer.heroAction.waterBrokeActive');
			if (laborStage === 'transition') return $_('timer.heroAction.waterBrokeTransition');
			return $_('timer.heroAction.waterBrokeDefault');
		}
		const key = STAGE_ACTION_KEYS[laborStage ?? ''];
		return key ? $_(key) : $_('timer.heroAction.keepTracking');
	});

	let stageClass = $derived(
		phase === 'contracting' ? 'contracting' :
		phase === 'idle' ? 'idle' :
		waterBroke ? 'water-broke' :
		laborStage ?? 'idle'
	);

	let detail = $derived(
		avgIntervalMin > 0
			? $_('timer.heroAction.detailTemplate', { values: { interval: avgIntervalMin.toFixed(0), duration: Math.round(avgDurationSec).toString() } })
			: ''
	);
</script>

{#if showCta && onNavigate}
	<button class="hero-action hero-action--tappable" class:paused data-stage={stageClass} onclick={onNavigate}>
		<div class="hero-action-body">
			<div class="action-text">{actionText}</div>
			{#if detail && !paused}
				<div class="action-detail">{detail}</div>
			{/if}
		</div>
		<div class="hero-cta">
			<ChevronRight size={16} />
		</div>
	</button>
{:else}
	<div class="hero-action" class:paused data-stage={stageClass}>
		<div class="action-text">{actionText}</div>
		{#if detail && !paused}
			<div class="action-detail">{detail}</div>
		{/if}
	</div>
{/if}

<style>
	.hero-action {
		text-align: center;
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-md);
		background: var(--bg-card);
		border: 1px solid var(--border);
		margin-bottom: var(--space-2);
		transition: all var(--transition-base);
	}

	.hero-action.paused {
		opacity: 0.6;
	}

	.action-text {
		font-size: var(--text-base);
		font-weight: 600;
		color: var(--text-secondary);
		line-height: 1.3;
	}

	[data-stage="contracting"] .action-text { color: var(--danger); }
	[data-stage="idle"] .action-text { color: var(--text-muted); }
	[data-stage="pre-labor"] .action-text { color: var(--text-secondary); }
	[data-stage="early"] .action-text { color: var(--success); }
	[data-stage="active"] .action-text { color: var(--warning); }
	[data-stage="transition"] .action-text { color: var(--danger); }
	[data-stage="water-broke"] .action-text { color: var(--water, var(--accent)); }

	[data-stage="contracting"] { border-color: var(--danger-muted); background: var(--danger-muted); }
	[data-stage="water-broke"] { border-color: var(--water-muted, var(--accent-muted)); }

	.action-detail {
		font-size: var(--text-sm);
		color: var(--text-faint);
		margin-top: var(--space-1);
	}

	.hero-action--tappable {
		display: flex;
		align-items: center;
		width: 100%;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.hero-action--tappable:active {
		transform: scale(0.98);
	}

	.hero-action-body {
		flex: 1;
		min-width: 0;
	}

	.hero-cta {
		flex-shrink: 0;
		color: var(--text-faint);
		margin-left: var(--space-2);
	}
</style>
