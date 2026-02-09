import type { Contraction, LaborEvent, SessionStats, HospitalAdvisorConfig, StageThresholdConfig, LaborStage, ProgressionRate } from './types';
import { getTrend, getIntervalMinutes, getDurationSeconds } from './calculations';

export type DepartureUrgency = 'not-yet' | 'start-preparing' | 'time-to-go' | 'go-now';

export interface DepartureAdvice {
	urgency: DepartureUrgency;
	headline: string;
	detail: string;
	bufferMinutes: number | null;
	estimatedDepartureTime: Date | null;
	factors: string[];
}

export interface RangeEstimate {
	earliestMinutes: number;
	likelyMinutes: number;
	latestMinutes: number;
	confidence: 'low' | 'medium' | 'high';
	recommendation: string;
	patternSummary: string;
	trendSummary: string | null;
	factors: string[];
}

const RATE_MULTIPLIERS: Record<ProgressionRate, { fast: number; avg: number; slow: number }> = {
	faster: { fast: 0.6, avg: 0.8, slow: 1.2 },
	average: { fast: 0.7, avg: 1.0, slow: 1.5 },
	slower: { fast: 0.8, avg: 1.2, slow: 2.0 },
};

export function getRangeEstimate(
	contractions: Contraction[],
	events: LaborEvent[],
	stats: SessionStats,
	config: HospitalAdvisorConfig,
	progressionRate: ProgressionRate,
	estimatedTimeTo511: number | null
): RangeEstimate {
	const completed = contractions.filter(c => c.end !== null);
	const hasWaterBreak = events.some(e => e.type === 'water-break');
	const factors: string[] = [];
	const mult = RATE_MULTIPLIERS[progressionRate];

	let confidence: RangeEstimate['confidence'] = 'low';
	if (completed.length >= 10) confidence = 'high';
	else if (completed.length >= 6) confidence = 'medium';

	const patternSummary = stats.avgIntervalMin > 0
		? `Contractions ~${stats.avgIntervalMin.toFixed(0)} min apart, ~${Math.round(stats.avgDurationSec)}s each`
		: 'Not enough data for pattern analysis';

	let trendSummary: string | null = null;
	if (completed.length >= 4) {
		const intervals: number[] = [];
		for (let i = 1; i < completed.length; i++) {
			intervals.push(getIntervalMinutes(completed[i], completed[i - 1]));
		}
		const trend = getTrend(intervals);
		if (trend) {
			if (trend.direction === 'decreasing') {
				trendSummary = `Intervals getting shorter (${trend.firstValue.toFixed(0)} min \u2192 ${trend.lastValue.toFixed(0)} min)`;
			} else if (trend.direction === 'increasing') {
				trendSummary = `Intervals getting longer (${trend.firstValue.toFixed(0)} min \u2192 ${trend.lastValue.toFixed(0)} min)`;
			} else {
				trendSummary = `Intervals steady around ~${stats.avgIntervalMin.toFixed(0)} min`;
			}
		}
	}

	if (hasWaterBreak) factors.push('Water has broken');
	if (config.travelTimeMinutes > 0) {
		factors.push(`${config.travelTimeMinutes} min travel time accounted for`);
	}
	factors.push(`Assumed progression: ${progressionRate}`);

	if (completed.length < 3 || !stats.laborStage) {
		return {
			earliestMinutes: 0, likelyMinutes: 0, latestMinutes: 0,
			confidence: 'low',
			recommendation: 'Keep tracking to build a pattern',
			patternSummary, trendSummary,
			factors: ['Fewer than 3 contractions recorded'],
		};
	}

	if (stats.laborStage === 'transition') {
		return {
			earliestMinutes: 0, likelyMinutes: 0, latestMinutes: 0,
			confidence,
			recommendation: hasWaterBreak ? 'Go to hospital now' : 'You should be at the hospital',
			patternSummary, trendSummary, factors,
		};
	}

	if (stats.laborStage === 'active' && hasWaterBreak) {
		return {
			earliestMinutes: 0, likelyMinutes: 0, latestMinutes: Math.round(30 * mult.slow),
			confidence,
			recommendation: 'Head to hospital now',
			patternSummary, trendSummary, factors,
		};
	}

	if (stats.rule511Met) {
		const travel = config.travelTimeMinutes;
		return {
			earliestMinutes: 0, likelyMinutes: travel, latestMinutes: travel + 30,
			confidence,
			recommendation: travel > 0 ? `Plan to arrive within ${travel} min` : 'Plan to be at hospital soon',
			patternSummary, trendSummary,
			factors: [...factors, '5-1-1 pattern is met'],
		};
	}

	if (estimatedTimeTo511 !== null && estimatedTimeTo511 > 0) {
		const base = estimatedTimeTo511;
		const earliest = Math.round(base * mult.fast);
		const likely = Math.round(base * mult.avg);
		const latest = Math.round(base * mult.slow);
		const travel = config.travelTimeMinutes;

		const recommendation = travel > 0
			? `Plan to be at hospital within ~${formatRange(earliest, latest)}`
			: `Estimated ~${formatRange(earliest, latest)} until hospital-worthy pattern`;

		return {
			earliestMinutes: Math.max(0, earliest - travel),
			likelyMinutes: Math.max(0, likely - travel),
			latestMinutes: Math.max(0, latest - travel),
			confidence, recommendation, patternSummary, trendSummary, factors,
		};
	}

	if (stats.laborStage === 'active') {
		const travel = config.travelTimeMinutes;
		return {
			earliestMinutes: Math.round(30 * mult.fast),
			likelyMinutes: Math.round(60 * mult.avg),
			latestMinutes: Math.round(120 * mult.slow),
			confidence: 'low',
			recommendation: travel > 0
				? `Active labor \u2014 plan to leave within ~${formatRange(30, 120)}`
				: 'Active labor \u2014 have your hospital bag ready',
			patternSummary, trendSummary, factors,
		};
	}

	if (stats.laborStage === 'early') {
		return {
			earliestMinutes: Math.round(60 * mult.fast),
			likelyMinutes: Math.round(180 * mult.avg),
			latestMinutes: Math.round(720 * mult.slow),
			confidence: 'low',
			recommendation: 'Early labor \u2014 stay home, rest, and hydrate',
			patternSummary, trendSummary, factors,
		};
	}

	return {
		earliestMinutes: 0, likelyMinutes: 0, latestMinutes: 0,
		confidence: 'low',
		recommendation: 'Contractions are irregular \u2014 continue normal activities',
		patternSummary, trendSummary, factors,
	};
}

function formatRange(minMin: number, maxMin: number): string {
	if (minMin <= 0 && maxMin <= 0) return 'now';
	const formatUnit = (m: number) => {
		if (m < 60) return `${m} min`;
		const h = m / 60;
		return h === Math.floor(h) ? `${h}h` : `${h.toFixed(1)}h`;
	};
	if (minMin === maxMin) return formatUnit(minMin);
	return `${formatUnit(minMin)} \u2013 ${formatUnit(maxMin)}`;
}

export function getDepartureAdvice(
	contractions: Contraction[],
	events: LaborEvent[],
	stats: SessionStats,
	config: HospitalAdvisorConfig,
	stageThresholds: Record<string, StageThresholdConfig>,
	estimatedTimeTo511: number | null
): DepartureAdvice {
	const completed = contractions.filter(c => c.end !== null);
	const hasWaterBreak = events.some(e => e.type === 'water-break');
	const { travelTimeMinutes, riskAppetite } = config;
	const stage = stats.laborStage;
	const factors: string[] = [];

	if (completed.length < 2 || !stage) {
		return {
			urgency: 'not-yet', headline: 'Keep tracking',
			detail: 'Not enough data yet to assess. Keep timing contractions to build a pattern.',
			bufferMinutes: null, estimatedDepartureTime: null,
			factors: ['Fewer than 2 completed contractions'],
		};
	}

	if (stats.avgIntervalMin > 0) factors.push(`Contractions ~${stats.avgIntervalMin.toFixed(1)} min apart`);
	if (stats.avgDurationSec > 0) factors.push(`~${Math.round(stats.avgDurationSec)}s avg duration`);
	if (hasWaterBreak) {
		const waterEvent = events.find(e => e.type === 'water-break');
		if (waterEvent) {
			const hoursAgo = (Date.now() - new Date(waterEvent.timestamp).getTime()) / 3600000;
			factors.push(`Water broke ${hoursAgo.toFixed(1)} hours ago`);
		}
	}
	factors.push(`Travel time: ${travelTimeMinutes} min`);

	if (stage === 'transition') {
		return {
			urgency: 'go-now', headline: 'Go now',
			detail: 'You appear to be in transition. If you are not at the hospital, go immediately.',
			bufferMinutes: 0, estimatedDepartureTime: new Date(), factors,
		};
	}

	if (hasWaterBreak && stage === 'active') {
		return {
			urgency: 'time-to-go', headline: 'Time to go',
			detail: 'Your water has broken and contractions are active. Call your provider, then head in.',
			bufferMinutes: travelTimeMinutes,
			estimatedDepartureTime: new Date(Date.now() + travelTimeMinutes * 60000), factors,
		};
	}

	if (hasWaterBreak) {
		return {
			urgency: 'start-preparing', headline: 'Call your provider',
			detail: 'Your water has broken. Call your provider \u2014 they will advise whether to come in now or wait.',
			bufferMinutes: null, estimatedDepartureTime: null, factors,
		};
	}

	if (stats.rule511Met) {
		const urgencyMap: Record<string, DepartureUrgency> = {
			conservative: 'go-now', moderate: 'time-to-go', relaxed: 'start-preparing',
		};
		const urgency = urgencyMap[riskAppetite] || 'time-to-go';
		const headlineMap: Record<DepartureUrgency, string> = {
			'go-now': 'Go now', 'time-to-go': 'Time to go',
			'start-preparing': 'Start preparing', 'not-yet': 'Not yet',
		};
		return {
			urgency, headline: headlineMap[urgency],
			detail: 'The 5-1-1 pattern is met. Contractions are regular, close, and sustained.',
			bufferMinutes: 0, estimatedDepartureTime: new Date(),
			factors: [...factors, '5-1-1 rule met'],
		};
	}

	if (estimatedTimeTo511 !== null && estimatedTimeTo511 < 60) {
		const buffer = estimatedTimeTo511 - travelTimeMinutes;

		if (riskAppetite === 'conservative') {
			return {
				urgency: 'time-to-go', headline: 'Time to go',
				detail: `Estimated ${estimatedTimeTo511} min until 5-1-1 pattern. Leave soon.`,
				bufferMinutes: Math.max(0, buffer),
				estimatedDepartureTime: new Date(Date.now() + Math.max(0, buffer) * 60000),
				factors: [...factors, `~${estimatedTimeTo511} min to 5-1-1`],
			};
		}
		if (riskAppetite === 'moderate') {
			return {
				urgency: 'start-preparing', headline: 'Start preparing',
				detail: `Contractions are progressing. Estimated ${estimatedTimeTo511} min until 5-1-1 pattern.`,
				bufferMinutes: Math.max(0, buffer),
				estimatedDepartureTime: new Date(Date.now() + Math.max(0, buffer) * 60000),
				factors: [...factors, `~${estimatedTimeTo511} min to 5-1-1`],
			};
		}
		return {
			urgency: 'not-yet', headline: 'Not yet',
			detail: `Contractions are progressing. Estimated ${estimatedTimeTo511} min until 5-1-1 pattern.`,
			bufferMinutes: Math.max(0, buffer), estimatedDepartureTime: null,
			factors: [...factors, `~${estimatedTimeTo511} min to 5-1-1`],
		};
	}

	if (stage === 'active') {
		const urgencyMap: Record<string, DepartureUrgency> = {
			conservative: 'time-to-go', moderate: 'start-preparing', relaxed: 'not-yet',
		};
		const urgency = urgencyMap[riskAppetite] || 'start-preparing';
		const headlineMap: Record<DepartureUrgency, string> = {
			'go-now': 'Go now', 'time-to-go': 'Time to go',
			'start-preparing': 'Start preparing', 'not-yet': 'Not yet',
		};
		return {
			urgency, headline: headlineMap[urgency],
			detail: 'Contractions suggest active labor. Have your hospital bag ready.',
			bufferMinutes: null, estimatedDepartureTime: null, factors,
		};
	}

	if (stage === 'early') {
		const urgency: DepartureUrgency = riskAppetite === 'conservative' ? 'start-preparing' : 'not-yet';
		return {
			urgency,
			headline: urgency === 'start-preparing' ? 'Start preparing' : 'Stay comfortable',
			detail: 'Early labor can take a while. Stay home, rest, hydrate, and keep timing.',
			bufferMinutes: null, estimatedDepartureTime: null, factors,
		};
	}

	return {
		urgency: 'not-yet', headline: 'Stay comfortable',
		detail: 'Contractions are still irregular. Continue normal activities and keep timing.',
		bufferMinutes: null, estimatedDepartureTime: null, factors,
	};
}
