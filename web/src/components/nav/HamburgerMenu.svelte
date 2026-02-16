<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import { EMPTY_SESSION, DEFAULT_SETTINGS } from '../../lib/labor-logic/types';
	import { clearAllData, exportData, importData, archiveSession } from '../../lib/storage';
	import { THEMES, PALETTES, PALETTE_PREVIEWS, UNIQUE_MODE_LABELS, CARD_STYLE_PALETTES, getStoredTheme, setTheme, getStoredCardStyle, setCardStyle, type ThemePalette, type ThemeMode, type ThemeId, type CardStyle } from '../../lib/themes';
	import SettingsPage from '../settings/SettingsPage.svelte';
	import SessionManager from '../shared/SessionManager.svelte';
	import { Settings, Palette, Archive, Download, Upload, Info, Trash2, Sun, Moon, Blend, ChevronLeft, X, Clock, FlaskConical, RotateCcw, Share2, Bug } from 'lucide-svelte';
	import { SEED_SCENARIOS } from '../../lib/seedData';
	import { dlog, debugEnabled, dlogCount, dlogDump, dlogClear } from '../../lib/debug-log';
	import { isP2PActive, peerCount } from '../../lib/stores/p2p';
	import { APP_VERSION } from '../../lib/version';
	import SharingPanel from '../sharing/SharingPanel.svelte';
	import DevotionalCard from '../timer/DevotionalCard.svelte';
	import LanguageSelector from './LanguageSelector.svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
		onRestartOnboarding?: () => void;
		settingsSection?: string | null;
		sharingRequested?: boolean;
		/** Pre-filled offer code from ?offer= URL parameter (Private mode) */
		initialOfferCode?: string | null;
		/** Pre-filled answer code from ?answer= URL parameter (QR back-and-forth) */
		initialAnswerCode?: string | null;
		/** Pre-filled room code from ?room= URL parameter (Quick mode) */
		initialRoomCode?: string | null;
		/** Pre-filled password from #key= URL hash (Quick mode) */
		initialPassword?: string | null;
		/** True when this tab was opened just to relay an answer code */
		answerRelayMode?: boolean;
		/** Pre-filled snapshot code from #snapshot= URL hash */
		initialSnapshotCode?: string | null;
	}
	let { open, onClose, onRestartOnboarding, settingsSection = null, sharingRequested = false, initialOfferCode = null, initialAnswerCode = null, initialRoomCode = null, initialPassword = null, answerRelayMode = false, initialSnapshotCode = null } = $props<Props>();

	let activeTab: 'menu' | 'settings' | 'about' | 'theme' | 'sessions' | 'devtools' | 'sharing' | 'devotional' = $state('menu');

	// Show "Prayers" on Cathedral/Shire by default, or on any theme if explicitly enabled in settings
	let showDevotional = $derived(currentTheme === 'warm-mid' || currentTheme === 'forest-mid' || $settings.showPrayers);

	// Auto-switch to settings tab when a settings section is requested
	$effect(() => {
		if (settingsSection && open) {
			activeTab = 'settings';
		}
	});

	// Auto-switch to sharing tab when requested
	$effect(() => {
		if (sharingRequested && open) {
			activeTab = 'sharing';
		}
	});
	let seedLoaded = $state('');
	let importError = $state('');
	let showClearConfirm = $state(false);
	let logCopyFeedback = $state('');
	let pendingSeedId: string | null = $state(null);
	let pendingSeedFn: (() => any) | null = $state(null);
	let currentTheme: ThemeId = $state(getStoredTheme());

	function applyTheme(id: ThemeId) {
		dlog('theme', `Theme applied: ${id}`, { previous: currentTheme }, { src: 'HamburgerMenu' });
		setTheme(id);
		currentTheme = id;
		// Sync card style state when switching themes
		const palette = id.split('-')[0] as ThemePalette;
		if (CARD_STYLE_PALETTES.includes(palette)) {
			cardStyle = getStoredCardStyle(palette);
		}
	}

	let currentPalette = $derived(currentTheme.split('-')[0] as ThemePalette);
	let currentMode = $derived(currentTheme.split('-')[1] as ThemeMode);

	// Card style sub-theme for Cathedral + Shire
	let cardStyle: CardStyle = $state(
		CARD_STYLE_PALETTES.includes(getStoredTheme().split('-')[0] as ThemePalette)
			? getStoredCardStyle(getStoredTheme().split('-')[0] as ThemePalette)
			: 'dark'
	);

	function applyCardStyle(style: CardStyle) {
		cardStyle = style;
		setCardStyle(currentPalette, style);
	}

	function handleClose() {
		activeTab = 'menu';
		showClearConfirm = false;
		onClose();
	}

	function handleExport() {
		dlog('data', 'Export initiated', undefined, { src: 'HamburgerMenu' });
		const json = exportData();
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `contractions-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function handleImport() {
		dlog('data', 'Import initiated', undefined, { src: 'HamburgerMenu' });
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;
			try {
				const text = await file.text();
				dlog('data', 'Import file read', { bytes: text.length, filename: file.name }, { src: 'HamburgerMenu' });
				const result = importData(text);
				dlog('data', 'Import complete', {
					contractions: result.session.contractions.length,
					events: result.session.events.length,
					settingsRestored: !!result.settings,
					settingsKeys: result.settings ? Object.keys(result.settings).length : 0,
				}, { src: 'HamburgerMenu' });
				window.location.reload();
			} catch (e) {
				dlog('data', 'Import failed', { error: String(e) }, { level: 'error', src: 'HamburgerMenu' });
				importError = $_('menu.importError');
				setTimeout(() => importError = '', 3000);
			}
		};
		input.click();
	}

	function handleClear() {
		if (!showClearConfirm) { showClearConfirm = true; return; }
		dlog('data', 'Clear all data confirmed', { contractions: $session.contractions.length }, { level: 'warn', src: 'HamburgerMenu' });
		clearAllData();
		session.set({ ...EMPTY_SESSION, layout: [...EMPTY_SESSION.layout] });
		settings.set({ ...DEFAULT_SETTINGS });
		showClearConfirm = false;
		handleClose();
		// Restart onboarding so the user goes through setup again
		onRestartOnboarding?.();
	}

	const hasContractions = $derived($session.contractions.length > 0);

	function handleSeedClick(id: string, fn: () => any) {
		if (hasContractions) {
			pendingSeedId = id;
			pendingSeedFn = fn;
		} else {
			loadSeed(id, fn);
		}
	}

	function loadSeed(id: string, fn: () => any, archiveFirst = false) {
		if (archiveFirst && hasContractions) {
			const count = $session.contractions.length;
			const label = `Before seed "${id}" (${count} contraction${count === 1 ? '' : 's'})`;
			archiveSession($session, label);
			dlog('data', 'Session archived before seed load', { seedId: id, archivedContractions: count }, { src: 'HamburgerMenu' });
		}
		const data = fn();
		session.set(data);
		dlog('data', `Seed loaded: ${id}`, { contractions: data.contractions?.length ?? 0, events: data.events?.length ?? 0 }, { src: 'HamburgerMenu' });
		seedLoaded = id;
		setTimeout(() => seedLoaded = '', 2000);
		pendingSeedId = null;
		pendingSeedFn = null;
	}
</script>

{#if open}
	<!-- Backdrop -->
	<button class="backdrop" onclick={handleClose} aria-label={$_('menu.closeMenuAriaLabel')}></button>

	<!-- Drawer -->
	<div class="drawer" class:drawer-open={open}>
		<!-- Drawer header -->
		<div class="drawer-header">
			{#if activeTab === 'menu'}
				<span class="drawer-title">{$_('menu.drawerTitle')}</span>
			{:else if activeTab === 'sharing'}
				<button class="drawer-back" onclick={() => activeTab = 'menu'} aria-label={$_('menu.backToMenuAriaLabel')}>
					<ChevronLeft size={20} />
				</button>
				<span class="drawer-title">{$_('menu.sharingTitle')}</span>
			{:else if activeTab === 'settings'}
				<button class="drawer-back" onclick={() => activeTab = 'menu'} aria-label={$_('menu.backToMenuAriaLabel')}>
					<ChevronLeft size={20} />
				</button>
				<span class="drawer-title">{$_('menu.settingsTitle')}</span>
			{:else if activeTab === 'theme'}
				<button class="drawer-back" onclick={() => activeTab = 'menu'} aria-label={$_('menu.backToMenuAriaLabel')}>
					<ChevronLeft size={20} />
				</button>
				<span class="drawer-title">{$_('menu.themeTitle')}</span>
			{:else if activeTab === 'sessions'}
				<button class="drawer-back" onclick={() => activeTab = 'menu'} aria-label={$_('menu.backToMenuAriaLabel')}>
					<ChevronLeft size={20} />
				</button>
				<span class="drawer-title">{$_('menu.sessionsTitle')}</span>
			{:else if activeTab === 'devtools'}
				<button class="drawer-back" onclick={() => activeTab = 'menu'} aria-label={$_('menu.backToMenuAriaLabel')}>
					<ChevronLeft size={20} />
				</button>
				<span class="drawer-title">{$_('menu.devToolsTitle')}</span>
			{:else if activeTab === 'devotional'}
				<button class="drawer-back" onclick={() => activeTab = 'menu'} aria-label={$_('menu.backToMenuAriaLabel')}>
					<ChevronLeft size={20} />
				</button>
				<span class="drawer-title">{$_('menu.prayersTitle')}</span>
			{:else}
				<button class="drawer-back" onclick={() => activeTab = 'menu'} aria-label={$_('menu.backToMenuAriaLabel')}>
					<ChevronLeft size={20} />
				</button>
				<span class="drawer-title">{$_('menu.aboutTitle')}</span>
			{/if}
			<LanguageSelector />
			<button class="drawer-close" onclick={handleClose} aria-label={$_('menu.closeAriaLabel')}>
				<X size={20} />
			</button>
		</div>

		<!-- Drawer content -->
		<div class="drawer-content">
			{#if activeTab === 'menu'}
				<div class="menu-items">
					<button class="menu-item" onclick={() => activeTab = 'sharing'}>
						<Share2 size={20} />
						<div class="menu-item-text">
							<span>{$_('menu.items.sharing')}</span>
							{#if $isP2PActive}
								<span class="menu-item-hint">{$_('menu.sharingHintConnected', { values: { count: $peerCount } })}</span>
							{/if}
						</div>
					</button>
					<button class="menu-item" onclick={() => activeTab = 'settings'}>
						<Settings size={20} />
						<span>{$_('menu.items.settings')}</span>
					</button>
					<button class="menu-item" onclick={() => activeTab = 'theme'}>
						<Palette size={20} />
						<span>{$_('menu.items.theme')}</span>
					</button>
					<button class="menu-item" onclick={() => activeTab = 'sessions'}>
						<Archive size={20} />
						<span>{$_('menu.items.sessions')}</span>
					</button>
					<button class="menu-item" onclick={handleExport}>
						<Download size={20} />
						<span>{$_('menu.items.exportData')}</span>
					</button>
					<button class="menu-item" onclick={handleImport}>
						<Upload size={20} />
						<span>{$_('menu.items.importData')}</span>
					</button>
					{#if importError}
						<div class="import-error">{importError}</div>
					{/if}

					<div class="menu-divider"></div>

					{#if onRestartOnboarding}
						<button class="menu-item" onclick={() => { handleClose(); onRestartOnboarding(); }}>
							<RotateCcw size={20} />
							<div class="menu-item-text">
								<span>{$_('menu.items.restartSetup')}</span>
								<span class="menu-item-hint">{$_('menu.items.restartSetupHint')}</span>
							</div>
						</button>
					{/if}
					<button class="menu-item" onclick={() => activeTab = 'about'}>
						<Info size={20} />
						<span>{$_('menu.items.about')}</span>
					</button>
					<a href="https://github.com/cybersader/obsidian-contractions-timer/issues/new/choose" target="_blank" rel="noopener" class="menu-item menu-item--link">
						<Bug size={20} />
						<span>{$_('menu.items.feedbackAndIssues')}</span>
					</a>
					{#if showDevotional}
						<button class="menu-item menu-item--devotional" onclick={() => activeTab = 'devotional'}>
							<span class="devotional-menu-icon">&#128591;</span>
							<span>{$_('menu.items.prayers')}</span>
						</button>
					{/if}
					<button class="menu-item" onclick={() => activeTab = 'devtools'}>
						<FlaskConical size={20} />
						<span>{$_('menu.items.devTools')}</span>
					</button>

					<div class="menu-divider"></div>

					<!-- Danger zone -->
					{#if showClearConfirm}
						<div class="clear-confirm">
							<p class="clear-text">{$_('menu.clearConfirm.prompt')}</p>
							<div class="clear-buttons">
								<button class="btn-danger" onclick={handleClear}>{$_('menu.clearConfirm.confirmButton')}</button>
								<button class="btn-cancel" onclick={() => showClearConfirm = false}>{$_('menu.clearConfirm.cancelButton')}</button>
							</div>
						</div>
					{:else}
						<button class="menu-item menu-item--danger" onclick={handleClear}>
							<Trash2 size={20} />
							<span>{$_('menu.items.clearAllData')}</span>
						</button>
					{/if}
				</div>

			{:else if activeTab === 'sharing'}
				<SharingPanel {initialOfferCode} {initialAnswerCode} {initialRoomCode} {initialPassword} {initialSnapshotCode} />

			{:else if activeTab === 'sessions'}
				<SessionManager />

			{:else if activeTab === 'settings'}
				<SettingsPage scrollToSection={settingsSection} />

			{:else if activeTab === 'theme'}
				<div class="theme-picker">
					<!-- Mode toggle -->
					<div class="mode-toggle">
						<button
							class="mode-btn"
							class:mode-active={currentMode === 'light'}
							onclick={() => applyTheme(`${currentPalette}-light`)}
						>
							<Sun size={16} />
							{$_('menu.theme.lightMode')}
						</button>
						<button
							class="mode-btn"
							class:mode-active={currentMode === 'dark'}
							onclick={() => applyTheme(`${currentPalette}-dark`)}
						>
							<Moon size={16} />
							{$_('menu.theme.darkMode')}
						</button>
						<button
							class="mode-btn"
							class:mode-active={currentMode === 'mid'}
							onclick={() => applyTheme(`${currentPalette}-mid`)}
						>
							<Blend size={16} />
							{$_('menu.theme.uniqueMode')}
						</button>
					</div>

					<!-- Palette selection -->
					<div class="palette-label">{$_('menu.theme.colorPaletteLabel')}</div>
					<div class="palette-grid">
						{#each PALETTES as palette}
							{@const preview = PALETTE_PREVIEWS[palette]}
							{@const hasCardStyles = currentMode === 'mid' && CARD_STYLE_PALETTES.includes(palette)}
							{@const isExpanded = hasCardStyles && currentPalette === palette}
							<div class="palette-cell" class:palette-cell-expanded={isExpanded}>
								<button
									class="palette-card"
									class:palette-active={currentPalette === palette}
									onclick={() => applyTheme(`${palette}-${currentMode}`)}
								>
									<div class="palette-swatches">
										<div class="swatch" style="background: {currentMode === 'dark' ? preview.bg : currentMode === 'mid' ? preview.bgMid : preview.bgLight}"></div>
										<div class="swatch" style="background: {currentMode === 'mid' && preview.primaryMid ? preview.primaryMid : preview.primary}"></div>
										<div class="swatch" style="background: {currentMode === 'mid' && preview.accentMid ? preview.accentMid : preview.accent}"></div>
									</div>
									<span class="palette-name">{currentMode === 'mid' ? UNIQUE_MODE_LABELS[palette] : palette[0].toUpperCase() + palette.slice(1)}</span>
								</button>
								{#if hasCardStyles}
									<div class="subtheme-tray" class:subtheme-open={isExpanded}>
										<button
											class="subtheme-chip"
											class:subtheme-active={cardStyle === 'dark'}
											onclick={() => applyCardStyle('dark')}
										>
											<div class="subtheme-dot" style="background: {palette === 'warm' ? 'rgba(30, 20, 10, 0.9)' : 'rgba(14, 26, 14, 0.9)'};"></div>
											<span>{$_('menu.theme.darkCardStyle')}</span>
										</button>
										<button
											class="subtheme-chip"
											class:subtheme-active={cardStyle === 'light'}
											onclick={() => applyCardStyle('light')}
										>
											<div class="subtheme-dot" style="background: {palette === 'warm' ? 'rgba(252, 246, 228, 0.95)' : 'rgba(245, 240, 225, 0.95)'};"></div>
											<span>{$_('menu.theme.lightCardStyle')}</span>
										</button>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>

			{:else if activeTab === 'devtools'}
				<div class="devtools-panel">
					<div class="devtools-section">
						<div class="devtools-label">{$_('menu.devtools.loadSeedData')}</div>
						<p class="devtools-hint">{$_('menu.devtools.seedHint')}</p>
						<div class="devtools-grid">
							{#each SEED_SCENARIOS as scenario}
								<button
									class="devtools-seed-btn"
									class:devtools-seed-active={seedLoaded === scenario.id}
									onclick={() => handleSeedClick(scenario.id, scenario.fn)}
								>
									<span class="devtools-seed-label">{$_(`menu.devtools.seeds.${scenario.id}Label`)}</span>
									<span class="devtools-seed-desc">{$_(`menu.devtools.seeds.${scenario.id}Desc`)}</span>
								</button>
							{/each}
						</div>
					</div>

					{#if pendingSeedId && pendingSeedFn}
						<div class="devtools-archive-prompt">
							<p class="devtools-archive-text">{$_('menu.devtools.archivePrompt', { values: { count: $session.contractions.length } })}</p>
							<button class="btn-archive" onclick={() => loadSeed(pendingSeedId!, pendingSeedFn!, true)}>
								<Archive size={16} />
								{$_('menu.devtools.archiveCurrentAndLoad')}
							</button>
							<button class="btn-replace" onclick={() => loadSeed(pendingSeedId!, pendingSeedFn!, false)}>
								{$_('menu.devtools.replaceCurrentSession')}
							</button>
							<button class="btn-cancel-seed" onclick={() => { pendingSeedId = null; pendingSeedFn = null; }}>
								{$_('common.cancel')}
							</button>
						</div>
					{/if}

					<div class="devtools-section">
						<div class="devtools-label">{$_('menu.devtools.quickActions')}</div>
						<button
							class="devtools-seed-btn"
							onclick={() => {
								session.set({ ...EMPTY_SESSION, layout: [...EMPTY_SESSION.layout] });
								seedLoaded = 'cleared';
								setTimeout(() => seedLoaded = '', 2000);
							}}
						>
							<span class="devtools-seed-label">{$_('menu.devtools.clearSession')}</span>
							<span class="devtools-seed-desc">{$_('menu.devtools.clearSessionDesc')}</span>
						</button>
					</div>
					{#if seedLoaded}
						<div class="devtools-toast">{$_('menu.devtools.loadedToast')}</div>
					{/if}

					<div class="devtools-section">
						<div class="devtools-label">{$_('menu.devtools.debugLogging')}</div>
						<p class="devtools-hint">{$_('menu.devtools.debugLoggingHint')}</p>
						<label class="devtools-toggle-row">
							<span class="devtools-toggle-label">{$_('menu.devtools.enableLogging')}</span>
							<input type="checkbox" class="devtools-toggle" checked={$debugEnabled} onchange={(e) => debugEnabled.set(e.currentTarget.checked)} />
						</label>
						{#if $debugEnabled}
							<div class="devtools-log-actions">
								<button
									class="devtools-seed-btn"
									onclick={async () => {
										const dump = dlogDump();
										try {
											await navigator.clipboard.writeText(dump);
											logCopyFeedback = $_('menu.devtools.copiedFeedback');
										} catch {
											logCopyFeedback = $_('menu.devtools.copyFailedFeedback');
										}
										setTimeout(() => logCopyFeedback = '', 2000);
									}}
								>
									<span class="devtools-seed-label">{$_('menu.devtools.copyLog', { values: { count: dlogCount() } })}</span>
									<span class="devtools-seed-desc">{$_('menu.devtools.copyLogDesc')}</span>
								</button>
								<button
									class="devtools-seed-btn"
									onclick={() => { dlogClear(); logCopyFeedback = $_('menu.devtools.clearedFeedback'); setTimeout(() => logCopyFeedback = '', 2000); }}
								>
									<span class="devtools-seed-label">{$_('menu.devtools.clearLog')}</span>
									<span class="devtools-seed-desc">{$_('menu.devtools.clearLogDesc')}</span>
								</button>
							</div>
							{#if logCopyFeedback}
								<div class="devtools-toast">{logCopyFeedback}</div>
							{/if}
						{/if}
					</div>
				</div>

			{:else if activeTab === 'devotional'}
				<DevotionalCard />

			{:else}
				<!-- About page -->
				<div class="about-page">
					<div class="about-app-icon">
						<Clock size={28} />
					</div>
					<h3 class="about-name">{$_('menu.about.appName')}</h3>
					<p class="about-version">v{APP_VERSION}</p>
					<p class="about-desc">{$_('menu.about.description')}</p>
					<div class="about-features">
						<div class="about-feature">{$_('menu.about.features.liveTimer')}</div>
						<div class="about-feature">{$_('menu.about.features.rule511')}</div>
						<div class="about-feature">{$_('menu.about.features.braxtonHicks')}</div>
						<div class="about-feature">{$_('menu.about.features.hospitalAdvisor')}</div>
						<div class="about-feature">{$_('menu.about.features.clinicalReference')}</div>
					</div>
					<div class="about-privacy">
						<p>{$_('menu.about.privacyNotice')}</p>
					</div>
					<div class="about-links">
						<a href="https://github.com/cybersader/obsidian-contractions-timer" target="_blank" rel="noopener" class="about-link">
							{$_('menu.about.githubLink')}
						</a>
						<a href="https://github.com/cybersader/obsidian-contractions-timer/issues/new/choose" target="_blank" rel="noopener" class="about-link">
							{$_('menu.about.feedbackLink')}
						</a>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: var(--bg-overlay, rgba(0, 0, 0, 0.5));
		z-index: 70;
		border: none;
		cursor: default;
	}

	.drawer {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: min(320px, 85vw);
		background: var(--bg-primary);
		z-index: 80;
		display: flex;
		flex-direction: column;
		animation: slideIn var(--transition-base);
	}

	@keyframes slideIn {
		from { transform: translateX(100%); }
		to { transform: translateX(0); }
	}

	.drawer-header {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
		padding-top: calc(var(--space-3) + env(safe-area-inset-top, 0px));
		border-bottom: 1px solid var(--border);
		min-height: var(--space-7);
	}

	.drawer-title {
		flex: 1;
		font-size: var(--text-base);
		font-weight: 600;
		color: var(--text-primary);
	}

	.drawer-back, .drawer-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--btn-height-sm);
		height: var(--btn-height-sm);
		border: none;
		background: none;
		cursor: pointer;
		border-radius: var(--radius-sm);
		-webkit-tap-highlight-color: transparent;
		color: var(--text-muted);
	}

	.drawer-back:active, .drawer-close:active {
		background: var(--bg-card-hover);
	}

	.drawer-close {
		margin-left: auto;
	}

	.drawer-content {
		flex: 1;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding-bottom: env(safe-area-inset-bottom, var(--space-4));
	}

	/* Menu items */
	.menu-items {
		padding: var(--space-2);
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
		padding: var(--space-3);
		border: none;
		background: none;
		cursor: pointer;
		border-radius: var(--radius-md);
		font-size: var(--text-base);
		color: var(--text-secondary);
		text-align: left;
		-webkit-tap-highlight-color: transparent;
	}

	.menu-item:active {
		background: var(--bg-card-hover);
	}

	.menu-item :global(svg) {
		flex-shrink: 0;
		color: var(--text-muted);
	}

	.menu-item-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.menu-item-hint {
		font-size: var(--text-xs);
		color: var(--text-muted);
		font-weight: 400;
	}

	.menu-item--devotional {
		color: var(--accent);
	}

	.devotional-menu-icon {
		font-size: 20px;
		line-height: 1;
		flex-shrink: 0;
	}

	.menu-item--danger {
		color: var(--danger);
	}

	.menu-item--danger :global(svg) {
		color: var(--danger);
	}

	.menu-item--link {
		text-decoration: none;
		color: var(--text-secondary);
	}

	.menu-divider {
		height: 1px;
		background: var(--border);
		margin: var(--space-1) var(--space-3);
	}

	.import-error {
		padding: var(--space-1) var(--space-3);
		font-size: var(--text-sm);
		color: var(--danger);
	}

	/* Clear confirm */
	.clear-confirm {
		padding: var(--space-3);
	}

	.clear-text {
		color: var(--danger);
		font-size: var(--text-base);
		margin-bottom: var(--space-2);
	}

	.clear-buttons {
		display: flex;
		gap: var(--space-2);
	}

	.btn-danger {
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius-sm);
		border: none;
		background: var(--danger-muted);
		color: var(--danger);
		font-size: var(--text-base);
		font-weight: 600;
		cursor: pointer;
	}

	.btn-cancel {
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		background: transparent;
		color: var(--text-muted);
		font-size: var(--text-base);
		cursor: pointer;
	}

	/* About page */
	.about-page {
		padding: var(--space-5) var(--space-4);
		text-align: center;
	}

	.about-app-icon {
		margin: 0 auto var(--space-3);
		width: var(--space-7);
		height: var(--space-7);
		border-radius: var(--radius-lg);
		background: var(--accent-muted);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--accent);
	}

	.about-name {
		font-size: var(--text-lg);
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: var(--space-1);
	}

	.about-version {
		font-size: var(--text-sm);
		color: var(--text-faint);
		margin-bottom: var(--space-3);
	}

	.about-desc {
		font-size: var(--text-base);
		color: var(--text-muted);
		line-height: 1.5;
		margin-bottom: var(--space-4);
	}

	.about-features {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin-bottom: var(--space-4);
	}

	.about-feature {
		font-size: var(--text-sm);
		color: var(--text-faint);
	}

	.about-privacy {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: var(--space-3);
		margin-bottom: var(--space-4);
	}

	.about-privacy p {
		font-size: var(--text-sm);
		color: var(--text-muted);
		line-height: 1.4;
	}

	.about-links {
		display: flex;
		justify-content: center;
		gap: var(--space-4);
	}

	.about-link {
		font-size: var(--text-sm);
		color: var(--accent);
		text-decoration: none;
	}

	/* Theme picker */
	.theme-picker {
		padding: var(--space-4);
	}

	.mode-toggle {
		display: flex;
		gap: var(--space-2);
		margin-bottom: var(--space-5);
	}

	.mode-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-3);
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		background: var(--bg-card);
		color: var(--text-muted);
		font-size: var(--text-base);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.mode-btn.mode-active {
		border-color: var(--accent);
		background: var(--accent-muted);
		color: var(--accent);
	}

	.palette-label {
		font-size: var(--text-sm);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary);
		margin-bottom: var(--space-3);
	}

	.palette-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-2);
	}

	.palette-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-2);
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		background: var(--bg-card);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.palette-card:active {
		background: var(--bg-card-hover);
	}

	.palette-card.palette-active {
		border-color: var(--accent);
		background: var(--accent-muted);
	}

	.palette-swatches {
		display: flex;
		gap: var(--space-1);
	}

	.swatch {
		width: var(--space-5);
		height: var(--space-5);
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-muted);
	}

	.palette-name {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		font-weight: 500;
	}

	.palette-active .palette-name {
		color: var(--accent);
	}

	/* Palette cell: wrapper for card + sliding sub-theme tray */
	.palette-cell {
		position: relative;
		display: flex;
		flex-direction: column;
	}

	/* Sub-theme tray: slides down from behind the palette card */
	.subtheme-tray {
		display: flex;
		gap: var(--space-1);
		padding: 0 var(--space-1);
		max-height: 0;
		opacity: 0;
		overflow: hidden;
		transform: translateY(-4px);
		transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
					opacity 0.25s ease,
					transform 0.25s ease,
					padding 0.3s ease,
					margin 0.3s ease;
		margin-top: 0;
	}

	.subtheme-tray.subtheme-open {
		max-height: 40px;
		opacity: 1;
		transform: translateY(0);
		padding: var(--space-1);
		margin-top: var(--space-1);
	}

	.subtheme-chip {
		display: flex;
		align-items: center;
		gap: 5px;
		flex: 1;
		padding: 4px 8px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-muted);
		background: transparent;
		font-size: 11px;
		color: var(--text-muted);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
		white-space: nowrap;
	}

	.subtheme-chip.subtheme-active {
		border-color: var(--accent);
		background: var(--accent-muted);
		color: var(--accent);
	}

	.subtheme-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		border: 1px solid var(--border-muted);
		flex-shrink: 0;
	}

	/* Dev tools */
	.devtools-panel {
		padding: var(--space-4);
	}

	.devtools-section {
		margin-bottom: var(--space-5);
	}

	.devtools-label {
		font-size: var(--text-sm);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary);
		margin-bottom: var(--space-2);
	}

	.devtools-hint {
		font-size: var(--text-sm);
		color: var(--text-muted);
		margin-bottom: var(--space-3);
		line-height: 1.4;
	}

	.devtools-grid {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.devtools-seed-btn {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding: var(--space-3);
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		background: var(--bg-card);
		cursor: pointer;
		text-align: left;
		-webkit-tap-highlight-color: transparent;
		transition: border-color var(--transition-fast);
	}

	.devtools-seed-btn:active {
		background: var(--bg-card-hover);
	}

	.devtools-seed-btn.devtools-seed-active {
		border-color: var(--success, var(--accent));
		background: var(--accent-muted);
	}

	.devtools-seed-label {
		font-size: var(--text-base);
		font-weight: 600;
		color: var(--text-primary);
	}

	.devtools-seed-desc {
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.devtools-archive-prompt {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3);
		border: 1px solid var(--accent, var(--border));
		border-radius: var(--radius-md);
		background: var(--accent-muted, var(--bg-card));
		margin-bottom: var(--space-3);
		animation: fadeIn 200ms ease-out;
	}

	.devtools-archive-text {
		font-size: var(--text-sm);
		color: var(--text-primary);
		margin: 0;
		line-height: 1.4;
	}

	.btn-archive {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border: none;
		border-radius: var(--radius-md);
		background: var(--accent);
		color: var(--bg-primary);
		font-size: var(--text-sm);
		font-weight: 600;
		cursor: pointer;
		min-height: 44px;
		-webkit-tap-highlight-color: transparent;
	}

	.btn-archive:active {
		filter: brightness(0.9);
	}

	.btn-replace {
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--bg-primary);
		color: var(--text-primary);
		font-size: var(--text-sm);
		font-weight: 500;
		cursor: pointer;
		min-height: 44px;
		-webkit-tap-highlight-color: transparent;
	}

	.btn-replace:active {
		background: var(--bg-card-hover);
	}

	.btn-cancel-seed {
		padding: var(--space-2);
		border: none;
		background: none;
		color: var(--text-muted);
		font-size: var(--text-sm);
		cursor: pointer;
		text-align: center;
		min-height: 44px;
		-webkit-tap-highlight-color: transparent;
	}

	.btn-cancel-seed:active {
		color: var(--text-primary);
	}

	.devtools-toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--bg-card);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		margin-bottom: var(--space-2);
	}

	.devtools-toggle-label {
		font-size: var(--text-base);
		font-weight: 600;
		color: var(--text-primary);
	}

	.devtools-toggle {
		width: 44px;
		height: 24px;
		accent-color: var(--accent);
		cursor: pointer;
	}

	.devtools-log-actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.devtools-toast {
		text-align: center;
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--success, var(--accent));
		padding: var(--space-2);
		animation: fadeIn 200ms ease-out;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(4px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
