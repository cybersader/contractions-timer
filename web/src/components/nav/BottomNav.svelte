<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { Clock, BarChart3, List, Stethoscope } from 'lucide-svelte';

	interface Props {
		activeIndex: number;
		onTabClick: (index: number) => void;
	}
	let { activeIndex, onTabClick } = $props<Props>();

	const tabs = [
		{ labelKey: 'nav.timer', icon: Clock },
		{ labelKey: 'nav.dashboard', icon: BarChart3 },
		{ labelKey: 'nav.history', icon: List },
		{ labelKey: 'nav.advisor', icon: Stethoscope },
	];
</script>

<nav class="bottom-nav" role="tablist" aria-label={$_('nav.mainNavAriaLabel')}>
	{#each tabs as tab, i}
		<button
			class="nav-tab"
			class:active={activeIndex === i}
			onclick={() => onTabClick(i)}
			role="tab"
			aria-selected={activeIndex === i}
			aria-label={$_(tab.labelKey)}
		>
			<tab.icon size={20} strokeWidth={1.5} aria-hidden="true" />
			<span class="nav-label">{$_(tab.labelKey)}</span>
		</button>
	{/each}
</nav>

<style>
	.nav-label {
		font-size: var(--text-xs);
	}
</style>
