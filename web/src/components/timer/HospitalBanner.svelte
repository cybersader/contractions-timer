<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { DepartureUrgency } from '../../lib/labor-logic/hospitalAdvisor';
	import { AlertTriangle, ArrowRight, Clock, ChevronRight } from 'lucide-svelte';

	interface Props {
		urgency: DepartureUrgency;
		headline: string;
		detail: string;
		onNavigate?: () => void;
	}
	let { urgency, headline, detail, onNavigate } = $props<Props>();
</script>

{#if urgency !== 'not-yet'}
	<button class="hospital-banner" data-urgency={urgency} onclick={onNavigate} aria-label={$_('timer.hospitalBanner.viewAdvisorAriaLabel')}>
		<div class="banner-icon">
			{#if urgency === 'go-now'}
				<AlertTriangle size={20} />
			{:else if urgency === 'time-to-go'}
				<ArrowRight size={20} />
			{:else}
				<Clock size={20} />
			{/if}
		</div>
		<div class="banner-content">
			<div class="banner-headline">{headline}</div>
			<div class="banner-detail">{detail}</div>
		</div>
		<div class="banner-cta">
			<ChevronRight size={16} />
		</div>
	</button>
{/if}

<style>
	.hospital-banner {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-3);
		animation: fadeSlideIn 300ms ease-out;
		width: 100%;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		text-align: left;
		font-family: inherit;
		font-size: inherit;
	}

	.hospital-banner:active {
		transform: scale(0.98);
	}

	.hospital-banner[data-urgency="go-now"] {
		background: var(--danger-muted);
		border: 1px solid var(--danger);
	}

	.hospital-banner[data-urgency="time-to-go"] {
		background: var(--warning-muted);
		border: 1px solid var(--warning);
	}

	.hospital-banner[data-urgency="start-preparing"] {
		background: var(--accent-muted);
		border: 1px solid var(--accent);
	}

	.banner-icon {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		padding-top: 2px;
	}

	[data-urgency="go-now"] .banner-icon { color: var(--danger); }
	[data-urgency="time-to-go"] .banner-icon { color: var(--warning); }
	[data-urgency="start-preparing"] .banner-icon { color: var(--accent); }

	.banner-headline {
		font-size: var(--text-base);
		font-weight: 700;
	}

	[data-urgency="go-now"] .banner-headline { color: var(--danger); }
	[data-urgency="time-to-go"] .banner-headline { color: var(--warning); }
	[data-urgency="start-preparing"] .banner-headline { color: var(--accent); }

	.banner-detail {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		line-height: 1.4;
		margin-top: var(--space-1);
	}

	.banner-content {
		flex: 1;
		min-width: 0;
	}

	.banner-cta {
		flex-shrink: 0;
		color: var(--text-faint);
		align-self: center;
	}

	@keyframes fadeSlideIn {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
