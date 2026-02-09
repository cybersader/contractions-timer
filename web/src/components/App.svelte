<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Swiper from 'swiper';
	import 'swiper/css';
	import { tick } from '../lib/stores/timer';
	import BottomNav from './nav/BottomNav.svelte';
	import TimerPage from './timer/TimerPage.svelte';
	import DashboardPage from './dashboard/DashboardPage.svelte';
	import HistoryPage from './history/HistoryPage.svelte';
	import HospitalPage from './hospital/HospitalPage.svelte';
	import SettingsPage from './settings/SettingsPage.svelte';

	let swiperEl: HTMLElement;
	let swiper: Swiper;
	let activeIndex = 0;
	let tickInterval: ReturnType<typeof setInterval>;

	onMount(() => {
		swiper = new Swiper(swiperEl, {
			spaceBetween: 0,
			slidesPerView: 1,
			allowTouchMove: true,
			speed: 300,
			resistance: true,
			resistanceRatio: 0.85,
		});

		swiper.on('slideChange', () => {
			activeIndex = swiper.activeIndex;
		});

		// Tick every 200ms for live timer updates
		tickInterval = setInterval(() => {
			tick.update(n => n + 1);
		}, 200);
	});

	onDestroy(() => {
		clearInterval(tickInterval);
		swiper?.destroy();
	});

	function handleTabClick(index: number) {
		activeIndex = index;
		swiper?.slideTo(index);
	}
</script>

<div class="app-swiper swiper" bind:this={swiperEl}>
	<div class="swiper-wrapper">
		<div class="swiper-slide"><TimerPage /></div>
		<div class="swiper-slide"><DashboardPage /></div>
		<div class="swiper-slide"><HistoryPage /></div>
		<div class="swiper-slide"><HospitalPage /></div>
		<div class="swiper-slide"><SettingsPage /></div>
	</div>
</div>

<BottomNav {activeIndex} onTabClick={handleTabClick} />
