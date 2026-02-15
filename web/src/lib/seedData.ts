/**
 * Dev utility: generate realistic mock contraction data for testing UI states.
 * Each scenario creates contractions working backward from "now" so the timer
 * page, dashboard, wave chart, and hospital advisor all render meaningfully.
 */

import type { Contraction, LaborEvent, SessionData } from './labor-logic/types';
import { EMPTY_SESSION } from './labor-logic/types';

function id(): string {
	return Math.random().toString(36).slice(2, 10);
}

function isoAgo(minutesAgo: number): string {
	return new Date(Date.now() - minutesAgo * 60000).toISOString();
}

function rand(min: number, max: number): number {
	return min + Math.random() * (max - min);
}

function pick<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

interface ContractionSpec {
	minutesAgo: number;
	durationSec: number;
	intensity: number;
	location: 'front' | 'back' | 'wrapping' | null;
}

function specsToContractions(specs: ContractionSpec[]): Contraction[] {
	return specs.map(s => ({
		id: id(),
		start: isoAgo(s.minutesAgo),
		end: isoAgo(s.minutesAgo - s.durationSec / 60),
		intensity: s.intensity as 1 | 2 | 3 | 4 | 5,
		location: s.location,
		notes: '',
	}));
}

/** Early labor: 5 contractions, irregular intervals (8-15 min), short duration, low intensity */
export function earlyLaborSession(): SessionData {
	let t = 50; // minutes ago
	const specs: ContractionSpec[] = [];
	for (let i = 0; i < 5; i++) {
		const dur = rand(25, 45);
		specs.push({
			minutesAgo: t,
			durationSec: dur,
			intensity: pick([1, 1, 2, 2]),
			location: pick(['front', 'front', 'front', null]),
		});
		t -= rand(8, 15);
	}
	return {
		...EMPTY_SESSION,
		contractions: specsToContractions(specs),
		sessionStartedAt: isoAgo(55),
		events: [],
		layout: [...EMPTY_SESSION.layout],
	};
}

/** Active labor: 12 contractions, regular intervals (3.5-5.5 min), moderate duration, rising intensity */
export function activeLaborSession(): SessionData {
	let t = 65; // minutes ago
	const specs: ContractionSpec[] = [];
	for (let i = 0; i < 12; i++) {
		const progress = i / 11; // 0 to 1
		const dur = rand(50, 65) + progress * 10;
		const intensity = progress < 0.3 ? pick([2, 2, 3]) : progress < 0.7 ? pick([3, 3, 4]) : pick([3, 4, 4]);
		specs.push({
			minutesAgo: t,
			durationSec: dur,
			intensity,
			location: progress < 0.4 ? pick(['front', 'front', 'back']) : pick(['back', 'wrapping', 'wrapping']),
		});
		t -= rand(3.5, 5.5);
	}
	return {
		...EMPTY_SESSION,
		contractions: specsToContractions(specs),
		sessionStartedAt: isoAgo(70),
		events: [],
		layout: [...EMPTY_SESSION.layout],
	};
}

/** Transition: 22 contractions, tight intervals (2-3 min), long duration, high intensity, water break */
export function transitionSession(): SessionData {
	let t = 180; // minutes ago (3 hours)
	const specs: ContractionSpec[] = [];

	// Phase 1: early (6 contractions, wider intervals)
	for (let i = 0; i < 6; i++) {
		specs.push({
			minutesAgo: t,
			durationSec: rand(30, 50),
			intensity: pick([1, 2, 2]),
			location: pick(['front', 'front', null]),
		});
		t -= rand(10, 15);
	}

	// Phase 2: active (8 contractions, tighter)
	for (let i = 0; i < 8; i++) {
		specs.push({
			minutesAgo: t,
			durationSec: rand(50, 70),
			intensity: pick([3, 3, 4]),
			location: pick(['back', 'wrapping', 'wrapping']),
		});
		t -= rand(4, 6);
	}

	// Phase 3: transition (8 contractions, very tight)
	for (let i = 0; i < 8; i++) {
		specs.push({
			minutesAgo: t,
			durationSec: rand(60, 90),
			intensity: pick([4, 4, 5, 5]),
			location: pick(['wrapping', 'wrapping', 'back']),
		});
		t -= rand(2, 3.5);
	}

	const events: LaborEvent[] = [{
		id: id(),
		type: 'water-break',
		timestamp: isoAgo(45),
		notes: 'Clear fluid',
	}];

	return {
		...EMPTY_SESSION,
		contractions: specsToContractions(specs),
		sessionStartedAt: isoAgo(185),
		events,
		layout: [...EMPTY_SESSION.layout],
	};
}

/** Just 1 contraction — for testing the "just started" state */
export function singleContractionSession(): SessionData {
	return {
		...EMPTY_SESSION,
		contractions: specsToContractions([{
			minutesAgo: 3,
			durationSec: 35,
			intensity: 2,
			location: 'front',
		}]),
		sessionStartedAt: isoAgo(5),
		events: [],
		layout: [...EMPTY_SESSION.layout],
	};
}

/** Mixed session with untimed (manual) entries and a gap for segment testing */
export function mixedSession(): SessionData {
	let t = 120;
	const specs: ContractionSpec[] = [];

	// Cluster 1 (5 contractions, then a 45-min gap)
	for (let i = 0; i < 5; i++) {
		specs.push({
			minutesAgo: t,
			durationSec: rand(35, 55),
			intensity: pick([2, 3, 3]),
			location: pick(['front', 'back']),
		});
		t -= rand(5, 8);
	}

	t -= 45; // big gap

	// Cluster 2 (7 contractions, tighter)
	for (let i = 0; i < 7; i++) {
		specs.push({
			minutesAgo: t,
			durationSec: rand(45, 65),
			intensity: pick([3, 4, 4]),
			location: pick(['wrapping', 'back']),
		});
		t -= rand(3.5, 5.5);
	}

	const contractions = specsToContractions(specs);

	// Add 2 untimed (manual) entries
	contractions.splice(3, 0, {
		id: id(),
		start: isoAgo(95),
		end: isoAgo(94),
		intensity: 2,
		location: 'front',
		notes: 'Manually logged',
		untimed: true,
	} as Contraction);

	return {
		...EMPTY_SESSION,
		contractions,
		sessionStartedAt: isoAgo(125),
		events: [],
		layout: [...EMPTY_SESSION.layout],
	};
}

export const SEED_SCENARIOS = [
	{ id: 'single', label: '1 contraction', description: 'Just started tracking', fn: singleContractionSession },
	{ id: 'early', label: 'Early labor', description: '5 contractions, irregular', fn: earlyLaborSession },
	{ id: 'active', label: 'Active labor', description: '12 contractions, regular', fn: activeLaborSession },
	{ id: 'mixed', label: 'Mixed + gap', description: '13 contractions, 2 clusters', fn: mixedSession },
	{ id: 'transition', label: 'Transition', description: '22 contractions + water break', fn: transitionSession },
] as const;
