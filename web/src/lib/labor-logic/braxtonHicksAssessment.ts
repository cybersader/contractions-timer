import type { Contraction, LaborEvent, BHThresholdConfig } from './types';
import { DEFAULT_BH_THRESHOLDS } from './types';
import { getDurationSeconds, getIntervalMinutes, getTrend, getSessionFilteredIntervals } from './calculations';

export interface BHCriterion {
	name: string;
	description: string;
	result: 'braxton-hicks' | 'real-labor' | 'inconclusive';
	weight: number;
	detail: string;
}

export interface BHAssessment {
	score: number;
	verdict: 'likely-braxton-hicks' | 'uncertain' | 'likely-real-labor';
	criteria: BHCriterion[];
	requiresMore: boolean;
}

export function assessBraxtonHicks(
	contractions: Contraction[],
	events: LaborEvent[],
	thresholds: BHThresholdConfig = DEFAULT_BH_THRESHOLDS,
	gapThresholdMin = 0
): BHAssessment {
	const completed = contractions.filter(c => c.end !== null);

	if (completed.length < 4) {
		return { score: 0, verdict: 'uncertain', criteria: [], requiresMore: true };
	}

	const criteria: BHCriterion[] = [];

	const intervals = gapThresholdMin > 0
		? getSessionFilteredIntervals(completed, gapThresholdMin)
		: (() => {
			const iv: number[] = [];
			for (let i = 1; i < completed.length; i++) {
				iv.push(getIntervalMinutes(completed[i], completed[i - 1]));
			}
			return iv;
		})();
	const mean = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
	const variance = intervals.length > 0 ? intervals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / intervals.length : 0;
	const cv = mean > 0 ? Math.sqrt(variance) / mean : Infinity;

	criteria.push({
		name: 'Regular timing',
		description: 'Are contractions coming at regular intervals?',
		result: cv < thresholds.regularityCVLow ? 'real-labor' : cv > thresholds.regularityCVHigh ? 'braxton-hicks' : 'inconclusive',
		weight: 20,
		detail: cv < thresholds.regularityCVLow
			? 'Contractions are coming at predictable intervals'
			: cv > thresholds.regularityCVHigh
				? 'Timing is very irregular \u2014 spacing varies widely'
				: 'Timing is somewhat regular but still varies',
	});

	const intervalTrend = getTrend(intervals);
	criteria.push({
		name: 'Closing gap',
		description: 'Are contractions getting closer together over time?',
		result: intervalTrend?.direction === 'decreasing' ? 'real-labor'
			: intervalTrend?.direction === 'increasing' ? 'braxton-hicks'
				: 'inconclusive',
		weight: 20,
		detail: intervalTrend?.direction === 'decreasing'
			? `Gap shrinking: ${intervalTrend.firstValue.toFixed(0)} min \u2192 ${intervalTrend.lastValue.toFixed(0)} min`
			: intervalTrend?.direction === 'increasing'
				? `Gap growing: ${intervalTrend.firstValue.toFixed(0)} min \u2192 ${intervalTrend.lastValue.toFixed(0)} min`
				: 'Gap staying about the same',
	});

	const timed = completed.filter(c => !c.untimed);
	const durations = timed.map(getDurationSeconds);
	const durationTrend = getTrend(durations);
	criteria.push({
		name: 'Lasting longer',
		description: 'Is each contraction lasting longer than the last?',
		result: durationTrend?.direction === 'increasing' ? 'real-labor'
			: durationTrend?.direction === 'decreasing' ? 'braxton-hicks'
				: 'inconclusive',
		weight: 15,
		detail: durationTrend?.direction === 'increasing'
			? `Lasting longer: ${Math.round(durationTrend.firstValue)}s \u2192 ${Math.round(durationTrend.lastValue)}s`
			: durationTrend?.direction === 'decreasing'
				? `Getting shorter: ${Math.round(durationTrend.firstValue)}s \u2192 ${Math.round(durationTrend.lastValue)}s`
				: 'Lasting about the same',
	});

	const intensities = completed.map(c => c.intensity).filter((i): i is number => i !== null);
	if (intensities.length >= 3) {
		const intensityTrend = getTrend(intensities);
		criteria.push({
			name: 'Growing intensity',
			description: 'Are contractions getting stronger over time?',
			result: intensityTrend?.direction === 'increasing' ? 'real-labor'
				: intensityTrend?.direction === 'decreasing' ? 'braxton-hicks'
					: 'inconclusive',
			weight: 15,
			detail: intensityTrend?.direction === 'increasing'
				? 'Each contraction feels stronger than the last'
				: intensityTrend?.direction === 'decreasing'
					? 'Contractions are getting milder'
					: 'Intensity staying about the same',
		});
	} else {
		criteria.push({
			name: 'Growing intensity',
			description: 'Are contractions getting stronger over time?',
			result: 'inconclusive',
			weight: 15,
			detail: 'Need more intensity ratings',
		});
	}

	const locationsWithData = completed.filter(c => c.location !== null);
	if (locationsWithData.length >= 3) {
		const backOrWrapping = locationsWithData.filter(c => c.location === 'back' || c.location === 'wrapping').length;
		const ratio = backOrWrapping / locationsWithData.length;
		criteria.push({
			name: 'Pain location',
			description: 'Where are contractions felt?',
			result: ratio > thresholds.locationRatioHigh ? 'real-labor' : ratio < thresholds.locationRatioLow ? 'braxton-hicks' : 'inconclusive',
			weight: 15,
			detail: ratio > thresholds.locationRatioHigh
				? `${Math.round(ratio * 100)}% felt in back or wrapping`
				: ratio < thresholds.locationRatioLow
					? 'Mostly felt in front'
					: 'Mixed locations',
		});
	} else {
		criteria.push({
			name: 'Pain location',
			description: 'Where are contractions felt?',
			result: 'inconclusive',
			weight: 15,
			detail: 'Need more location data',
		});
	}

	const firstStart = new Date(completed[0].start).getTime();
	const lastStart = new Date(completed[completed.length - 1].start).getTime();
	const spanMinutes = (lastStart - firstStart) / 60000;

	let maxGap = 0;
	for (let i = 1; i < completed.length; i++) {
		const gap = (new Date(completed[i].start).getTime() - new Date(completed[i - 1].start).getTime()) / 60000;
		if (gap > maxGap) maxGap = gap;
	}
	const sustainedOk = spanMinutes >= thresholds.sustainedMinMinutes && maxGap <= thresholds.sustainedMaxGapMinutes;

	criteria.push({
		name: 'Sustained pattern',
		description: `Have contractions continued for ${Math.round(thresholds.sustainedMinMinutes / 60)}+ hours without long breaks?`,
		result: sustainedOk ? 'real-labor' : spanMinutes < 30 ? 'braxton-hicks' : 'inconclusive',
		weight: 15,
		detail: sustainedOk
			? `Active for ${Math.round(spanMinutes)} min with no break > ${thresholds.sustainedMaxGapMinutes} min`
			: spanMinutes < 30
				? `Only ${Math.round(spanMinutes)} min of tracking so far`
				: `${Math.round(spanMinutes)} min tracked, max gap ${Math.round(maxGap)} min`,
	});

	const hasWaterBreak = events.some(e => e.type === 'water-break');
	if (hasWaterBreak) {
		criteria.push({
			name: 'Water broke',
			description: 'Rupture of membranes (water breaking)',
			result: 'real-labor',
			weight: 40,
			detail: 'Water breaking is a definitive sign of labor',
		});
	}

	let totalWeight = 0;
	let weightedScore = 0;
	for (const criterion of criteria) {
		totalWeight += criterion.weight;
		if (criterion.result === 'real-labor') {
			weightedScore += criterion.weight;
		} else if (criterion.result === 'inconclusive') {
			weightedScore += criterion.weight * 0.5;
		}
	}

	const score = totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) : 50;

	let verdict: BHAssessment['verdict'];
	if (score >= thresholds.verdictRealThreshold) {
		verdict = 'likely-real-labor';
	} else if (score <= thresholds.verdictBHThreshold) {
		verdict = 'likely-braxton-hicks';
	} else {
		verdict = 'uncertain';
	}

	return { score, verdict, criteria, requiresMore: false };
}
