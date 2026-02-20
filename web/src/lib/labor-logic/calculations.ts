import type { Contraction, SessionStats, ThresholdConfig, LaborStage, TrendResult, StageThresholdConfig } from './types';
import { DEFAULT_STAGE_THRESHOLDS } from './types';

export function isContractionActive(contraction: Contraction): boolean {
	return contraction.end === null;
}

export function getDurationSeconds(contraction: Contraction): number {
	if (!contraction.end) return 0;
	const start = new Date(contraction.start).getTime();
	const end = new Date(contraction.end).getTime();
	return Math.max(0, (end - start) / 1000);
}

export function getElapsedSeconds(contraction: Contraction, frozenAt?: string | null): number {
	const start = new Date(contraction.start).getTime();
	const now = frozenAt ? new Date(frozenAt).getTime() : Date.now();
	return Math.max(0, (now - start) / 1000);
}

export function getIntervalMinutes(current: Contraction, previous: Contraction): number {
	const currentStart = new Date(current.start).getTime();
	const previousStart = new Date(previous.start).getTime();
	return Math.max(0, (currentStart - previousStart) / 60000);
}

export function getRestSeconds(contractions: Contraction[], frozenAt?: string | null, pauseOffsetMs = 0): number {
	const completed = contractions.filter(c => c.end !== null);
	if (completed.length === 0) return 0;
	const last = completed[completed.length - 1];
	if (!last.end) return 0;
	const now = frozenAt ? new Date(frozenAt).getTime() : Date.now();
	return Math.max(0, (now - new Date(last.end).getTime() - pauseOffsetMs) / 1000);
}

export function getSessionStats(
	contractions: Contraction[],
	threshold: ThresholdConfig,
	stageThresholds: Record<string, StageThresholdConfig> = DEFAULT_STAGE_THRESHOLDS
): SessionStats {
	const completed = contractions.filter(c => c.end !== null);

	const empty: SessionStats = {
		totalContractions: completed.length,
		avgDurationSec: 0,
		avgIntervalMin: 0,
		lastDurationSec: 0,
		lastIntervalMin: 0,
		rule511Met: false,
		rule511MetAt: null,
		rule511Progress: {
			intervalOk: false, intervalValue: 0,
			durationOk: false, durationValue: 0,
			sustainedOk: false, sustainedValue: 0,
		},
		laborStage: null,
	};

	if (completed.length === 0) return empty;

	const timed = completed.filter(c => !c.untimed);
	const durations = timed.map(getDurationSeconds);
	const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
	const lastDuration = durations.length > 0 ? durations[durations.length - 1] : 0;

	const intervals: number[] = [];
	for (let i = 1; i < completed.length; i++) {
		intervals.push(getIntervalMinutes(completed[i], completed[i - 1]));
	}
	const avgInterval = intervals.length > 0
		? intervals.reduce((a, b) => a + b, 0) / intervals.length
		: 0;
	const lastInterval = intervals.length > 0 ? intervals[intervals.length - 1] : 0;

	const rule511 = check511Rule(completed, threshold);
	const laborStage = estimateStage(completed, stageThresholds);

	return {
		totalContractions: completed.length,
		avgDurationSec: avgDuration,
		avgIntervalMin: avgInterval,
		lastDurationSec: lastDuration,
		lastIntervalMin: lastInterval,
		rule511Met: rule511.met,
		rule511MetAt: rule511.metAt,
		rule511Progress: rule511.progress,
		laborStage,
	};
}

/**
 * Compute the span (in minutes) of the most recent contiguous segment of contractions.
 * A segment breaks when the gap between consecutive contractions exceeds `breakGapMinutes`.
 * Returns 0 if fewer than 2 contractions.
 */
export function computeSustainedSpan(completed: Contraction[], breakGapMinutes: number): number {
	if (completed.length < 2) return 0;
	let segmentStartTime = new Date(completed[0].start).getTime();
	let prevTime = segmentStartTime;

	for (let i = 1; i < completed.length; i++) {
		const curTime = new Date(completed[i].start).getTime();
		const gapMin = (curTime - prevTime) / 60000;

		if (gapMin > breakGapMinutes) {
			// Gap too large — start a new segment
			segmentStartTime = curTime;
		}
		prevTime = curTime;
	}

	// Return the span of the most recent (last) segment
	return (prevTime - segmentStartTime) / 60000;
}

export function check511Rule(
	contractions: Contraction[],
	threshold: ThresholdConfig
): { met: boolean; metAt: string | null; progress: SessionStats['rule511Progress'] } {
	const completed = contractions.filter(c => c.end !== null);

	if (completed.length < 3) {
		return {
			met: false, metAt: null,
			progress: {
				intervalOk: false, intervalValue: 0,
				durationOk: false, durationValue: 0,
				sustainedOk: false, sustainedValue: 0,
			},
		};
	}

	const now = Date.now();
	const windowMs = threshold.sustainedMinutes * 60 * 1000;
	const recent = completed.filter(c => {
		const start = new Date(c.start).getTime();
		return (now - start) <= windowMs;
	});

	if (recent.length < 3) {
		const timedCompleted = completed.filter(c => !c.untimed);
		const allDurations = timedCompleted.map(getDurationSeconds);
		const recentDurations = allDurations.slice(-3);
		const avgDur = recentDurations.length > 0 ? recentDurations.reduce((a, b) => a + b, 0) / recentDurations.length : 0;

		const allIntervals: number[] = [];
		for (let i = 1; i < completed.length; i++) {
			allIntervals.push(getIntervalMinutes(completed[i], completed[i - 1]));
		}
		const recentIntervals = allIntervals.slice(-3);
		const avgInt = recentIntervals.length > 0
			? recentIntervals.reduce((a, b) => a + b, 0) / recentIntervals.length
			: Infinity;

		// Use contiguous sustained span — breaks chain when gaps exceed the sustained threshold
		const sustainedSpan = computeSustainedSpan(completed, threshold.sustainedMinutes);

		return {
			met: false, metAt: null,
			progress: {
				intervalOk: avgInt <= threshold.intervalMinutes,
				intervalValue: avgInt === Infinity ? 0 : avgInt,
				durationOk: avgDur >= threshold.durationSeconds,
				durationValue: avgDur,
				sustainedOk: sustainedSpan >= threshold.sustainedMinutes,
				sustainedValue: sustainedSpan,
			},
		};
	}

	const timedRecent = recent.filter(c => !c.untimed);
	const durations = timedRecent.map(getDurationSeconds);
	const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

	const intervals: number[] = [];
	for (let i = 1; i < recent.length; i++) {
		intervals.push(getIntervalMinutes(recent[i], recent[i - 1]));
	}
	const avgInterval = intervals.length > 0
		? intervals.reduce((a, b) => a + b, 0) / intervals.length
		: Infinity;

	const intervalOk = avgInterval <= threshold.intervalMinutes;
	const durationOk = avgDuration >= threshold.durationSeconds;

	const firstInWindow = new Date(recent[0].start).getTime();
	const lastInWindow = new Date(recent[recent.length - 1].start).getTime();
	const spanMinutes = (lastInWindow - firstInWindow) / 60000;
	const sustainedOk = spanMinutes >= threshold.sustainedMinutes;

	const met = intervalOk && durationOk && sustainedOk;

	let metAt: string | null = null;
	if (met) {
		const firstTime = new Date(recent[0].start).getTime();
		metAt = new Date(firstTime + threshold.sustainedMinutes * 60 * 1000).toISOString();
	}

	return {
		met, metAt,
		progress: {
			intervalOk, intervalValue: avgInterval === Infinity ? 0 : avgInterval,
			durationOk, durationValue: avgDuration,
			sustainedOk, sustainedValue: spanMinutes,
		},
	};
}

export function estimateStage(
	completed: Contraction[],
	stageThresholds: Record<string, StageThresholdConfig> = DEFAULT_STAGE_THRESHOLDS
): LaborStage | null {
	if (completed.length < 2) return null;

	const timed = completed.filter(c => !c.untimed);
	if (timed.length < 2) return null;
	const recentTimed = timed.slice(-4);
	const durations = recentTimed.map(getDurationSeconds);
	const avgDur = durations.reduce((a, b) => a + b, 0) / durations.length;

	const recent = completed.slice(-4);
	const intervals: number[] = [];
	for (let i = 1; i < recent.length; i++) {
		intervals.push(getIntervalMinutes(recent[i], recent[i - 1]));
	}
	const avgInt = intervals.length > 0
		? intervals.reduce((a, b) => a + b, 0) / intervals.length
		: Infinity;

	// Minimum sustained time (minutes) before allowing escalation to higher stages.
	// Only applied when there are enough contractions to judge (6+).
	// Prevents a short burst of close contractions from showing "Transition" prematurely.
	const MIN_SUSTAINED: Record<string, number> = { transition: 20, active: 30 };

	// Compute sustained span using contiguous segments (breaks on gaps > 60 min)
	const sustainedMin = computeSustainedSpan(completed, 60);

	const stageOrder: LaborStage[] = ['transition', 'active', 'early', 'pre-labor'];
	for (const stage of stageOrder) {
		const config = stageThresholds[stage];
		if (!config) continue;
		if (avgInt <= config.maxIntervalMin && avgDur >= config.minDurationSec) {
			// Check minimum sustained time for higher stages (only with 6+ contractions)
			const minSustained = MIN_SUSTAINED[stage];
			if (minSustained && completed.length >= 6 && sustainedMin < minSustained) continue;
			return stage;
		}
	}
	return 'pre-labor';
}

export function getTimeInCurrentStage(
	contractions: Contraction[],
	stageThresholds: Record<string, StageThresholdConfig> = DEFAULT_STAGE_THRESHOLDS,
	useCurrentTime = false
): { stage: LaborStage; minutesInStage: number } | null {
	const completed = contractions.filter(c => c.end !== null);
	if (completed.length < 2) return null;

	const currentStage = estimateStage(completed, stageThresholds);
	if (!currentStage) return null;

	let stageStartTime = new Date(completed[completed.length - 1].start).getTime();

	for (let i = completed.length - 1; i >= 1; i--) {
		const windowEnd = i;
		const windowStart = Math.max(0, i - 3);
		const windowSlice = completed.slice(windowStart, windowEnd + 1);

		const windowStage = estimateStage(windowSlice, stageThresholds);
		if (windowStage === currentStage) {
			stageStartTime = new Date(completed[windowStart].start).getTime();
		} else {
			break;
		}
	}

	const last = completed[completed.length - 1];
	const endpointMs = useCurrentTime
		? Date.now()
		: new Date(last.end!).getTime();

	const minutesInStage = (endpointMs - stageStartTime) / 60000;
	return { stage: currentStage, minutesInStage: Math.max(0, minutesInStage) };
}

export function getRestBetween(current: Contraction, next: Contraction): number {
	if (!current.end) return 0;
	const endTime = new Date(current.end).getTime();
	const nextStart = new Date(next.start).getTime();
	return Math.max(0, (nextStart - endTime) / 1000);
}

export function getTrend(values: number[]): TrendResult | null {
	if (values.length < 3) return null;

	const n = values.length;
	let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
	for (let i = 0; i < n; i++) {
		sumX += i;
		sumY += values[i];
		sumXY += i * values[i];
		sumXX += i * i;
	}
	const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

	const firstValue = values[0];
	const lastValue = values[values.length - 1];

	const mean = sumY / n;
	const threshold = mean * 0.05;
	const direction: TrendResult['direction'] =
		Math.abs(slope) < threshold ? 'stable' :
		slope > 0 ? 'increasing' : 'decreasing';

	return { slope, firstValue, lastValue, direction };
}

export function getSessionFilteredIntervals(
	completed: Contraction[],
	gapThresholdMin: number
): number[] {
	const intervals: number[] = [];
	for (let i = 1; i < completed.length; i++) {
		const iv = getIntervalMinutes(completed[i], completed[i - 1]);
		if (gapThresholdMin > 0 && iv > gapThresholdMin) continue;
		intervals.push(iv);
	}
	return intervals;
}

export function getLatestSession(
	completed: Contraction[],
	gapThresholdMin: number
): Contraction[] {
	if (completed.length === 0 || gapThresholdMin <= 0) return completed;

	let lastGapIdx = 0;
	for (let i = 1; i < completed.length; i++) {
		const iv = getIntervalMinutes(completed[i], completed[i - 1]);
		if (iv > gapThresholdMin) {
			lastGapIdx = i;
		}
	}
	return completed.slice(lastGapIdx);
}

export function estimateTimeTo511(
	contractions: Contraction[],
	threshold: ThresholdConfig,
	gapThresholdMin = 0
): number | null {
	const allCompleted = contractions.filter(c => c.end !== null);
	const completed = gapThresholdMin > 0
		? getLatestSession(allCompleted, gapThresholdMin)
		: allCompleted;
	if (completed.length < 4) return null;

	const timed = completed.filter(c => !c.untimed);
	const durations = timed.map(getDurationSeconds);
	const intervals = gapThresholdMin > 0
		? getSessionFilteredIntervals(completed, gapThresholdMin)
		: (() => {
			const iv: number[] = [];
			for (let i = 1; i < completed.length; i++) {
				iv.push(getIntervalMinutes(completed[i], completed[i - 1]));
			}
			return iv;
		})();

	const durationTrend = getTrend(durations);
	const intervalTrend = getTrend(intervals);
	if (!durationTrend || !intervalTrend) return null;

	const recentDurations = durations.slice(-4);
	const recentIntervals = intervals.slice(-4);
	const avgRecentDur = recentDurations.reduce((a, b) => a + b, 0) / recentDurations.length;
	const avgRecentInt = recentIntervals.reduce((a, b) => a + b, 0) / recentIntervals.length;

	if (avgRecentDur >= threshold.durationSeconds && avgRecentInt <= threshold.intervalMinutes) {
		const spanMinutes = computeSustainedSpan(completed, threshold.sustainedMinutes);
		if (spanMinutes >= threshold.sustainedMinutes) return 0;
		const remainingSustained = threshold.sustainedMinutes - spanMinutes;
		return Math.round(remainingSustained);
	}

	let stepsToInterval = Infinity;
	let stepsToDuration = Infinity;

	if (intervalTrend.slope < 0 && avgRecentInt > threshold.intervalMinutes) {
		stepsToInterval = (avgRecentInt - threshold.intervalMinutes) / Math.abs(intervalTrend.slope);
	} else if (avgRecentInt <= threshold.intervalMinutes) {
		stepsToInterval = 0;
	}

	if (durationTrend.slope > 0 && avgRecentDur < threshold.durationSeconds) {
		stepsToDuration = (threshold.durationSeconds - avgRecentDur) / durationTrend.slope;
	} else if (avgRecentDur >= threshold.durationSeconds) {
		stepsToDuration = 0;
	}

	if (stepsToInterval === Infinity || stepsToDuration === Infinity) return null;

	const avgInt = intervals.reduce((a, b) => a + b, 0) / intervals.length;
	const maxSteps = Math.max(stepsToInterval, stepsToDuration);

	const trendMinutes = maxSteps * avgInt;

	// Also account for sustained time: the pattern must persist for sustainedMinutes
	const currentSpan = computeSustainedSpan(completed, threshold.sustainedMinutes);
	const remainingSustained = Math.max(0, threshold.sustainedMinutes - currentSpan);

	const estimatedMinutes = Math.max(trendMinutes, remainingSustained);

	if (estimatedMinutes > 240) return null;

	return Math.round(estimatedMinutes);
}
