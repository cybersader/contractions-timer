<script lang="ts">
	import Swiper from 'swiper';
	import 'swiper/css';
	import { startTick } from '../lib/stores/timer';
	import { session } from '../lib/stores/session';
	import { settings } from '../lib/stores/settings';
	import { tabRequest, settingsRequest, shareRequest } from '../lib/stores/navigation';
	import { getStoredTheme, setTheme } from '../lib/themes';
	import { dlog } from '../lib/debug-log';
	import { setI18nLocale, isLoading, _ } from '../lib/i18n/index';

	// i18n is eagerly initialized in lib/i18n/index.ts (module side-effect).
	// Sync locale when settings.language changes at runtime.
	$effect(() => {
		setI18nLocale($settings.language);
	});
	import Toast from './shared/Toast.svelte';
	import HeaderBar from './nav/HeaderBar.svelte';
	import HamburgerMenu from './nav/HamburgerMenu.svelte';
	import StorageWarning from './shared/StorageWarning.svelte';
	import BottomNav from './nav/BottomNav.svelte';
	import SidebarNav from './nav/SidebarNav.svelte';
	import TimerPage from './timer/TimerPage.svelte';
	import DashboardPage from './dashboard/DashboardPage.svelte';
	import HistoryPage from './history/HistoryPage.svelte';
	import HospitalPage from './hospital/HospitalPage.svelte';
	import OnboardingFlow from './onboarding/OnboardingFlow.svelte';

	const DESKTOP_BREAKPOINT = 1024;

	let swiperEl: HTMLElement | undefined = $state();
	let swiper: Swiper | undefined = $state();
	let activeIndex = $state(0);
	let menuOpen = $state(false);
	let pendingSettingsSection: string | null = $state(null);
	let pendingSharingRequest = $state(false);
	let pendingOfferCode: string | null = $state(null);
	let pendingRoomCode: string | null = $state(null);
	let pendingPassword: string | null = $state(null);
	let pendingSnapshotCode: string | null = $state(null);
	let isDesktop = $state(false);

	// Onboarding: show on first visit (no localStorage flag)
	let showOnboarding = $state(
		typeof localStorage !== 'undefined' && !localStorage.getItem('ct-onboarding-done')
	);

	// Swipe hint: show once after first contraction completes (progressive disclosure)
	let showSwipeHint = $state(false);
	$effect(() => {
		if (isDesktop || showOnboarding) return;
		if (typeof localStorage === 'undefined') return;
		if (localStorage.getItem('ct-content-hint-shown')) return;

		const completedCount = $session.contractions.filter(c => c.end !== null).length;
		if (completedCount === 0) return;

		// Gate immediately so re-runs don't restart timer
		localStorage.setItem('ct-content-hint-shown', '1');

		const timer = setTimeout(() => {
			showSwipeHint = true;
			setTimeout(() => { showSwipeHint = false; }, 2500);
		}, 800);
		return () => clearTimeout(timer);
	});

	// Apply stored theme on mount
	const initialTheme = getStoredTheme();
	setTheme(initialTheme);
	dlog('app', 'App init', { theme: initialTheme, onboarding: showOnboarding }, { src: 'App' });

	// Detect desktop/mobile via matchMedia
	$effect(() => {
		if (typeof window === 'undefined') return;
		const mq = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
		isDesktop = mq.matches;
		const handler = (e: MediaQueryListEvent) => { isDesktop = e.matches; };
		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	});

	// Initialize Swiper (mobile only) + tick interval
	$effect(() => {
		// Start global tick (200ms) for live timer updates — always active
		const stopTick = startTick();

		if (isDesktop || !swiperEl) {
			// Desktop mode or no swiper element yet — just tick, no swiper
			return () => { stopTick(); };
		}

		const swiperInstance = new Swiper(swiperEl, {
			spaceBetween: 0,
			slidesPerView: 1,
			allowTouchMove: true,
			cssMode: true,
		});

		swiperInstance.on('slideChange', () => {
			const tabNames = ['Timer', 'Dashboard', 'History', 'Hospital'];
			activeIndex = swiperInstance.activeIndex;
			dlog('nav', `Tab: ${tabNames[activeIndex] ?? activeIndex}`, { index: activeIndex }, { src: 'App' });
		});

		// Sync to current activeIndex (in case switching from desktop)
		swiperInstance.slideTo(activeIndex, 0);
		swiper = swiperInstance;

		return () => {
			stopTick();
			swiperInstance.destroy();
			swiper = undefined;
		};
	});

	function handleTabClick(index: number) {
		activeIndex = index;
		swiper?.slideTo(index);
	}

	// Watch navigation store for cross-component tab requests
	$effect(() => {
		const idx = $tabRequest;
		if (idx !== null) {
			handleTabClick(idx);
			tabRequest.set(null);
		}
	});

	// Watch settings requests — open hamburger menu and navigate to section
	$effect(() => {
		const section = $settingsRequest;
		if (section !== null) {
			pendingSettingsSection = section;
			menuOpen = true;
			settingsRequest.set(null);
		}
	});

	// Watch share requests — open hamburger menu to sharing tab
	$effect(() => {
		const req = $shareRequest;
		if (req) {
			pendingSharingRequest = true;
			menuOpen = true;
			shareRequest.set(false);
		}
	});

	function handleShareClick() {
		pendingSharingRequest = true;
		menuOpen = true;
	}

	// Check for #snapshot= hash parameter on load AND on hash change (Safari same-tab links)
	function processSnapshotHash() {
		if (!window.location.hash) return;
		const hashParams = new URLSearchParams(window.location.hash.slice(1));
		const snapshotCode = hashParams.get('snapshot');
		if (snapshotCode) {
			pendingSnapshotCode = snapshotCode;
			// Clean URL (remove hash)
			window.history.replaceState({}, '', window.location.pathname + window.location.search);
			// Open sharing panel to show import
			pendingSharingRequest = true;
			menuOpen = true;
		}
	}

	$effect(() => {
		if (typeof window === 'undefined') return;
		// Check on mount
		processSnapshotHash();
		// Also listen for hash changes (e.g. clicking a snapshot link while already on the page)
		window.addEventListener('hashchange', processSnapshotHash);
		return () => window.removeEventListener('hashchange', processSnapshotHash);
	});

	// Check for ?room=, ?offer=, or ?answer= query parameter on load
	let pendingAnswerCode: string | null = $state(null);
	let answerRelayMode = $state(false);
	$effect(() => {
		if (typeof window === 'undefined') return;
		const params = new URLSearchParams(window.location.search);
		const roomCode = params.get('room');
		const offerCode = params.get('offer');
		const answerCode = params.get('answer');

		if (roomCode || offerCode || answerCode) {
			// Extract password from hash fragment (#key=...) before cleaning
			let urlPassword: string | null = null;
			if (window.location.hash) {
				const hashParams = new URLSearchParams(window.location.hash.slice(1));
				urlPassword = hashParams.get('key');
			}

			// Clean URL (remove query params and hash)
			const url = new URL(window.location.href);
			url.searchParams.delete('room');
			url.searchParams.delete('offer');
			url.searchParams.delete('answer');
			window.history.replaceState({}, '', url.pathname);

			if (roomCode) {
				pendingRoomCode = roomCode;
				if (urlPassword) pendingPassword = urlPassword;
			}
			if (answerCode) {
				// Answer relay: try to send to host tab via BroadcastChannel
				if (typeof BroadcastChannel !== 'undefined') {
					const bc = new BroadcastChannel('ct-private-connect');
					bc.postMessage({ type: 'answer-code', code: answerCode });
					bc.close();
					console.debug('[App] Sent answer code via BroadcastChannel');
					answerRelayMode = true;
				}
				// Also store locally in case this IS the host tab
				pendingAnswerCode = answerCode;
			}
			if (offerCode) {
				// Private mode: pre-fill the offer code
				pendingOfferCode = offerCode;
			}
			// Open sharing panel
			pendingSharingRequest = true;
			menuOpen = true;
		}
	});
</script>

{#if isDesktop}
	<!-- Desktop layout: sidebar + main content area -->
	<SidebarNav {activeIndex} onTabClick={handleTabClick} onMenuToggle={() => menuOpen = !menuOpen} />

	<main class="desktop-main">
		<div class="desktop-page" class:desktop-active={activeIndex === 0}><TimerPage /></div>
		<div class="desktop-page" class:desktop-active={activeIndex === 1}><DashboardPage /></div>
		<div class="desktop-page" class:desktop-active={activeIndex === 2}><HistoryPage /></div>
		<div class="desktop-page" class:desktop-active={activeIndex === 3}><HospitalPage /></div>
	</main>
{:else}
	<!-- Mobile layout: header + swiper + bottom nav -->
	<HeaderBar onMenuToggle={() => menuOpen = !menuOpen} onHomeClick={() => handleTabClick(0)} onShareClick={handleShareClick} />

	<div class="app-swiper swiper" bind:this={swiperEl}>
		<div class="swiper-wrapper">
			<div class="swiper-slide"><TimerPage /></div>
			<div class="swiper-slide"><DashboardPage /></div>
			<div class="swiper-slide"><HistoryPage /></div>
			<div class="swiper-slide"><HospitalPage /></div>
		</div>
	</div>

	{#if showSwipeHint}
		<div class="swipe-hint" aria-hidden="true">
			<div class="swipe-hint-arrow">
				<span class="swipe-hint-chevron">‹</span>
				<span class="swipe-hint-text">{$_('swipeHint')}</span>
				<span class="swipe-hint-chevron">›</span>
			</div>
		</div>
	{/if}

	<BottomNav {activeIndex} onTabClick={handleTabClick} />
{/if}

<HamburgerMenu
	open={menuOpen}
	settingsSection={pendingSettingsSection}
	sharingRequested={pendingSharingRequest}
	initialOfferCode={pendingOfferCode}
	initialAnswerCode={pendingAnswerCode}
	initialRoomCode={pendingRoomCode}
	initialPassword={pendingPassword}
	initialSnapshotCode={pendingSnapshotCode}
	{answerRelayMode}
	onClose={() => { menuOpen = false; pendingSettingsSection = null; pendingSharingRequest = false; pendingOfferCode = null; pendingAnswerCode = null; pendingRoomCode = null; pendingPassword = null; pendingSnapshotCode = null; answerRelayMode = false; }}
	onRestartOnboarding={() => {
		try { localStorage.removeItem('ct-onboarding-done'); } catch {}
		showOnboarding = true;
	}}
/>

<Toast />

<StorageWarning />

{#if showOnboarding}
	<OnboardingFlow onComplete={() => showOnboarding = false} />
{/if}

{#if answerRelayMode}
	<div class="relay-overlay">
		<div class="relay-card">
			<div class="relay-icon">&#10003;</div>
			<h2 class="relay-title">{$_('relay.responseSent')}</h2>
			<p class="relay-desc">{$_('relay.responseSentDesc')}</p>
			<button class="relay-close" onclick={() => { try { window.close(); } catch {} answerRelayMode = false; }}>
				{$_('relay.closeTab')}
			</button>
		</div>
	</div>
{/if}

<style>
	/* Answer relay overlay */
	.relay-overlay {
		position: fixed;
		inset: 0;
		z-index: 200;
		background: var(--bg-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-4);
	}

	.relay-card {
		text-align: center;
		max-width: 320px;
	}

	.relay-icon {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: var(--success-muted, var(--accent-muted));
		color: var(--success, var(--accent));
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 28px;
		margin: 0 auto var(--space-4);
	}

	.relay-title {
		font-size: var(--text-xl, 1.25rem);
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: var(--space-2);
	}

	.relay-desc {
		font-size: var(--text-base);
		color: var(--text-muted);
		line-height: 1.5;
		margin-bottom: var(--space-5);
	}

	.relay-close {
		padding: var(--space-3) var(--space-5);
		border-radius: var(--radius-md);
		border: none;
		background: var(--accent);
		color: white;
		font-size: var(--text-base);
		font-weight: 600;
		cursor: pointer;
		min-height: 44px;
	}
	/* Swipe hint */
	.swipe-hint {
		position: fixed;
		bottom: calc(60px + env(safe-area-inset-bottom, 0px) + 16px);
		left: 50%;
		transform: translateX(-50%);
		z-index: 50;
		pointer-events: none;
		animation: swipeHintFade 2.5s ease-out forwards;
	}

	.swipe-hint-arrow {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-4);
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-full, 9999px);
		box-shadow: 0 2px 12px rgba(0,0,0,0.1);
	}

	.swipe-hint-chevron {
		font-size: 18px;
		font-weight: 700;
		color: var(--accent);
		animation: swipeHintBounce 1s ease-in-out infinite;
	}

	.swipe-hint-chevron:first-child {
		animation-name: swipeHintBounceLeft;
	}

	.swipe-hint-chevron:last-child {
		animation-name: swipeHintBounceRight;
	}

	.swipe-hint-text {
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	@keyframes swipeHintFade {
		0% { opacity: 0; transform: translateX(-50%) translateY(8px); }
		15% { opacity: 1; transform: translateX(-50%) translateY(0); }
		75% { opacity: 1; }
		100% { opacity: 0; }
	}

	@keyframes swipeHintBounceLeft {
		0%, 100% { transform: translateX(0); }
		50% { transform: translateX(-4px); }
	}

	@keyframes swipeHintBounceRight {
		0%, 100% { transform: translateX(0); }
		50% { transform: translateX(4px); }
	}

	/* Desktop layout */
	.desktop-main {
		margin-left: var(--sidebar-width, 220px);
		height: 100dvh;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.desktop-page {
		display: none;
	}

	.desktop-page.desktop-active {
		display: block;
	}
</style>
