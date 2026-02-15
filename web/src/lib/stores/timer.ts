import { writable, derived } from 'svelte/store';
import type { TimerPhase } from '../labor-logic/types';
export type { TimerPhase };
import { isContractionActive } from '../labor-logic/calculations';
import { session } from './session';
import { dlog } from '../debug-log';

/** Tick counter — incremented every 200ms by App.svelte's $effect */
export const tick = writable(0);

/** Start the global tick interval. Returns cleanup function. */
export function startTick(): () => void {
	dlog('timer', 'Tick started (200ms interval)', undefined, { src: 'timer-store' });
	const id = setInterval(() => {
		tick.update(n => n + 1);
	}, 200);
	return () => {
		clearInterval(id);
		dlog('timer', 'Tick stopped', undefined, { src: 'timer-store' });
	};
}

let lastPhase: TimerPhase = 'idle';

/** Current timer phase derived from session state */
export const timerPhase = derived(session, ($s): TimerPhase => {
	let phase: TimerPhase;
	if ($s.contractions.some(c => isContractionActive(c))) phase = 'contracting';
	else if ($s.contractions.length > 0) phase = 'resting';
	else phase = 'idle';

	if (phase !== lastPhase) {
		dlog('timer', `Phase: ${lastPhase} -> ${phase}`, { contractions: $s.contractions.length }, { src: 'timer-store' });
		lastPhase = phase;
	}
	return phase;
});
