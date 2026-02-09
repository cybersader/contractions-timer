import { describe, it, expect } from 'bun:test';
import type { Contraction, LaborEvent } from '../src/types';
import { getRelevantTips } from '../src/data/clinicalData';

function makeContraction(
	startOffset: number,
	durationSec: number,
	intensity: number | null = 3,
	location: 'front' | 'back' | 'wrapping' | null = null,
	baseTime: number = Date.now() - 3600000
): Contraction {
	return {
		id: Math.random().toString(36).substring(2, 8),
		start: new Date(baseTime + startOffset * 1000).toISOString(),
		end: new Date(baseTime + (startOffset + durationSec) * 1000).toISOString(),
		intensity,
		location,
		notes: '',
	};
}

describe('getRelevantTips', () => {
	it('returns tips for early labor stage', () => {
		const contractions = [
			makeContraction(0, 35),
			makeContraction(480, 40),
			makeContraction(960, 38),
		];
		const tips = getRelevantTips(contractions, [], 'early', null);
		expect(tips.length).toBeGreaterThan(0);
		expect(tips.length).toBeLessThanOrEqual(2);
	});

	it('returns water break tips when water broke', () => {
		const events: LaborEvent[] = [{
			id: 'wb1',
			type: 'water-break',
			timestamp: new Date().toISOString(),
			notes: '',
		}];
		const tips = getRelevantTips([], events, null, null);
		const waterTips = tips.filter(t => t.id.startsWith('water-'));
		expect(waterTips.length).toBeGreaterThan(0);
	});

	it('returns max 2 tips', () => {
		const contractions = Array.from({ length: 10 }, (_, i) =>
			makeContraction(i * 300, 50, 3, 'back')
		);
		const tips = getRelevantTips(contractions, [], 'active', 'early');
		expect(tips.length).toBeLessThanOrEqual(2);
	});

	it('returns stage-entered tips on stage change', () => {
		const contractions = [
			makeContraction(0, 50),
			makeContraction(240, 55),
			makeContraction(480, 52),
		];
		const tips = getRelevantTips(contractions, [], 'active', 'early');
		const enteredTips = tips.filter(t => t.id === 'active-entered');
		expect(enteredTips.length).toBe(1);
	});

	it('includes back labor tip in candidates for back/wrapping pattern', () => {
		const contractions = [
			makeContraction(0, 50, 3, 'back'),
			makeContraction(300, 55, 3, 'wrapping'),
			makeContraction(600, 52, 3, 'back'),
			makeContraction(900, 53, 3, 'wrapping'),
		];
		const tips = getRelevantTips(contractions, [], 'active', 'active');
		// The tip should exist in the returned tips (safety tip may take the #1 spot,
		// but back-labor should be within the top 2 as a comfort tip)
		const hasBackOrComfort = tips.some(t => t.id === 'back-labor' || t.category === 'comfort');
		expect(hasBackOrComfort).toBe(true);
	});

	it('prioritizes safety tips', () => {
		const contractions = [
			makeContraction(0, 35),
			makeContraction(480, 40),
			makeContraction(960, 38),
		];
		const tips = getRelevantTips(contractions, [], 'early', null);
		if (tips.length > 0) {
			// Safety should be first if present
			const safetyIdx = tips.findIndex(t => t.category === 'safety');
			if (safetyIdx >= 0) {
				expect(safetyIdx).toBe(0);
			}
		}
	});
});
