import { describe, it, expect } from 'bun:test';
import type { Contraction, ThresholdConfig } from '../src/types';
import { DEFAULT_STAGE_THRESHOLDS } from '../src/types';
import {
	isContractionActive,
	getDurationSeconds,
	getIntervalMinutes,
	getSessionStats,
	check511Rule,
	estimateStage,
	getRestBetween,
	getTrend,
	getTimeInCurrentStage,
	estimateTimeTo511,
	getSessionFilteredIntervals,
	getLatestSession,
} from '../src/data/calculations';

const defaultThreshold: ThresholdConfig = {
	intervalMinutes: 5,
	durationSeconds: 60,
	sustainedMinutes: 60,
};

function makeContraction(
	startOffset: number,
	durationSec: number,
	intensity: number | null = 3,
	baseTime: number = Date.now() - 3600000 // 1 hour ago
): Contraction {
	const start = new Date(baseTime + startOffset * 1000).toISOString();
	const end = new Date(baseTime + (startOffset + durationSec) * 1000).toISOString();
	return {
		id: Math.random().toString(36).substring(2, 8),
		start,
		end,
		intensity,
		location: null,
		notes: '',
	};
}

function makeActiveContraction(startOffset: number, baseTime: number = Date.now() - 60000): Contraction {
	return {
		id: Math.random().toString(36).substring(2, 8),
		start: new Date(baseTime + startOffset * 1000).toISOString(),
		end: null,
		intensity: null,
		location: null,
		notes: '',
	};
}

describe('isContractionActive', () => {
	it('returns true for contraction with null end', () => {
		expect(isContractionActive(makeActiveContraction(0))).toBe(true);
	});

	it('returns false for completed contraction', () => {
		expect(isContractionActive(makeContraction(0, 60))).toBe(false);
	});
});

describe('getDurationSeconds', () => {
	it('returns duration in seconds', () => {
		const c = makeContraction(0, 60);
		expect(getDurationSeconds(c)).toBe(60);
	});

	it('returns 0 for active contraction', () => {
		const c = makeActiveContraction(0);
		expect(getDurationSeconds(c)).toBe(0);
	});

	it('handles short contractions', () => {
		const c = makeContraction(0, 30);
		expect(getDurationSeconds(c)).toBe(30);
	});

	it('handles long contractions', () => {
		const c = makeContraction(0, 90);
		expect(getDurationSeconds(c)).toBe(90);
	});
});

describe('getIntervalMinutes', () => {
	it('returns interval between two contractions', () => {
		const c1 = makeContraction(0, 60);
		const c2 = makeContraction(300, 60); // 5 minutes later
		expect(getIntervalMinutes(c2, c1)).toBeCloseTo(5, 1);
	});

	it('handles short intervals', () => {
		const c1 = makeContraction(0, 60);
		const c2 = makeContraction(120, 60); // 2 minutes later
		expect(getIntervalMinutes(c2, c1)).toBeCloseTo(2, 1);
	});
});

describe('getSessionStats', () => {
	it('returns zeros for empty contractions', () => {
		const stats = getSessionStats([], defaultThreshold);
		expect(stats.totalContractions).toBe(0);
		expect(stats.avgDurationSec).toBe(0);
		expect(stats.avgIntervalMin).toBe(0);
	});

	it('calculates stats for one contraction', () => {
		const contractions = [makeContraction(0, 45)];
		const stats = getSessionStats(contractions, defaultThreshold);
		expect(stats.totalContractions).toBe(1);
		expect(stats.avgDurationSec).toBe(45);
		expect(stats.avgIntervalMin).toBe(0); // No interval with 1 contraction
	});

	it('calculates stats for multiple contractions', () => {
		const contractions = [
			makeContraction(0, 45),
			makeContraction(300, 55), // 5 min later
			makeContraction(600, 50), // 5 min later
		];
		const stats = getSessionStats(contractions, defaultThreshold);
		expect(stats.totalContractions).toBe(3);
		expect(stats.avgDurationSec).toBe(50);
		expect(stats.avgIntervalMin).toBe(5);
	});

	it('ignores active contractions in stats', () => {
		const contractions = [
			makeContraction(0, 45),
			makeActiveContraction(300),
		];
		const stats = getSessionStats(contractions, defaultThreshold);
		expect(stats.totalContractions).toBe(1);
	});
});

describe('check511Rule', () => {
	it('returns not met for fewer than 3 contractions', () => {
		const contractions = [
			makeContraction(0, 60),
			makeContraction(300, 60),
		];
		const result = check511Rule(contractions, defaultThreshold);
		expect(result.met).toBe(false);
	});

	it('detects when interval and duration criteria are met', () => {
		// Contractions 4 minutes apart, 65 seconds long, within last hour
		const now = Date.now();
		const contractions = [
			makeContraction(0, 65, 3, now - 3600000),
			makeContraction(240, 65, 3, now - 3600000),
			makeContraction(480, 65, 3, now - 3600000),
			makeContraction(720, 65, 3, now - 3600000),
		];
		const result = check511Rule(contractions, defaultThreshold);
		expect(result.progress.intervalOk).toBe(true);
		expect(result.progress.durationOk).toBe(true);
	});

	it('returns not met when interval is too long', () => {
		const now = Date.now();
		const contractions = [
			makeContraction(0, 65, 3, now - 3600000),
			makeContraction(600, 65, 3, now - 3600000), // 10 min apart
			makeContraction(1200, 65, 3, now - 3600000),
		];
		const result = check511Rule(contractions, defaultThreshold);
		expect(result.progress.intervalOk).toBe(false);
	});

	it('returns not met when duration is too short', () => {
		const now = Date.now();
		const contractions = [
			makeContraction(0, 30, 3, now - 3600000), // 30 sec (below 60)
			makeContraction(300, 30, 3, now - 3600000),
			makeContraction(600, 30, 3, now - 3600000),
		];
		const result = check511Rule(contractions, defaultThreshold);
		expect(result.progress.durationOk).toBe(false);
	});

	it('includes actual values in progress', () => {
		const now = Date.now();
		const contractions = [
			makeContraction(0, 50, 3, now - 3600000),
			makeContraction(240, 50, 3, now - 3600000),
			makeContraction(480, 50, 3, now - 3600000),
		];
		const result = check511Rule(contractions, defaultThreshold);
		expect(result.progress.intervalValue).toBeCloseTo(4, 0);
		expect(result.progress.durationValue).toBeCloseTo(50, 0);
		expect(result.progress.sustainedValue).toBeGreaterThan(0);
	});
});

describe('estimateStage', () => {
	it('returns null for fewer than 2 contractions', () => {
		const contractions = [makeContraction(0, 45)];
		expect(estimateStage(contractions)).toBeNull();
	});

	it('returns pre-labor for irregular long intervals', () => {
		const contractions = [
			makeContraction(0, 25),
			makeContraction(1200, 25), // 20 min apart, 25s each
		];
		expect(estimateStage(contractions)).toBe('pre-labor');
	});

	it('returns early for 5-30 min intervals, 30-45s durations', () => {
		const contractions = [
			makeContraction(0, 35),
			makeContraction(480, 40), // 8 min apart
			makeContraction(960, 38),
		];
		expect(estimateStage(contractions)).toBe('early');
	});

	it('returns active for 3-5 min intervals, 45-60s durations', () => {
		const contractions = [
			makeContraction(0, 50),
			makeContraction(240, 55), // 4 min apart
			makeContraction(480, 52),
		];
		expect(estimateStage(contractions)).toBe('active');
	});

	it('returns transition for 1-3 min intervals, 60-90s durations', () => {
		const contractions = [
			makeContraction(0, 70),
			makeContraction(120, 75), // 2 min apart
			makeContraction(240, 80),
		];
		expect(estimateStage(contractions)).toBe('transition');
	});

	it('uses custom thresholds when provided', () => {
		const customThresholds = {
			...DEFAULT_STAGE_THRESHOLDS,
			active: {
				...DEFAULT_STAGE_THRESHOLDS.active,
				maxIntervalMin: 8, // More permissive
				minDurationSec: 35,
			},
		};
		const contractions = [
			makeContraction(0, 40),
			makeContraction(420, 38), // 7 min apart, 38s -- wouldn't be active with defaults
			makeContraction(840, 42),
		];
		expect(estimateStage(contractions, customThresholds)).toBe('active');
		// With defaults, this would be early
		expect(estimateStage(contractions)).toBe('early');
	});
});

describe('getTimeInCurrentStage', () => {
	it('returns null for fewer than 2 contractions', () => {
		const contractions = [makeContraction(0, 45)];
		expect(getTimeInCurrentStage(contractions)).toBeNull();
	});

	it('returns stage and positive minutes for valid data', () => {
		const now = Date.now();
		const contractions = [
			makeContraction(0, 50, 3, now - 1800000), // 30 min ago
			makeContraction(240, 55, 3, now - 1800000), // 4 min apart
			makeContraction(480, 52, 3, now - 1800000),
			makeContraction(720, 53, 3, now - 1800000),
		];
		const result = getTimeInCurrentStage(contractions);
		expect(result).not.toBeNull();
		expect(result!.stage).toBe('active');
		expect(result!.minutesInStage).toBeGreaterThan(0);
	});
});

describe('getRestBetween', () => {
	it('returns rest time between two contractions', () => {
		const c1 = makeContraction(0, 60);   // ends at 60s
		const c2 = makeContraction(120, 60); // starts at 120s
		expect(getRestBetween(c1, c2)).toBeCloseTo(60, 0); // 60s gap
	});

	it('returns 0 for active contraction', () => {
		const c1 = makeActiveContraction(0);
		const c2 = makeContraction(120, 60);
		expect(getRestBetween(c1, c2)).toBe(0);
	});
});

describe('getTrend', () => {
	it('returns null for fewer than 3 values', () => {
		expect(getTrend([1, 2])).toBeNull();
	});

	it('detects decreasing trend', () => {
		const result = getTrend([10, 8, 6, 4, 2]);
		expect(result).not.toBeNull();
		expect(result!.direction).toBe('decreasing');
		expect(result!.slope).toBeLessThan(0);
	});

	it('detects increasing trend', () => {
		const result = getTrend([30, 40, 50, 60, 70]);
		expect(result).not.toBeNull();
		expect(result!.direction).toBe('increasing');
		expect(result!.slope).toBeGreaterThan(0);
	});

	it('detects stable trend', () => {
		const result = getTrend([50, 50, 50, 50]);
		expect(result).not.toBeNull();
		expect(result!.direction).toBe('stable');
	});

	it('returns first and last values', () => {
		const result = getTrend([10, 8, 6]);
		expect(result!.firstValue).toBe(10);
		expect(result!.lastValue).toBe(6);
	});
});

describe('estimateTimeTo511', () => {
	it('does not return 0 for widely spaced contractions', () => {
		// Bug: contractions 47 min apart with duration >= threshold returned 0
		const now = Date.now();
		const contractions = [
			makeContraction(0, 65, 3, now - 3600000 * 4),
			makeContraction(2820, 65, 3, now - 3600000 * 4), // 47 min later
			makeContraction(5640, 65, 3, now - 3600000 * 4),
			makeContraction(8460, 65, 3, now - 3600000 * 4),
		];
		const result = estimateTimeTo511(contractions, defaultThreshold);
		// With 47-min intervals and 5-min threshold, should NOT be 0
		expect(result === null || result > 0).toBe(true);
	});

	it('returns 0 when averages truly meet all criteria', () => {
		const now = Date.now();
		// Contractions 4 min apart, 65s long, over 60+ minutes
		const contractions: Contraction[] = [];
		for (let i = 0; i < 16; i++) {
			contractions.push(makeContraction(i * 240, 65, 3, now - 3600000 * 2));
		}
		const result = estimateTimeTo511(contractions, defaultThreshold);
		expect(result).toBe(0);
	});

	it('returns null for fewer than 4 contractions', () => {
		const contractions = [
			makeContraction(0, 65),
			makeContraction(300, 65),
			makeContraction(600, 65),
		];
		expect(estimateTimeTo511(contractions, defaultThreshold)).toBeNull();
	});
});

describe('getSessionFilteredIntervals', () => {
	it('excludes gaps larger than threshold', () => {
		const base = Date.now() - 7200000;
		const contractions = [
			makeContraction(0, 60, 3, base),
			makeContraction(300, 60, 3, base),       // 5 min gap
			makeContraction(300 + 42780, 60, 3, base), // 713 min gap (session break)
			makeContraction(300 + 42780 + 240, 60, 3, base), // 4 min gap
		];
		const intervals = getSessionFilteredIntervals(contractions, 30);
		// Only the 5 min and 4 min intervals should remain
		expect(intervals).toHaveLength(2);
		expect(intervals[0]).toBeCloseTo(5, 0);
		expect(intervals[1]).toBeCloseTo(4, 0);
	});

	it('keeps all intervals when below threshold', () => {
		const base = Date.now() - 3600000;
		const contractions = [
			makeContraction(0, 60, 3, base),
			makeContraction(300, 60, 3, base),  // 5 min
			makeContraction(600, 60, 3, base),  // 5 min
		];
		const intervals = getSessionFilteredIntervals(contractions, 30);
		expect(intervals).toHaveLength(2);
	});

	it('returns empty array for empty input', () => {
		expect(getSessionFilteredIntervals([], 30)).toHaveLength(0);
	});

	it('keeps all intervals when threshold is 0', () => {
		const base = Date.now() - 7200000;
		const contractions = [
			makeContraction(0, 60, 3, base),
			makeContraction(300, 60, 3, base),
			makeContraction(300 + 42780, 60, 3, base), // big gap
		];
		const intervals = getSessionFilteredIntervals(contractions, 0);
		expect(intervals).toHaveLength(2); // all intervals kept
	});
});

describe('getLatestSession', () => {
	it('returns contractions after the last big gap', () => {
		const base = Date.now() - 7200000;
		const contractions = [
			makeContraction(0, 60, 3, base),
			makeContraction(300, 60, 3, base),           // session 1
			makeContraction(300 + 42780, 60, 3, base),   // session 2 starts
			makeContraction(300 + 42780 + 240, 60, 3, base),
			makeContraction(300 + 42780 + 480, 60, 3, base),
		];
		const session = getLatestSession(contractions, 30);
		expect(session).toHaveLength(3);
		expect(session[0].start).toBe(contractions[2].start);
	});

	it('returns all contractions when no gaps exceed threshold', () => {
		const base = Date.now() - 3600000;
		const contractions = [
			makeContraction(0, 60, 3, base),
			makeContraction(300, 60, 3, base),
			makeContraction(600, 60, 3, base),
		];
		const session = getLatestSession(contractions, 30);
		expect(session).toHaveLength(3);
	});

	it('returns empty array for empty input', () => {
		expect(getLatestSession([], 30)).toHaveLength(0);
	});

	it('returns all contractions when threshold is 0', () => {
		const base = Date.now() - 7200000;
		const contractions = [
			makeContraction(0, 60, 3, base),
			makeContraction(300 + 42780, 60, 3, base), // big gap
		];
		const session = getLatestSession(contractions, 0);
		expect(session).toHaveLength(2);
	});
});
