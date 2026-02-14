<script lang="ts">
	import Swiper from 'swiper';
	import 'swiper/css';
	import { startTick } from '../lib/stores/timer';
	import { tabRequest, settingsRequest, shareRequest } from '../lib/stores/navigation';
	import { getStoredTheme, setTheme } from '../lib/themes';
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

	// Apply stored theme on mount
	setTheme(getStoredTheme());

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
			speed: 300,
			resistance: true,
			resistanceRatio: 0.85,
		});

		swiperInstance.on('slideChange', () => {
			activeIndex = swiperInstance.activeIndex;
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

	// Check for #snapshot= hash parameter on load
	$effect(() => {
		if (typeof window === 'undefined') return;
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
			<h2 class="relay-title">Response sent!</h2>
			<p class="relay-desc">The response code was sent to your sharing session. You can close this tab.</p>
			<button class="relay-close" onclick={() => { try { window.close(); } catch {} answerRelayMode = false; }}>
				Close tab
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
