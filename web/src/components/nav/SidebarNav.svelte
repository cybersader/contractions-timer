<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { Clock, BarChart3, List, Stethoscope, Menu } from 'lucide-svelte';

	interface Props {
		activeIndex: number;
		onTabClick: (index: number) => void;
		onMenuToggle: () => void;
	}
	let { activeIndex, onTabClick, onMenuToggle } = $props<Props>();

	const tabs = [
		{ labelKey: 'nav.timer', icon: Clock },
		{ labelKey: 'nav.dashboard', icon: BarChart3 },
		{ labelKey: 'nav.history', icon: List },
		{ labelKey: 'nav.advisor', icon: Stethoscope },
	];
</script>

<aside class="sidebar" role="navigation" aria-label={$_('nav.mainNavAriaLabel')}>
	<button class="sidebar-brand" onclick={() => onTabClick(0)} aria-label={$_('nav.goToTimerAriaLabel')}>
		<Clock size={22} strokeWidth={1.5} color="var(--accent)" aria-hidden="true" />
		<span class="sidebar-title">{$_('nav.brandTitle')}</span>
	</button>

	<nav class="sidebar-tabs" role="tablist">
		{#each tabs as tab, i}
			<button
				class="sidebar-tab"
				class:active={activeIndex === i}
				onclick={() => onTabClick(i)}
				role="tab"
				aria-selected={activeIndex === i}
				aria-label={$_(tab.labelKey)}
			>
				<tab.icon size={20} strokeWidth={1.5} aria-hidden="true" />
				<span>{$_(tab.labelKey)}</span>
			</button>
		{/each}
	</nav>

	<div class="sidebar-spacer"></div>

	<button class="sidebar-tab sidebar-menu-btn" onclick={onMenuToggle} aria-label={$_('nav.openMenuAriaLabel')}>
		<Menu size={20} strokeWidth={1.5} aria-hidden="true" />
		<span>{$_('nav.menu')}</span>
	</button>
</aside>

<style>
	.sidebar {
		position: fixed;
		top: 0;
		left: 0;
		bottom: 0;
		width: var(--sidebar-width, 220px);
		background: var(--bg-secondary);
		border-right: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		padding: var(--space-4) var(--space-3);
		z-index: 40;
	}

	.sidebar-brand {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		margin-bottom: var(--space-5);
		background: none;
		border: none;
		cursor: pointer;
		border-radius: var(--radius-sm);
		-webkit-tap-highlight-color: transparent;
		text-align: left;
	}

	.sidebar-brand:hover {
		background: var(--bg-card-hover);
	}

	.sidebar-title {
		font-size: var(--text-base);
		font-weight: 600;
		color: var(--text-primary);
		letter-spacing: -0.01em;
	}

	.sidebar-tabs {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.sidebar-tab {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
		padding: var(--space-3);
		border: none;
		background: none;
		border-radius: var(--radius-md);
		font-size: var(--text-base);
		color: var(--text-secondary);
		cursor: pointer;
		text-align: left;
		transition: background var(--transition-fast), color var(--transition-fast);
	}

	.sidebar-tab:hover {
		background: var(--bg-card-hover);
	}

	.sidebar-tab.active {
		background: var(--accent-muted);
		color: var(--accent);
		font-weight: 500;
	}

	.sidebar-tab.active :global(svg) {
		color: var(--accent);
	}

	.sidebar-tab :global(svg) {
		flex-shrink: 0;
		color: var(--text-muted);
	}

	.sidebar-spacer {
		flex: 1;
	}

	.sidebar-menu-btn {
		margin-top: var(--space-2);
		border-top: 1px solid var(--border);
		padding-top: var(--space-3);
		border-radius: 0 0 var(--radius-md) var(--radius-md);
	}

</style>
