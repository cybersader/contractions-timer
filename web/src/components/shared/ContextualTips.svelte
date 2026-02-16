<script lang="ts">
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import { getSessionStats } from '../../lib/labor-logic/calculations';
	import { getRelevantTips, dismissTip, type TipCategory } from '../../lib/labor-logic/clinicalData';
	import { AlertTriangle, ArrowRight, Timer, Heart, BookOpen, Lightbulb, X } from 'lucide-svelte';
	import type { Component } from 'svelte';
	import { _ } from 'svelte-i18n';

	interface Props {
		maxTips?: number;
		categories?: TipCategory[];
	}
	let { maxTips = 2, categories }: Props = $props();

	let stats = $derived(getSessionStats($session.contractions, $settings.threshold, $settings.stageThresholds));

	// Force re-derive when a tip is dismissed
	let dismissedVersion = $state(0);

	let tips = $derived.by(() => {
		void dismissedVersion;
		if (!$settings.showContextualTips) return [];
		let all = getRelevantTips($session.contractions, $session.events, stats.laborStage, null);
		if (categories) all = all.filter(t => categories.includes(t.category));
		return all.slice(0, maxTips);
	});

	const CATEGORY_ICONS: Record<string, Component> = {
		safety: AlertTriangle,
		action: ArrowRight,
		timing: Timer,
		comfort: Heart,
		education: BookOpen,
	};

	function handleDismiss(tipId: string) {
		dismissTip(tipId);
		dismissedVersion++;
	}
</script>

{#if tips.length > 0}
	<div class="tips-container">
		{#each tips as tip (tip.id)}
			<div class="tip" data-category={tip.category}>
				<span class="tip-icon">
					{#if CATEGORY_ICONS[tip.category]}
						<svelte:component this={CATEGORY_ICONS[tip.category]} size={16} />
					{:else}
						<Lightbulb size={16} />
					{/if}
				</span>
				<span class="tip-text">{$_(tip.textKey)}</span>
				<button class="tip-dismiss" onclick={() => handleDismiss(tip.id)} aria-label={$_('shared.contextualTips.dismissTipAriaLabel')}>
					<X size={14} />
				</button>
			</div>
		{/each}
	</div>
{/if}

<style>
	.tips-container { display: flex; flex-direction: column; gap: var(--space-2); }
	.tip {
		display: flex; align-items: flex-start; gap: var(--space-2);
		padding: var(--space-3) var(--space-3); border-radius: var(--radius-md);
		background: var(--bg-card); border: 1px solid var(--border);
	}
	.tip[data-category="safety"] { border-color: var(--warning-muted); }
	.tip[data-category="action"] { border-color: var(--accent-muted); }
	.tip-icon { flex-shrink: 0; display: flex; align-items: center; color: var(--text-muted); }
	.tip-text { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.4; flex: 1; }
	.tip-dismiss { background: none; border: none; color: var(--text-faint); cursor: pointer; padding: 0 var(--space-1); flex-shrink: 0; min-width: var(--space-5); min-height: var(--space-5); display: flex; align-items: center; justify-content: center; }
</style>
