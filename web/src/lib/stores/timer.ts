import { writable, derived } from 'svelte/store';
import type { TimerPhase } from '../labor-logic/types';
import { isContractionActive } from '../labor-logic/calculations';
import { session } from './session';

/** Tick counter — incremented every 200ms by App.svelte */
export const tick = writable(0);

/** Current timer phase derived from session state */
export const timerPhase = derived(session, ($s): TimerPhase => {
	if ($s.contractions.some(c => isContractionActive(c))) return 'contracting';
	if ($s.contractions.length > 0) return 'resting';
	return 'idle';
});
