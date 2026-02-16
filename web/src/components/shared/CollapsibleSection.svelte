<script lang="ts">
	import type { Snippet } from 'svelte';
	import { slide } from 'svelte/transition';
	import { ChevronRight, ChevronUp, ChevronDown, Settings } from 'lucide-svelte';
	import { _ } from '../../lib/i18n/index';

	interface Props {
		title: string;
		id: string;
		defaultExpanded?: boolean;
		badge?: string;
		canMoveUp?: boolean;
		canMoveDown?: boolean;
		onMoveUp?: () => void;
		onMoveDown?: () => void;
		showMoveControls?: boolean;
		onSettingsClick?: () => void;
		children: Snippet;
	}
	let {
		title,
		id,
		defaultExpanded = true,
		badge,
		canMoveUp = false,
		canMoveDown = false,
		onMoveUp,
		onMoveDown,
		showMoveControls = false,
		onSettingsClick,
		children,
	} = $props<Props>();

	const storageKey = `ct-collapse-${id}`;
	let expanded = $state(
		typeof localStorage !== 'undefined'
			? (localStorage.getItem(storageKey) ?? (defaultExpanded ? 'true' : 'false')) === 'true'
			: defaultExpanded
	);

	$effect(() => {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(storageKey, String(expanded));
		}
	});

	function toggle() {
		expanded = !expanded;
	}
</script>

<div class="collapsible" class:expanded>
	<button class="collapsible-header" onclick={toggle} aria-expanded={expanded} aria-controls="section-{id}">
		<span class="chevron"><ChevronRight size={14} /></span>
		<span class="collapsible-title">{title}</span>
		{#if badge}
			<span class="collapsible-badge">{badge}</span>
		{/if}
		<span class="header-spacer"></span>
		{#if onSettingsClick}
			<button
				class="settings-btn"
				onclick={(e) => { e.stopPropagation(); onSettingsClick?.(); }}
				aria-label={$_('shared.collapsibleSection.openSettingsAriaLabel')}
			>
				<Settings size={13} />
			</button>
		{/if}
		{#if showMoveControls}
			<button
				class="move-btn"
				disabled={!canMoveUp}
				onclick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
				aria-label={$_('shared.collapsibleSection.moveUpAriaLabel')}
			>
				<ChevronUp size={14} />
			</button>
			<button
				class="move-btn"
				disabled={!canMoveDown}
				onclick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
				aria-label={$_('shared.collapsibleSection.moveDownAriaLabel')}
			>
				<ChevronDown size={14} />
			</button>
		{/if}
	</button>

	{#if expanded}
		<div class="collapsible-body" id="section-{id}" transition:slide={{ duration: 200 }}>
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.collapsible {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-2);
		overflow: hidden;
	}

	.collapsible-header {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-3) var(--space-3);
		border: none;
		background: none;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		text-align: left;
	}

	.collapsible-header:active {
		background: var(--bg-card-hover);
	}

	.chevron {
		display: flex;
		align-items: center;
		color: var(--text-faint);
		flex-shrink: 0;
		transition: transform var(--transition-base);
	}

	.expanded .chevron {
		transform: rotate(90deg);
	}

	.collapsible-title {
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text-secondary);
	}

	.collapsible-badge {
		font-size: var(--text-xs);
		padding: 1px var(--space-2);
		border-radius: var(--radius-sm);
		background: var(--accent-muted);
		color: var(--accent);
		font-weight: 500;
	}

	.header-spacer {
		flex: 1;
	}

	.move-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		background: none;
		cursor: pointer;
		border-radius: var(--radius-sm);
		-webkit-tap-highlight-color: transparent;
		color: var(--text-faint);
	}

	.move-btn:active {
		background: var(--bg-card-hover);
	}

	.move-btn:disabled {
		opacity: 0.2;
		cursor: default;
	}

	.settings-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		background: none;
		cursor: pointer;
		border-radius: var(--radius-sm);
		-webkit-tap-highlight-color: transparent;
		color: var(--text-faint);
		opacity: 0.6;
	}

	.settings-btn:active {
		background: var(--bg-card-hover);
		opacity: 1;
	}

	.collapsible-body {
		padding: 0 var(--space-3) var(--space-3);
	}
</style>
