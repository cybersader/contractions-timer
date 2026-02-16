<script lang="ts">
	import { _ } from '../../lib/i18n/index';
	import { Clock, Menu, Share2 } from 'lucide-svelte';
	import { isP2PActive, peerState } from '../../lib/stores/p2p';
	import { APP_VERSION } from '../../lib/version';
	import LanguageSelector from './LanguageSelector.svelte';

	interface Props {
		onMenuToggle: () => void;
		onHomeClick: () => void;
		onShareClick: () => void;
	}
	let { onMenuToggle, onHomeClick, onShareClick } = $props<Props>();

	const p2pActive = $derived($isP2PActive);
	const p2pStatus = $derived($peerState.status);
</script>

<header class="header-bar">
	<button class="header-brand" onclick={onHomeClick} aria-label={$_('nav.goToTimerAriaLabel')}>
		<Clock size={20} strokeWidth={1.5} color="var(--accent)" aria-hidden="true" />
		<span class="header-title">{$_('nav.brandTitle')}</span>
		<span class="header-version">v{APP_VERSION}</span>
	</button>
	<div class="header-actions">
		<div class="header-lang-desktop">
			<LanguageSelector />
		</div>
		<button class="header-icon-btn" onclick={onShareClick} aria-label={$_('nav.shareSessionAriaLabel')}>
			<Share2 size={20} strokeWidth={2} color={p2pActive ? 'var(--accent)' : 'var(--text-muted)'} />
			{#if p2pActive}
				<span class="share-dot" class:share-dot--connecting={p2pStatus === 'connecting'}></span>
			{/if}
		</button>
		<button class="header-icon-btn" onclick={onMenuToggle} aria-label={$_('nav.menuAriaLabel')}>
			<Menu size={22} strokeWidth={2} color="var(--text-muted)" />
		</button>
	</div>
</header>

<style>
	.header-bar {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: calc(var(--header-height) + env(safe-area-inset-top, 0px));
		padding-top: env(safe-area-inset-top, 0px);
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-left: var(--space-4);
		padding-right: var(--space-3);
		background: var(--header-bg);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-bottom: 1px solid var(--border);
		z-index: 60;
	}

	.header-brand {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		background: none;
		border: none;
		cursor: pointer;
		padding: var(--space-1) var(--space-2);
		margin: calc(-1 * var(--space-1)) calc(-1 * var(--space-2));
		border-radius: var(--radius-sm);
		-webkit-tap-highlight-color: transparent;
	}

	.header-brand:active {
		background: var(--bg-card-hover);
	}

	.header-title {
		font-size: var(--text-base);
		font-weight: 600;
		color: var(--text-primary);
		letter-spacing: -0.01em;
	}

	.header-version {
		font-size: 10px;
		font-weight: 500;
		color: var(--text-faint);
		opacity: 0.5;
		letter-spacing: 0.02em;
		margin-left: 2px;
		align-self: flex-end;
		margin-bottom: 1px;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.header-lang-desktop {
		display: none;
	}

	@media (min-width: 640px) {
		.header-lang-desktop {
			display: flex;
			align-items: center;
			margin-right: var(--space-1);
		}
	}

	.header-icon-btn {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--btn-height-md);
		height: var(--btn-height-md);
		border: none;
		background: none;
		cursor: pointer;
		border-radius: var(--radius-sm);
		-webkit-tap-highlight-color: transparent;
	}

	.header-icon-btn:active {
		background: var(--bg-card-hover);
	}

	.share-dot {
		position: absolute;
		top: 8px;
		right: 8px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--success, var(--accent));
		border: 1.5px solid var(--header-bg);
	}

	.share-dot--connecting {
		background: var(--warning, #f59e0b);
		animation: pulse 1.5s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}
</style>
