<script lang="ts">
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import { EMPTY_SESSION, DEFAULT_SETTINGS } from '../../lib/labor-logic/types';
	import { clearAllData, exportData, importData } from '../../lib/storage';
	import { THEMES, PALETTES, PALETTE_PREVIEWS, getStoredTheme, setTheme, type ThemePalette, type ThemeMode, type ThemeId } from '../../lib/themes';
	import SettingsPage from '../settings/SettingsPage.svelte';
	import SessionManager from '../shared/SessionManager.svelte';
	import { Settings, Palette, Archive, Download, Upload, Info, Trash2, Sun, Moon, Blend, ChevronLeft, X, Clock, FlaskConical, RotateCcw, Share2 } from 'lucide-svelte';
	import { SEED_SCENARIOS } from '../../lib/seedData';
	import { isP2PActive, peerCount } from '../../lib/stores/p2p';
	import SharingPanel from '../sharing/SharingPanel.svelte';

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

	let activeTab: 'menu' | 'settings' | 'about' | 'theme' | 'sessions' | 'devtools' | 'sharing' = $state('menu');

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
	let currentTheme: ThemeId = $state(getStoredTheme());

	function applyTheme(id: ThemeId) {
		setTheme(id);
		currentTheme = id;
	}

	let currentPalette = $derived(currentTheme.split('-')[0] as ThemePalette);
	let currentMode = $derived(currentTheme.split('-')[1] as ThemeMode);

	function handleClose() {
		activeTab = 'menu';
		showClearConfirm = false;
		onClose();
	}

	function handleExport() {
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
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;
			try {
				const text = await file.text();
				importData(text);
				window.location.reload();
			} catch {
				importError = 'Invalid file format';
				setTimeout(() => importError = '', 3000);
			}
		};
		input.click();
	}

	function handleClear() {
		if (!showClearConfirm) { showClearConfirm = true; return; }
		clearAllData();
		session.set({ ...EMPTY_SESSION, layout: [...EMPTY_SESSION.layout] });
		settings.set({ ...DEFAULT_SETTINGS });
		showClearConfirm = false;
		handleClose();
	}
</script>

{#if open}
	<!-- Backdrop -->
	<button class="backdrop" onclick={handleClose} aria-label="Close menu"></button>

	<!-- Drawer -->
	<div class="drawer" class:drawer-open={open}>
		<!-- Drawer header -->
		<div class="drawer-header">
			{#if activeTab === 'menu'}
				<span class="drawer-title">Menu</span>
			{:else if activeTab === 'sharing'}
				<button class="drawer-back" onclick={() => activeTab = 'menu'} aria-label="Back to menu">
					<ChevronLeft size={20} />
				</button>
				<span class="drawer-title">Share session</span>
			{:else if activeTab === 'settings'}
				<button class="drawer-back" onclick={() => activeTab = 'menu'} aria-label="Back to menu">
					<ChevronLeft size={20} />
				</button>
				<span class="drawer-title">Settings</span>
			{:else if activeTab === 'theme'}
				<button class="drawer-back" onclick={() => activeTab = 'menu'} aria-label="Back to menu">
					<ChevronLeft size={20} />
				</button>
				<span class="drawer-title">Theme</span>
			{:else if activeTab === 'sessions'}
				<button class="drawer-back" onclick={() => activeTab = 'menu'} aria-label="Back to menu">
					<ChevronLeft size={20} />
				</button>
				<span class="drawer-title">Sessions</span>
			{:else if activeTab === 'devtools'}
				<button class="drawer-back" onclick={() => activeTab = 'menu'} aria-label="Back to menu">
					<ChevronLeft size={20} />
				</button>
				<span class="drawer-title">Dev tools</span>
			{:else}
				<button class="drawer-back" onclick={() => activeTab = 'menu'} aria-label="Back to menu">
					<ChevronLeft size={20} />
				</button>
				<span class="drawer-title">About</span>
			{/if}
			<button class="drawer-close" onclick={handleClose} aria-label="Close">
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
							<span>Share session</span>
							{#if $isP2PActive}
								<span class="menu-item-hint">Connected ({$peerCount} peers)</span>
							{/if}
						</div>
					</button>
					<button class="menu-item" onclick={() => activeTab = 'settings'}>
						<Settings size={20} />
						<span>Settings</span>
					</button>
					<button class="menu-item" onclick={() => activeTab = 'theme'}>
						<Palette size={20} />
						<span>Theme</span>
					</button>
					<button class="menu-item" onclick={() => activeTab = 'sessions'}>
						<Archive size={20} />
						<span>Sessions</span>
					</button>
					<button class="menu-item" onclick={handleExport}>
						<Download size={20} />
						<span>Export data (JSON)</span>
					</button>
					<button class="menu-item" onclick={handleImport}>
						<Upload size={20} />
						<span>Import data</span>
					</button>
					{#if importError}
						<div class="import-error">{importError}</div>
					{/if}

					<div class="menu-divider"></div>

					{#if onRestartOnboarding}
						<button class="menu-item" onclick={() => { handleClose(); onRestartOnboarding(); }}>
							<RotateCcw size={20} />
							<div class="menu-item-text">
								<span>Restart setup</span>
								<span class="menu-item-hint">Re-run the welcome wizard (data is kept)</span>
							</div>
						</button>
					{/if}
					<button class="menu-item" onclick={() => activeTab = 'about'}>
						<Info size={20} />
						<span>About</span>
					</button>
					<button class="menu-item" onclick={() => activeTab = 'devtools'}>
						<FlaskConical size={20} />
						<span>Dev tools</span>
					</button>

					<div class="menu-divider"></div>

					<!-- Danger zone -->
					{#if showClearConfirm}
						<div class="clear-confirm">
							<p class="clear-text">Delete all contraction data?</p>
							<div class="clear-buttons">
								<button class="btn-danger" onclick={handleClear}>Yes, clear everything</button>
								<button class="btn-cancel" onclick={() => showClearConfirm = false}>Cancel</button>
							</div>
						</div>
					{:else}
						<button class="menu-item menu-item--danger" onclick={handleClear}>
							<Trash2 size={20} />
							<span>Clear all data</span>
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
							Light
						</button>
						<button
							class="mode-btn"
							class:mode-active={currentMode === 'mid'}
							onclick={() => applyTheme(`${currentPalette}-mid`)}
						>
							<Blend size={16} />
							Pastel
						</button>
						<button
							class="mode-btn"
							class:mode-active={currentMode === 'dark'}
							onclick={() => applyTheme(`${currentPalette}-dark`)}
						>
							<Moon size={16} />
							Dark
						</button>
					</div>

					<!-- Palette selection -->
					<div class="palette-label">Color palette</div>
					<div class="palette-grid">
						{#each PALETTES as palette}
							{@const preview = PALETTE_PREVIEWS[palette]}
							<button
								class="palette-card"
								class:palette-active={currentPalette === palette}
								onclick={() => applyTheme(`${palette}-${currentMode}`)}
							>
								<div class="palette-swatches">
									<div class="swatch" style="background: {currentMode === 'dark' ? preview.bg : currentMode === 'mid' ? preview.bgMid : preview.bgLight}"></div>
									<div class="swatch" style="background: {preview.primary}"></div>
									<div class="swatch" style="background: {preview.accent}"></div>
								</div>
								<span class="palette-name">{palette[0].toUpperCase() + palette.slice(1)}</span>
							</button>
						{/each}
					</div>
				</div>

			{:else if activeTab === 'devtools'}
				<div class="devtools-panel">
					<div class="devtools-section">
						<div class="devtools-label">Load seed data</div>
						<p class="devtools-hint">Replace current session with realistic mock data for testing.</p>
						<div class="devtools-grid">
							{#each SEED_SCENARIOS as scenario}
								<button
									class="devtools-seed-btn"
									class:devtools-seed-active={seedLoaded === scenario.id}
									onclick={() => {
										session.set(scenario.fn());
										seedLoaded = scenario.id;
										setTimeout(() => seedLoaded = '', 2000);
									}}
								>
									<span class="devtools-seed-label">{scenario.label}</span>
									<span class="devtools-seed-desc">{scenario.description}</span>
								</button>
							{/each}
						</div>
					</div>
					<div class="devtools-section">
						<div class="devtools-label">Quick actions</div>
						<button
							class="devtools-seed-btn"
							onclick={() => {
								session.set({ ...EMPTY_SESSION, layout: [...EMPTY_SESSION.layout] });
								seedLoaded = 'cleared';
								setTimeout(() => seedLoaded = '', 2000);
							}}
						>
							<span class="devtools-seed-label">Clear session</span>
							<span class="devtools-seed-desc">Reset to empty state</span>
						</button>
					</div>
					{#if seedLoaded}
						<div class="devtools-toast">Loaded!</div>
					{/if}
				</div>

			{:else}
				<!-- About page -->
				<div class="about-page">
					<div class="about-app-icon">
						<Clock size={28} />
					</div>
					<h3 class="about-name">Contraction Timer</h3>
					<p class="about-version">v0.1.0</p>
					<p class="about-desc">Track contractions, assess labor patterns, know when to go to the hospital.</p>
					<div class="about-features">
						<div class="about-feature">Live timer with wave chart</div>
						<div class="about-feature">5-1-1 rule tracking</div>
						<div class="about-feature">Braxton Hicks assessment</div>
						<div class="about-feature">Hospital departure advisor</div>
						<div class="about-feature">Clinical reference guide</div>
					</div>
					<div class="about-privacy">
						<p>All data stays on this device. No accounts, no servers, no tracking.</p>
					</div>
					<div class="about-links">
						<a href="https://github.com/cybersader/obsidian-contractions-timer" target="_blank" rel="noopener" class="about-link">
							GitHub
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
		color: var(--text-faint);
		font-weight: 400;
	}

	.menu-item--danger {
		color: var(--danger);
	}

	.menu-item--danger :global(svg) {
		color: var(--danger);
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
		color: var(--text-faint);
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
		color: var(--text-faint);
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
