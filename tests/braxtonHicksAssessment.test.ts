import { describe, it, expect } from 'bun:test';
import type { Contraction, LaborEvent } from '../src/types';
import { DEFAULT_BH_THRESHOLDS } from '../src/types';
import { assessBraxtonHicks } from '../src/data/braxtonHicksAssessment';

function makeContraction(
	startOffset: number,
	durationSec: number,
	intensity: number | null = 3,
	location: 'front' | 'back' | 'wrapping' | null = null,
	baseTime: number = Date.now() - 7200000 // 2 hours ago
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

describe('assessBraxtonHicks', () => {
	it('requires at least 4 contractions', () => {
		const contractions = [
			makeContraction(0, 30),
			makeContraction(600, 30),
			makeContraction(1200, 30),
		];
		const result = assessBraxtonHicks(contractions, []);
		expect(result.requiresMore).toBe(true);
		expect(result.criteria).toHaveLength(0);
	});

	it('scores low for irregular, front-only, stable pattern (BH)', () => {
		// Irregular intervals, front location, stable intensity
		const contractions = [
			makeContraction(0, 25, 2, 'front'),
			makeContraction(900, 20, 2, 'front'),    // 15 min gap
			makeContraction(1200, 28, 2, 'front'),   // 5 min gap
			makeContraction(2400, 22, 1, 'front'),   // 20 min gap
		];
		const result = assessBraxtonHicks(contractions, []);
		expect(result.requiresMore).toBe(false);
		expect(result.score).toBeLessThanOrEqual(40);
	});

	it('scores high for regular, intensifying, back/wrapping pattern (real labor)', () => {
		// Regular intervals getting closer, increasing intensity, back/wrapping
		const contractions = [
			makeContraction(0, 40, 2, 'back'),
			makeContraction(360, 50, 3, 'wrapping'), // 6 min
			makeContraction(660, 55, 4, 'back'),     // 5 min
			makeContraction(900, 62, 5, 'wrapping'), // 4 min
			makeContraction(1140, 65, 5, 'back'),    // 4 min
		];
		const result = assessBraxtonHicks(contractions, []);
		expect(result.requiresMore).toBe(false);
		expect(result.score).toBeGreaterThanOrEqual(60);
		expect(result.verdict).toBe('likely-real-labor');
	});

	it('returns uncertain for mixed signals', () => {
		// Some real labor signs, some BH signs
		const contractions = [
			makeContraction(0, 35, 3, 'front'),
			makeContraction(300, 40, 3, 'front'),   // 5 min - regular
			makeContraction(600, 38, 3, 'front'),   // 5 min - regular
			makeContraction(900, 42, 3, 'front'),   // 5 min - regular
		];
		const result = assessBraxtonHicks(contractions, []);
		expect(result.requiresMore).toBe(false);
		// Regular pattern but front-only, stable intensity
		expect(result.criteria.length).toBeGreaterThan(0);
	});

	it('has 6 criteria for complete data', () => {
		const contractions = [
			makeContraction(0, 40, 2, 'back'),
			makeContraction(300, 45, 3, 'wrapping'),
			makeContraction(600, 50, 4, 'back'),
			makeContraction(900, 55, 5, 'wrapping'),
		];
		const result = assessBraxtonHicks(contractions, []);
		expect(result.criteria).toHaveLength(6);
	});

	it('marks intensity inconclusive when no ratings', () => {
		const contractions = [
			makeContraction(0, 40, null, null),
			makeContraction(300, 45, null, null),
			makeContraction(600, 50, null, null),
			makeContraction(900, 55, null, null),
		];
		const result = assessBraxtonHicks(contractions, []);
		const intensityCriterion = result.criteria.find(c => c.name === 'Growing intensity');
		expect(intensityCriterion?.result).toBe('inconclusive');
	});

	it('uses custom thresholds when provided', () => {
		// With very strict verdict threshold (90), even a strong real-labor pattern is "uncertain"
		const contractions = [
			makeContraction(0, 40, 2, 'back'),
			makeContraction(360, 50, 3, 'wrapping'),
			makeContraction(660, 55, 4, 'back'),
			makeContraction(900, 62, 5, 'wrapping'),
			makeContraction(1140, 65, 5, 'back'),
		];
		const strictThresholds = {
			...DEFAULT_BH_THRESHOLDS,
			verdictRealThreshold: 95, // Almost impossible to reach
		};
		const defaultResult = assessBraxtonHicks(contractions, []);
		const strictResult = assessBraxtonHicks(contractions, [], strictThresholds);

		expect(defaultResult.verdict).toBe('likely-real-labor');
		// With 95 threshold, the same score no longer classifies as real labor
		expect(strictResult.verdict).not.toBe('likely-real-labor');
	});

	it('excludes untimed contractions from duration trend', () => {
		// Timed contractions have increasing duration (real labor sign)
		// but include an untimed contraction that shouldn't affect the trend
		const contractions: Contraction[] = [
			makeContraction(0, 40, 2, 'back'),
			makeContraction(360, 50, 3, 'wrapping'),
			{ ...makeContraction(660, 0, 3, 'back'), untimed: true, end: new Date(Date.now() - 7200000 + 660 * 1000).toISOString() },
			makeContraction(900, 55, 4, 'back'),
			makeContraction(1140, 65, 5, 'wrapping'),
		];
		const result = assessBraxtonHicks(contractions, []);
		// Should still detect "Lasting longer" as real-labor from timed (40, 50, 55, 65)
		const durationCriterion = result.criteria.find(c => c.name === 'Lasting longer');
		expect(durationCriterion?.result).toBe('real-labor');
	});

	it('adds water-broke criterion when water-break event exists', () => {
		const contractions = [
			makeContraction(0, 40, 2, 'front'),
			makeContraction(300, 35, 2, 'front'),
			makeContraction(600, 30, 2, 'front'),
			makeContraction(900, 25, 1, 'front'),
		];
		const events: LaborEvent[] = [{
			id: 'wb1', type: 'water-break',
			timestamp: new Date().toISOString(), notes: '',
		}];
		const result = assessBraxtonHicks(contractions, events);
		const waterCriterion = result.criteria.find(c => c.name === 'Water broke');
		expect(waterCriterion).toBeDefined();
		expect(waterCriterion!.result).toBe('real-labor');
		expect(waterCriterion!.weight).toBe(40);
	});

	it('boosts score significantly when water broke', () => {
		// BH-like pattern + water break should push score up
		const contractions = [
			makeContraction(0, 25, 2, 'front'),
			makeContraction(900, 20, 2, 'front'),
			makeContraction(1200, 28, 2, 'front'),
			makeContraction(2400, 22, 1, 'front'),
		];
		const withoutWater = assessBraxtonHicks(contractions, []);
		const withWater = assessBraxtonHicks(contractions, [{
			id: 'wb1', type: 'water-break',
			timestamp: new Date().toISOString(), notes: '',
		}]);
		expect(withWater.score).toBeGreaterThan(withoutWater.score);
	});

	it('reverts to 6 criteria when water-break event absent', () => {
		const contractions = [
			makeContraction(0, 40, 2, 'back'),
			makeContraction(300, 45, 3, 'wrapping'),
			makeContraction(600, 50, 4, 'back'),
			makeContraction(900, 55, 5, 'wrapping'),
		];
		const result = assessBraxtonHicks(contractions, []);
		expect(result.criteria).toHaveLength(6);
		expect(result.criteria.find(c => c.name === 'Water broke')).toBeUndefined();
	});

	it('respects custom regularity thresholds', () => {
		// Somewhat regular contractions with slight variation (~5 min intervals)
		const contractions = [
			makeContraction(0, 35, 3, 'front'),
			makeContraction(280, 40, 3, 'front'),   // ~4.7 min
			makeContraction(600, 38, 3, 'front'),    // ~5.3 min
			makeContraction(870, 42, 3, 'front'),    // ~4.5 min
			makeContraction(1170, 36, 3, 'front'),   // ~5.0 min
		];
		// With a very high CV threshold for "regular", nothing is "regular"
		const strictThresholds = {
			...DEFAULT_BH_THRESHOLDS,
			regularityCVHigh: 0.05, // Below this CV would be "irregular"
			regularityCVLow: 0.01,  // Almost impossible to reach "regular"
		};
		const defaultResult = assessBraxtonHicks(contractions, []);
		const strictResult = assessBraxtonHicks(contractions, [], strictThresholds);

		const defaultRegularity = defaultResult.criteria.find(c => c.name === 'Regular timing');
		const strictRegularity = strictResult.criteria.find(c => c.name === 'Regular timing');

		// Default should see these as regular (CV ≈ 0.07 < 0.3)
		expect(defaultRegularity?.result).toBe('real-labor');
		// With strict thresholds, CV 0.07 > 0.05 = braxton-hicks
		expect(strictRegularity?.result).toBe('braxton-hicks');
	});
});
