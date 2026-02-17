import type { Contraction, LaborEvent, SessionStats, HospitalAdvisorConfig, StageThresholdConfig, LaborStage, ProgressionRate } from './types';
import { getTrend, getIntervalMinutes, getDurationSeconds } from './calculations';

export interface I18nMessage {
	key: string;
	values?: Record<string, string | number>;
}

export type DepartureUrgency = 'not-yet' | 'start-preparing' | 'time-to-go' | 'go-now';

export interface DepartureAdvice {
	urgency: DepartureUrgency;
	headline: I18nMessage;
	detail: I18nMessage;
	bufferMinutes: number | null;
	estimatedDepartureTime: Date | null;
	factors: I18nMessage[];
}

export interface RangeEstimate {
	earliestMinutes: number;
	likelyMinutes: number;
	latestMinutes: number;
	confidence: 'low' | 'medium' | 'high';
	recommendation: I18nMessage;
	patternSummary: I18nMessage;
	trendSummary: I18nMessage | null;
	factors: I18nMessage[];
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
	const factors: I18nMessage[] = [];
	const mult = RATE_MULTIPLIERS[progressionRate];
	// When travel time is uncertain, don't assume — show arrival range and let user add travel
	const effectiveTravel = config.travelTimeUncertain ? 0 : config.travelTimeMinutes;

	let confidence: RangeEstimate['confidence'] = 'low';
	if (completed.length >= 10) confidence = 'high';
	else if (completed.length >= 6) confidence = 'medium';

	const patternSummary: I18nMessage = stats.avgIntervalMin > 0
		? { key: 'hospital.advisor.pattern.summary', values: { interval: stats.avgIntervalMin.toFixed(0), duration: Math.round(stats.avgDurationSec) } }
		: { key: 'hospital.advisor.pattern.notEnoughData' };

	let trendSummary: I18nMessage | null = null;
	if (completed.length >= 4) {
		const intervals: number[] = [];
		for (let i = 1; i < completed.length; i++) {
			intervals.push(getIntervalMinutes(completed[i], completed[i - 1]));
		}
		const trend = getTrend(intervals);
		if (trend) {
			if (trend.direction === 'decreasing') {
				trendSummary = { key: 'hospital.advisor.trend.gettingCloser', values: { first: trend.firstValue.toFixed(0), last: trend.lastValue.toFixed(0) } };
			} else if (trend.direction === 'increasing') {
				trendSummary = { key: 'hospital.advisor.trend.spacingOut', values: { first: trend.firstValue.toFixed(0), last: trend.lastValue.toFixed(0) } };
			} else {
				trendSummary = { key: 'hospital.advisor.trend.steadyPace', values: { avg: stats.avgIntervalMin.toFixed(0) } };
			}
		}
	}

	if (hasWaterBreak) factors.push({ key: 'hospital.advisor.factors.waterBroken' });
	if (config.travelTimeUncertain) {
		factors.push({ key: 'hospital.advisor.factors.travelUnknownAddOwn' });
	} else if (config.travelTimeMinutes > 0) {
		factors.push({ key: 'hospital.advisor.factors.travelAccounted', values: { minutes: config.travelTimeMinutes } });
	}
	factors.push({ key: 'hospital.advisor.factors.assumedProgression', values: { rate: progressionRate } });

	if (completed.length < 3 || !stats.laborStage) {
		return {
			earliestMinutes: 0, likelyMinutes: 0, latestMinutes: 0,
			confidence: 'low',
			recommendation: { key: 'hospital.advisor.recommendations.keepTracking' },
			patternSummary, trendSummary,
			factors: [{ key: 'hospital.advisor.factors.fewerThan3' }],
		};
	}

	if (stats.laborStage === 'transition') {
		return {
			earliestMinutes: 0, likelyMinutes: 0, latestMinutes: 0,
			confidence,
			recommendation: hasWaterBreak
				? { key: 'hospital.advisor.recommendations.goNow' }
				: { key: 'hospital.advisor.recommendations.shouldBeAtHospital' },
			patternSummary, trendSummary, factors,
		};
	}

	if (stats.laborStage === 'active' && hasWaterBreak) {
		return {
			earliestMinutes: 0, likelyMinutes: 0, latestMinutes: Math.round(30 * mult.slow),
			confidence,
			recommendation: { key: 'hospital.advisor.recommendations.headToHospital' },
			patternSummary, trendSummary, factors,
		};
	}

	if (stats.rule511Met) {
		return {
			earliestMinutes: 0, likelyMinutes: effectiveTravel, latestMinutes: effectiveTravel + 30,
			confidence,
			recommendation: effectiveTravel > 0
				? { key: 'hospital.advisor.recommendations.planToArriveWithin', values: { minutes: effectiveTravel } }
				: { key: 'hospital.advisor.recommendations.planSoon' },
			patternSummary, trendSummary,
			factors: [...factors, { key: 'hospital.advisor.factors.rule511Pattern' }],
		};
	}

	if (estimatedTimeTo511 !== null && estimatedTimeTo511 > 0) {
		const base = estimatedTimeTo511;
		const earliest = Math.round(base * mult.fast);
		const likely = Math.round(base * mult.avg);
		const latest = Math.round(base * mult.slow);

		const recommendation: I18nMessage = effectiveTravel > 0
			? { key: 'hospital.advisor.recommendations.planWithinRange', values: { range: formatRange(earliest, latest) } }
			: { key: 'hospital.advisor.recommendations.estimatedRange', values: { range: formatRange(earliest, latest) } };

		return {
			earliestMinutes: Math.max(0, earliest - effectiveTravel),
			likelyMinutes: Math.max(0, likely - effectiveTravel),
			latestMinutes: Math.max(0, latest - effectiveTravel),
			confidence, recommendation, patternSummary, trendSummary, factors,
		};
	}

	if (stats.laborStage === 'active') {
		return {
			earliestMinutes: Math.round(30 * mult.fast),
			likelyMinutes: Math.round(60 * mult.avg),
			latestMinutes: Math.round(120 * mult.slow),
			confidence: 'low',
			recommendation: effectiveTravel > 0
				? { key: 'hospital.advisor.recommendations.activeLeaveRange', values: { range: formatRange(30, 120) } }
				: { key: 'hospital.advisor.recommendations.activeBagReady' },
			patternSummary, trendSummary, factors,
		};
	}

	if (stats.laborStage === 'early') {
		return {
			earliestMinutes: Math.round(60 * mult.fast),
			likelyMinutes: Math.round(180 * mult.avg),
			latestMinutes: Math.round(720 * mult.slow),
			confidence: 'low',
			recommendation: { key: 'hospital.advisor.recommendations.earlyStayHome' },
			patternSummary, trendSummary, factors,
		};
	}

	return {
		earliestMinutes: 0, likelyMinutes: 0, latestMinutes: 0,
		confidence: 'low',
		recommendation: { key: 'hospital.advisor.recommendations.irregularContinue' },
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
	const effectiveTravelMinutes = config.travelTimeUncertain ? 0 : config.travelTimeMinutes;
	const { riskAppetite } = config;
	const stage = stats.laborStage;
	const factors: I18nMessage[] = [];

	if (completed.length < 2 || !stage) {
		return {
			urgency: 'not-yet',
			headline: { key: 'hospital.advisor.headlines.keepTracking' },
			detail: { key: 'hospital.advisor.details.notEnoughData' },
			bufferMinutes: null, estimatedDepartureTime: null,
			factors: [{ key: 'hospital.advisor.factors.fewerThan2' }],
		};
	}

	if (stats.avgIntervalMin > 0) factors.push({ key: 'hospital.advisor.factors.intervalApart', values: { interval: stats.avgIntervalMin.toFixed(1) } });
	if (stats.avgDurationSec > 0) factors.push({ key: 'hospital.advisor.factors.avgDuration', values: { duration: Math.round(stats.avgDurationSec) } });
	if (hasWaterBreak) {
		const waterEvent = events.find(e => e.type === 'water-break');
		if (waterEvent) {
			const hoursAgo = (Date.now() - new Date(waterEvent.timestamp).getTime()) / 3600000;
			factors.push({ key: 'hospital.advisor.factors.waterBrokeAgo', values: { hours: hoursAgo.toFixed(1) } });
		}
	}
	if (config.travelTimeUncertain) {
		factors.push({ key: 'hospital.advisor.factors.travelUnknownAddOwn' });
	} else {
		factors.push({ key: 'hospital.advisor.factors.travelTime', values: { minutes: effectiveTravelMinutes } });
	}

	if (stage === 'transition') {
		return {
			urgency: 'go-now',
			headline: { key: 'hospital.advisor.headlines.goNow' },
			detail: { key: 'hospital.advisor.details.transition' },
			bufferMinutes: 0, estimatedDepartureTime: new Date(), factors,
		};
	}

	if (hasWaterBreak && stage === 'active') {
		return {
			urgency: 'time-to-go',
			headline: { key: 'hospital.advisor.headlines.timeToGo' },
			detail: { key: 'hospital.advisor.details.waterAndActive' },
			bufferMinutes: effectiveTravelMinutes,
			estimatedDepartureTime: new Date(Date.now() + effectiveTravelMinutes * 60000), factors,
		};
	}

	if (hasWaterBreak) {
		return {
			urgency: 'start-preparing',
			headline: { key: 'hospital.advisor.headlines.callProvider' },
			detail: { key: 'hospital.advisor.details.waterBroken' },
			bufferMinutes: null, estimatedDepartureTime: null, factors,
		};
	}

	if (stats.rule511Met) {
		const urgencyMap: Record<string, DepartureUrgency> = {
			conservative: 'go-now', moderate: 'time-to-go', relaxed: 'start-preparing',
		};
		const urgency = urgencyMap[riskAppetite] || 'time-to-go';
		const headlineMap: Record<DepartureUrgency, I18nMessage> = {
			'go-now': { key: 'hospital.advisor.headlines.goNow' },
			'time-to-go': { key: 'hospital.advisor.headlines.timeToGo' },
			'start-preparing': { key: 'hospital.advisor.headlines.startPreparing' },
			'not-yet': { key: 'hospital.advisor.headlines.notYet' },
		};
		return {
			urgency, headline: headlineMap[urgency],
			detail: { key: 'hospital.advisor.details.rule511Met' },
			bufferMinutes: 0, estimatedDepartureTime: new Date(),
			factors: [...factors, { key: 'hospital.advisor.factors.rule511Met' }],
		};
	}

	if (estimatedTimeTo511 !== null && estimatedTimeTo511 < 60) {
		const buffer = estimatedTimeTo511 - effectiveTravelMinutes;

		if (riskAppetite === 'conservative') {
			return {
				urgency: 'time-to-go',
				headline: { key: 'hospital.advisor.headlines.timeToGo' },
				detail: { key: 'hospital.advisor.details.estimatedLeaveSoon', values: { minutes: estimatedTimeTo511 } },
				bufferMinutes: Math.max(0, buffer),
				estimatedDepartureTime: new Date(Date.now() + Math.max(0, buffer) * 60000),
				factors: [...factors, { key: 'hospital.advisor.factors.timeTo511', values: { minutes: estimatedTimeTo511 } }],
			};
		}
		if (riskAppetite === 'moderate') {
			return {
				urgency: 'start-preparing',
				headline: { key: 'hospital.advisor.headlines.startPreparing' },
				detail: { key: 'hospital.advisor.details.progressing', values: { minutes: estimatedTimeTo511 } },
				bufferMinutes: Math.max(0, buffer),
				estimatedDepartureTime: new Date(Date.now() + Math.max(0, buffer) * 60000),
				factors: [...factors, { key: 'hospital.advisor.factors.timeTo511', values: { minutes: estimatedTimeTo511 } }],
			};
		}
		return {
			urgency: 'not-yet',
			headline: { key: 'hospital.advisor.headlines.notYet' },
			detail: { key: 'hospital.advisor.details.progressing', values: { minutes: estimatedTimeTo511 } },
			bufferMinutes: Math.max(0, buffer), estimatedDepartureTime: null,
			factors: [...factors, { key: 'hospital.advisor.factors.timeTo511', values: { minutes: estimatedTimeTo511 } }],
		};
	}

	if (stage === 'active') {
		const urgencyMap: Record<string, DepartureUrgency> = {
			conservative: 'time-to-go', moderate: 'start-preparing', relaxed: 'not-yet',
		};
		const urgency = urgencyMap[riskAppetite] || 'start-preparing';
		const headlineMap: Record<DepartureUrgency, I18nMessage> = {
			'go-now': { key: 'hospital.advisor.headlines.goNow' },
			'time-to-go': { key: 'hospital.advisor.headlines.timeToGo' },
			'start-preparing': { key: 'hospital.advisor.headlines.startPreparing' },
			'not-yet': { key: 'hospital.advisor.headlines.notYet' },
		};
		return {
			urgency, headline: headlineMap[urgency],
			detail: { key: 'hospital.advisor.details.activeLabor' },
			bufferMinutes: null, estimatedDepartureTime: null, factors,
		};
	}

	if (stage === 'early') {
		const urgency: DepartureUrgency = riskAppetite === 'conservative' ? 'start-preparing' : 'not-yet';
		return {
			urgency,
			headline: urgency === 'start-preparing'
				? { key: 'hospital.advisor.headlines.startPreparing' }
				: { key: 'hospital.advisor.headlines.stayComfortable' },
			detail: { key: 'hospital.advisor.details.earlyLabor' },
			bufferMinutes: null, estimatedDepartureTime: null, factors,
		};
	}

	return {
		urgency: 'not-yet',
		headline: { key: 'hospital.advisor.headlines.stayComfortable' },
		detail: { key: 'hospital.advisor.details.irregular' },
		bufferMinutes: null, estimatedDepartureTime: null, factors,
	};
}
