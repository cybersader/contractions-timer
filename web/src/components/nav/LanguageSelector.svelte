<script lang="ts">
	import { settings } from '../../lib/stores/settings';
	import { _, locale, SUPPORTED_LANGUAGES } from '../../lib/i18n/index';
	import type { SupportedLanguage } from '../../lib/labor-logic/types';
	import { Globe } from 'lucide-svelte';

	let open = $state(false);
	let current = $derived(SUPPORTED_LANGUAGES.find(l => l.code === $settings.language) ?? SUPPORTED_LANGUAGES[0]);

	function selectLanguage(code: SupportedLanguage) {
		settings.update(s => ({ ...s, language: code }));
		locale.set(code);
		open = false;
	}

	function handleToggle(e: MouseEvent) {
		e.stopPropagation();
		open = !open;
	}

	function handleBackdrop() {
		open = false;
	}
</script>

<div class="lang-selector">
	<button class="lang-toggle" onclick={handleToggle} aria-label={$_('menu.languageSelector.changeLanguageAriaLabel')}>
		<Globe size={15} />
		<span class="lang-code">{current.code.toUpperCase()}</span>
	</button>

	{#if open}
		<button class="lang-backdrop" onclick={handleBackdrop} aria-label={$_('menu.languageSelector.closeMenuAriaLabel')}></button>
		<div class="lang-dropdown">
			{#each SUPPORTED_LANGUAGES as lang}
				<button
					class="lang-option"
					class:active={lang.code === $settings.language}
					onclick={() => selectLanguage(lang.code)}
				>
					<span class="lang-option-native">{lang.nativeName}</span>
					<span class="lang-option-code">{lang.code.toUpperCase()}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.lang-selector {
		position: relative;
	}

	.lang-toggle {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 8px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-muted);
		font-size: var(--text-xs);
		font-weight: 600;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		transition: color var(--transition-base), border-color var(--transition-base);
	}

	.lang-toggle:active {
		color: var(--text-primary);
		border-color: var(--accent);
	}

	.lang-code {
		letter-spacing: 0.05em;
	}

	.lang-backdrop {
		position: fixed;
		inset: 0;
		background: transparent;
		border: none;
		z-index: 90;
		cursor: default;
	}

	.lang-dropdown {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 4px;
		min-width: 160px;
		background: var(--bg-elevated, var(--bg-primary));
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
		z-index: 91;
		overflow: hidden;
		animation: dropIn 150ms ease-out;
	}

	@keyframes dropIn {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.lang-option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 10px 14px;
		border: none;
		background: transparent;
		color: var(--text-secondary);
		font-size: var(--text-sm);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		transition: background var(--transition-base);
		text-align: left;
	}

	.lang-option:active {
		background: var(--accent-muted);
	}

	@media (hover: hover) {
		.lang-option:hover {
			background: var(--bg-card-hover, var(--accent-muted));
		}
	}

	.lang-option.active {
		color: var(--accent);
		font-weight: 600;
	}

	.lang-option-native {
		flex: 1;
	}

	.lang-option-code {
		font-size: var(--text-xs);
		color: var(--text-faint);
		font-weight: 500;
		letter-spacing: 0.05em;
	}

	.lang-option.active .lang-option-code {
		color: var(--accent);
	}
</style>
