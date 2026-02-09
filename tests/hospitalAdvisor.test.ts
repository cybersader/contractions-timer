import { describe, it, expect } from 'bun:test';
import type { SessionStats, HospitalAdvisorConfig, LaborEvent } from '../src/types';
import { DEFAULT_STAGE_THRESHOLDS } from '../src/types';
import { getDepartureAdvice } from '../src/data/hospitalAdvisor';
import type { Contraction } from '../src/types';

const defaultConfig: HospitalAdvisorConfig = {
	travelTimeMinutes: 30,
	riskAppetite: 'moderate',
	providerPhone: '',
};

function makeContraction(
	startOffset: number,
	durationSec: number,
	baseTime: number = Date.now() - 3600000
): Contraction {
	return {
		id: Math.random().toString(36).substring(2, 8),
		start: new Date(baseTime + startOffset * 1000).toISOString(),
		end: new Date(baseTime + (startOffset + durationSec) * 1000).toISOString(),
		intensity: 3,
		location: null,
		notes: '',
	};
}

function makeStats(overrides: Partial<SessionStats> = {}): SessionStats {
	return {
		totalContractions: 5,
		avgDurationSec: 50,
		avgIntervalMin: 5,
		lastDurationSec: 55,
		lastIntervalMin: 4.5,
		rule511Met: false,
		rule511MetAt: null,
		rule511Progress: {
			intervalOk: false, intervalValue: 5,
			durationOk: false, durationValue: 50,
			sustainedOk: false, sustainedValue: 30,
		},
		laborStage: 'early',
		...overrides,
	};
}

describe('getDepartureAdvice', () => {
	it('returns not-yet for pre-labor', () => {
		const stats = makeStats({ laborStage: 'pre-labor' });
		const contractions = [makeContraction(0, 25), makeContraction(1200, 25)];
		const result = getDepartureAdvice(contractions, [], stats, defaultConfig, DEFAULT_STAGE_THRESHOLDS, null);
		expect(result.urgency).toBe('not-yet');
	});

	it('returns go-now for transition', () => {
		const stats = makeStats({ laborStage: 'transition' });
		const contractions = [
			makeContraction(0, 70), makeContraction(120, 75),
			makeContraction(240, 80), makeContraction(360, 85),
		];
		const result = getDepartureAdvice(contractions, [], stats, defaultConfig, DEFAULT_STAGE_THRESHOLDS, null);
		expect(result.urgency).toBe('go-now');
	});

	it('escalates with water break', () => {
		const stats = makeStats({ laborStage: 'early' });
		const events: LaborEvent[] = [{
			id: 'wb1', type: 'water-break',
			timestamp: new Date().toISOString(), notes: '',
		}];
		const contractions = [makeContraction(0, 35), makeContraction(480, 40)];
		const result = getDepartureAdvice(contractions, events, stats, defaultConfig, DEFAULT_STAGE_THRESHOLDS, null);
		expect(result.urgency).toBe('start-preparing');
	});

	it('conservative leaves earlier than relaxed', () => {
		const stats = makeStats({ laborStage: 'active' });
		const contractions = [
			makeContraction(0, 50), makeContraction(240, 55),
			makeContraction(480, 52), makeContraction(720, 53),
		];

		const conservative = getDepartureAdvice(
			contractions, [], stats,
			{ ...defaultConfig, riskAppetite: 'conservative' },
			DEFAULT_STAGE_THRESHOLDS, null
		);
		const relaxed = getDepartureAdvice(
			contractions, [], stats,
			{ ...defaultConfig, riskAppetite: 'relaxed' },
			DEFAULT_STAGE_THRESHOLDS, null
		);

		const urgencyOrder = ['not-yet', 'start-preparing', 'time-to-go', 'go-now'];
		expect(urgencyOrder.indexOf(conservative.urgency)).toBeGreaterThan(
			urgencyOrder.indexOf(relaxed.urgency)
		);
	});

	it('includes factors in advice', () => {
		const stats = makeStats({ laborStage: 'active', avgIntervalMin: 4.2 });
		const contractions = [
			makeContraction(0, 50), makeContraction(240, 55),
			makeContraction(480, 52), makeContraction(720, 53),
		];
		const result = getDepartureAdvice(contractions, [], stats, defaultConfig, DEFAULT_STAGE_THRESHOLDS, null);
		expect(result.factors.length).toBeGreaterThan(0);
		expect(result.factors.some(f => f.includes('Travel time'))).toBe(true);
	});

	it('does not over-escalate widely spaced contractions', () => {
		// Contractions 47 min apart should NOT trigger "start-preparing"
		const stats = makeStats({
			laborStage: 'pre-labor',
			avgIntervalMin: 47,
			avgDurationSec: 65,
		});
		const contractions = [
			makeContraction(0, 65),
			makeContraction(2820, 65), // 47 min later
			makeContraction(5640, 65), // 47 min later
			makeContraction(8460, 65), // 47 min later
		];
		// estimatedTimeTo511 should NOT be 0 for 47-min-apart contractions
		// Even if duration meets threshold, interval is way too large
		const result = getDepartureAdvice(
			contractions, [], stats, defaultConfig, DEFAULT_STAGE_THRESHOLDS, null
		);
		expect(result.urgency).toBe('not-yet');
	});

	it('returns time-to-go when 511 met on moderate', () => {
		const stats = makeStats({
			laborStage: 'active',
			rule511Met: true,
			rule511MetAt: new Date().toISOString(),
		});
		const contractions = [
			makeContraction(0, 65), makeContraction(240, 65),
			makeContraction(480, 65), makeContraction(720, 65),
		];
		const result = getDepartureAdvice(contractions, [], stats, defaultConfig, DEFAULT_STAGE_THRESHOLDS, null);
		expect(result.urgency).toBe('time-to-go');
	});
});
