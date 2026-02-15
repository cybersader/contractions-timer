import { describe, it, expect } from 'bun:test';
import {
	earlyLaborSession,
	activeLaborSession,
	transitionSession,
	mixedSession,
	singleContractionSession,
} from '../web/src/lib/seedData';
import { check511Rule } from '../src/data/calculations';
import type { ThresholdConfig } from '../src/types';

const defaultThreshold: ThresholdConfig = {
	intervalMinutes: 5,
	durationSeconds: 60,
	sustainedMinutes: 60,
};

describe('seed data validation', () => {
	it('earlyLaborSession produces valid contractions', () => {
		const session = earlyLaborSession();
		expect(session.contractions.length).toBe(5);
		expect(session.contractions.every(c => c.start && c.end)).toBe(true);
		expect(session.sessionStartedAt).toBeTruthy();
	});

	it('activeLaborSession produces 12 contractions with recent entries', () => {
		const session = activeLaborSession();
		expect(session.contractions.length).toBe(12);

		// At least some contractions should be within the last 60 minutes
		const now = Date.now();
		const recentCount = session.contractions.filter(c => {
			const start = new Date(c.start).getTime();
			return (now - start) <= 60 * 60000;
		}).length;
		expect(recentCount).toBeGreaterThanOrEqual(3);
	});

	it('activeLaborSession 5-1-1 check produces reasonable progress', () => {
		const session = activeLaborSession();
		const completed = session.contractions.filter(c => c.end !== null);
		const result = check511Rule(completed, defaultThreshold);

		// Interval should be around 3.5-5.5 min
		expect(result.progress.intervalValue).toBeGreaterThan(2);
		expect(result.progress.intervalValue).toBeLessThan(7);

		// Duration should be around 50-75s
		expect(result.progress.durationValue).toBeGreaterThan(40);
		expect(result.progress.durationValue).toBeLessThan(80);

		// Sustained value should be positive and reflect actual span
		expect(result.progress.sustainedValue).toBeGreaterThan(0);
	});

	it('transitionSession has water break event and enough contractions', () => {
		const session = transitionSession();
		expect(session.contractions.length).toBe(22);
		expect(session.events.length).toBeGreaterThanOrEqual(1);
		expect(session.events[0].type).toBe('water-break');
	});

	it('transitionSession 5-1-1 should show sustained activity', () => {
		const session = transitionSession();
		const completed = session.contractions.filter(c => c.end !== null);
		const result = check511Rule(completed, defaultThreshold);

		// Phase 3 contractions (2-3.5 min intervals) span ~15-25 min in the window
		expect(result.progress.sustainedValue).toBeGreaterThan(10);
	});

	it('mixedSession has two clusters with a gap', () => {
		const session = mixedSession();
		// 5 + 7 timed + 1 untimed = 13
		expect(session.contractions.length).toBe(13);

		// Should have at least one untimed entry
		const untimed = session.contractions.filter(c => (c as any).untimed);
		expect(untimed.length).toBeGreaterThanOrEqual(1);
	});

	it('singleContractionSession has exactly 1 contraction', () => {
		const session = singleContractionSession();
		expect(session.contractions.length).toBe(1);
	});

	it('all seeds have chronologically ordered contractions', () => {
		const seeds = [earlyLaborSession, activeLaborSession, transitionSession, mixedSession];
		for (const seedFn of seeds) {
			const session = seedFn();
			for (let i = 1; i < session.contractions.length; i++) {
				const prev = new Date(session.contractions[i - 1].start).getTime();
				const curr = new Date(session.contractions[i].start).getTime();
				// Skip pairs involving untimed entries (they're manually inserted)
				if (!(session.contractions[i] as any).untimed && !(session.contractions[i - 1] as any).untimed) {
					expect(curr).toBeGreaterThanOrEqual(prev);
				}
			}
		}
	});
});
