import type { Contraction, LaborEvent, BHThresholdConfig } from '../types';
import { DEFAULT_BH_THRESHOLDS } from '../types';
import { getDurationSeconds, getIntervalMinutes, getTrend, getSessionFilteredIntervals } from './calculations';

/** Individual criterion result */
export interface BHCriterion {
	name: string;
	description: string;
	result: 'braxton-hicks' | 'real-labor' | 'inconclusive';
	weight: number;
	detail: string;
}

/** Full Braxton Hicks assessment */
export interface BHAssessment {
	score: number; // 0-100, higher = more likely real labor
	verdict: 'likely-braxton-hicks' | 'uncertain' | 'likely-real-labor';
	criteria: BHCriterion[];
	requiresMore: boolean; // true if not enough data
}

/**
 * Assess whether contractions are likely Braxton Hicks or real labor.
 * Uses 6 weighted criteria based on clinical differentiation patterns.
 * Requires >= 4 completed contractions.
 *
 * Key clinical differentiators:
 * - BH: Irregular, front-only, stop with movement, stable intensity
 * - Real: Regular, back/wrapping, persist through movement, intensifying
 */
export function assessBraxtonHicks(
	contractions: Contraction[],
	events: LaborEvent[],
	thresholds: BHThresholdConfig = DEFAULT_BH_THRESHOLDS,
	gapThresholdMin = 0
): BHAssessment {
	const completed = contractions.filter(c => c.end !== null);

	if (completed.length < 4) {
		return {
			score: 0,
			verdict: 'uncertain',
			criteria: [],
			requiresMore: true,
		};
	}

	const criteria: BHCriterion[] = [];

	// --- 1. Regular pattern (weight: 20) ---
	// Real labor: intervals become regular (low coefficient of variation)
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

	// --- 2. Getting closer (weight: 20) ---
	// Real labor: interval trend decreasing
	const intervalTrend = getTrend(intervals);
	criteria.push({
		name: 'Closing gap',
		description: 'Are contractions getting closer together over time?',
		result: intervalTrend?.direction === 'decreasing' ? 'real-labor'
			: intervalTrend?.direction === 'increasing' ? 'braxton-hicks'
				: 'inconclusive',
		weight: 20,
		detail: intervalTrend?.direction === 'decreasing'
			? `Gap between contractions shrinking: ${intervalTrend.firstValue.toFixed(0)} min \u2192 ${intervalTrend.lastValue.toFixed(0)} min apart`
			: intervalTrend?.direction === 'increasing'
				? `Gap between contractions growing: ${intervalTrend.firstValue.toFixed(0)} min \u2192 ${intervalTrend.lastValue.toFixed(0)} min apart`
				: 'Gap between contractions staying about the same',
	});

	// --- 3. Getting longer (weight: 15) ---
	// Real labor: duration trend increasing (exclude untimed — no meaningful duration)
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
			? `Each contraction lasting longer: ${Math.round(durationTrend.firstValue)}s \u2192 ${Math.round(durationTrend.lastValue)}s`
			: durationTrend?.direction === 'decreasing'
				? `Each contraction getting shorter: ${Math.round(durationTrend.firstValue)}s \u2192 ${Math.round(durationTrend.lastValue)}s`
				: 'Each contraction lasting about the same',
	});

	// --- 4. Getting stronger (weight: 15) ---
	// Real labor: intensity trend increasing
	const intensities = completed
		.map(c => c.intensity)
		.filter((i): i is number => i !== null);

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
			detail: 'Need more intensity ratings \u2014 rate after each contraction',
		});
	}

	// --- 5. Location (weight: 15) ---
	// Real labor: back or wrapping; BH: front only
	const locationsWithData = completed.filter(c => c.location !== null);
	if (locationsWithData.length >= 3) {
		const backOrWrapping = locationsWithData.filter(
			c => c.location === 'back' || c.location === 'wrapping'
		).length;
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
			detail: 'Need more location data \u2014 mark front/back/wrapping after each contraction',
		});
	}

	// --- 6. Sustained session (weight: 15) ---
	// Real labor: span >= sustainedMinMinutes with no gap > sustainedMaxGapMinutes
	const firstStart = new Date(completed[0].start).getTime();
	const lastStart = new Date(completed[completed.length - 1].start).getTime();
	const spanMinutes = (lastStart - firstStart) / 60000;

	// Check for gaps > max gap threshold
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

	// --- 7. Water broke (weight: 40, conditional) ---
	// Rupture of membranes is a definitive sign of labor
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

	// --- Calculate weighted score ---
	let totalWeight = 0;
	let weightedScore = 0;

	for (const criterion of criteria) {
		totalWeight += criterion.weight;
		if (criterion.result === 'real-labor') {
			weightedScore += criterion.weight;
		} else if (criterion.result === 'inconclusive') {
			weightedScore += criterion.weight * 0.5;
		}
		// braxton-hicks contributes 0
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
