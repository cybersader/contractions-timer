import type { Contraction, SessionStats, ThresholdConfig, LaborStage, TrendResult, StageThresholdConfig } from '../types';
import { DEFAULT_STAGE_THRESHOLDS } from '../types';

/**
 * Check if a contraction is currently active (no end time).
 */
export function isContractionActive(contraction: Contraction): boolean {
	return contraction.end === null;
}

/**
 * Get duration of a completed contraction in seconds.
 * Returns 0 for active contractions.
 */
export function getDurationSeconds(contraction: Contraction): number {
	if (!contraction.end) return 0;
	const start = new Date(contraction.start).getTime();
	const end = new Date(contraction.end).getTime();
	return Math.max(0, (end - start) / 1000);
}

/**
 * Get elapsed seconds for an active contraction (from start to now).
 */
export function getElapsedSeconds(contraction: Contraction): number {
	const start = new Date(contraction.start).getTime();
	return Math.max(0, (Date.now() - start) / 1000);
}

/**
 * Get interval between two contractions in minutes (start-to-start).
 */
export function getIntervalMinutes(current: Contraction, previous: Contraction): number {
	const currentStart = new Date(current.start).getTime();
	const previousStart = new Date(previous.start).getTime();
	return Math.max(0, (currentStart - previousStart) / 60000);
}

/**
 * Get time since the last contraction ended, in seconds.
 */
export function getRestSeconds(contractions: Contraction[]): number {
	const completed = contractions.filter(c => c.end !== null);
	if (completed.length === 0) return 0;
	const last = completed[completed.length - 1];
	if (!last.end) return 0;
	return Math.max(0, (Date.now() - new Date(last.end).getTime()) / 1000);
}

/**
 * Calculate comprehensive session statistics.
 */
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

	// Durations (exclude untimed contractions — they have no meaningful duration)
	const timed = completed.filter(c => !c.untimed);
	const durations = timed.map(getDurationSeconds);
	const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
	const lastDuration = durations.length > 0 ? durations[durations.length - 1] : 0;

	// Intervals (need at least 2 contractions)
	const intervals: number[] = [];
	for (let i = 1; i < completed.length; i++) {
		intervals.push(getIntervalMinutes(completed[i], completed[i - 1]));
	}
	const avgInterval = intervals.length > 0
		? intervals.reduce((a, b) => a + b, 0) / intervals.length
		: 0;
	const lastInterval = intervals.length > 0 ? intervals[intervals.length - 1] : 0;

	// 5-1-1 rule check
	const rule511 = check511Rule(completed, threshold);

	// Estimate labor stage from recent data
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
 * Check if the 5-1-1 rule (or configured threshold) is met.
 *
 * Looks at contractions within the sustained window and checks if:
 * - Average interval <= threshold interval
 * - Average duration >= threshold duration
 * - Pattern sustained for threshold sustained period
 */
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

	// Check the most recent contractions within the sustained window
	const now = Date.now();
	const windowMs = threshold.sustainedMinutes * 60 * 1000;
	const recent = completed.filter(c => {
		const start = new Date(c.start).getTime();
		return (now - start) <= windowMs;
	});

	// Calculate span from first to last completed contraction
	const firstStart = new Date(completed[0].start).getTime();
	const lastStart = new Date(completed[completed.length - 1].start).getTime();
	const totalSpan = (lastStart - firstStart) / 60000;

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

		return {
			met: false, metAt: null,
			progress: {
				intervalOk: avgInt <= threshold.intervalMinutes,
				intervalValue: avgInt === Infinity ? 0 : avgInt,
				durationOk: avgDur >= threshold.durationSeconds,
				durationValue: avgDur,
				sustainedOk: totalSpan >= threshold.sustainedMinutes,
				sustainedValue: totalSpan,
			},
		};
	}

	// Calculate averages within the sustained window (durations from timed only)
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

	// Check if the window spans the sustained period
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

/**
 * Estimate labor stage from recent contraction patterns.
 * Uses configurable stage thresholds (checked from most advanced to least).
 */
export function estimateStage(
	completed: Contraction[],
	stageThresholds: Record<string, StageThresholdConfig> = DEFAULT_STAGE_THRESHOLDS
): LaborStage | null {
	if (completed.length < 2) return null;

	// Durations from timed contractions only (untimed have no meaningful duration)
	const timed = completed.filter(c => !c.untimed);
	if (timed.length < 2) return null;
	const recentTimed = timed.slice(-4);
	const durations = recentTimed.map(getDurationSeconds);
	const avgDur = durations.reduce((a, b) => a + b, 0) / durations.length;

	// Intervals from all completed (untimed still represent real event timing)
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

	// Compute sustained span from all completed contractions
	const firstStart = completed.length > 0 ? new Date(completed[0].start).getTime() : 0;
	const lastStart = new Date(completed[completed.length - 1].start).getTime();
	const sustainedMin = (lastStart - firstStart) / 60000;

	// Check stages from most advanced to least
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

/**
 * Estimate how long the user has been in the current labor stage.
 * Walks backward through contractions using a rolling window of 4
 * to find when the current stage first appeared.
 * Returns minutes in current stage, or null if not enough data.
 */
export function getTimeInCurrentStage(
	contractions: Contraction[],
	stageThresholds: Record<string, StageThresholdConfig> = DEFAULT_STAGE_THRESHOLDS,
	useCurrentTime = false
): { stage: LaborStage; minutesInStage: number } | null {
	const completed = contractions.filter(c => c.end !== null);
	if (completed.length < 2) return null;

	const currentStage = estimateStage(completed, stageThresholds);
	if (!currentStage) return null;

	// Walk backward to find when this stage started
	let stageStartTime = new Date(completed[completed.length - 1].start).getTime();

	for (let i = completed.length - 1; i >= 1; i--) {
		const windowEnd = i;
		const windowStart = Math.max(0, i - 3); // window of up to 4
		const windowSlice = completed.slice(windowStart, windowEnd + 1);

		const windowStage = estimateStage(windowSlice, stageThresholds);
		if (windowStage === currentStage) {
			stageStartTime = new Date(completed[windowStart].start).getTime();
		} else {
			break;
		}
	}

	// Endpoint: current clock time or last recorded contraction end
	const last = completed[completed.length - 1];
	const endpointMs = useCurrentTime
		? Date.now()
		: new Date(last.end!).getTime();

	const minutesInStage = (endpointMs - stageStartTime) / 60000;
	return { stage: currentStage, minutesInStage: Math.max(0, minutesInStage) };
}

/**
 * Get rest time between two consecutive contractions (end-to-start gap).
 * Returns seconds.
 */
export function getRestBetween(current: Contraction, next: Contraction): number {
	if (!current.end) return 0;
	const endTime = new Date(current.end).getTime();
	const nextStart = new Date(next.start).getTime();
	return Math.max(0, (nextStart - endTime) / 1000);
}

/**
 * Simple linear regression to detect trend direction.
 * Returns slope, first/last values, and direction label.
 */
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

	// Threshold for "stable": slope < 5% of mean per step
	const mean = sumY / n;
	const threshold = mean * 0.05;
	const direction: TrendResult['direction'] =
		Math.abs(slope) < threshold ? 'stable' :
		slope > 0 ? 'increasing' : 'decreasing';

	return { slope, firstValue, lastValue, direction };
}

/**
 * Return start-to-start intervals (in minutes) excluding any gaps
 * larger than `gapThresholdMin`.  When gapThresholdMin is 0 every
 * interval is kept.
 */
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

/**
 * Return the contractions belonging to the most recent continuous
 * session — i.e. everything after the last gap > gapThresholdMin.
 * If there are no large gaps, returns the full array.
 */
export function getLatestSession(
	completed: Contraction[],
	gapThresholdMin: number
): Contraction[] {
	if (completed.length === 0 || gapThresholdMin <= 0) return completed;

	let lastGapIdx = 0; // index of first contraction after last gap
	for (let i = 1; i < completed.length; i++) {
		const iv = getIntervalMinutes(completed[i], completed[i - 1]);
		if (iv > gapThresholdMin) {
			lastGapIdx = i;
		}
	}
	return completed.slice(lastGapIdx);
}

/**
 * Estimate minutes until 5-1-1 rule is met based on current trends.
 * Returns null if not enough data or trends don't converge.
 */
export function estimateTimeTo511(
	contractions: Contraction[],
	threshold: ThresholdConfig,
	gapThresholdMin = 0
): number | null {
	const allCompleted = contractions.filter(c => c.end !== null);
	// When gap filtering is enabled, use only the latest session
	const completed = gapThresholdMin > 0
		? getLatestSession(allCompleted, gapThresholdMin)
		: allCompleted;
	if (completed.length < 4) return null;

	// Duration stats from timed contractions only (untimed have no meaningful duration)
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

	// Check if criteria are already met using rolling average of last 4,
	// consistent with how check511Rule evaluates the pattern.
	const recentDurations = durations.slice(-4);
	const recentIntervals = intervals.slice(-4);
	const avgRecentDur = recentDurations.reduce((a, b) => a + b, 0) / recentDurations.length;
	const avgRecentInt = recentIntervals.reduce((a, b) => a + b, 0) / recentIntervals.length;

	if (avgRecentDur >= threshold.durationSeconds && avgRecentInt <= threshold.intervalMinutes) {
		// Also check sustained window — need at least sustainedMinutes of this pattern
		const firstStart = new Date(completed[0].start).getTime();
		const lastStart = new Date(completed[completed.length - 1].start).getTime();
		const spanMinutes = (lastStart - firstStart) / 60000;
		if (spanMinutes >= threshold.sustainedMinutes) return 0;
		// Pattern meets criteria but hasn't been sustained long enough yet
		const remainingSustained = threshold.sustainedMinutes - spanMinutes;
		return Math.round(remainingSustained);
	}

	// Estimate steps to reach each threshold
	let stepsToInterval = Infinity;
	let stepsToDuration = Infinity;

	if (intervalTrend.slope < 0 && avgRecentInt > threshold.intervalMinutes) {
		// Decreasing intervals - how many contractions until <= threshold?
		stepsToInterval = (avgRecentInt - threshold.intervalMinutes) / Math.abs(intervalTrend.slope);
	} else if (avgRecentInt <= threshold.intervalMinutes) {
		stepsToInterval = 0;
	}

	if (durationTrend.slope > 0 && avgRecentDur < threshold.durationSeconds) {
		// Increasing duration - how many contractions until >= threshold?
		stepsToDuration = (threshold.durationSeconds - avgRecentDur) / durationTrend.slope;
	} else if (avgRecentDur >= threshold.durationSeconds) {
		stepsToDuration = 0;
	}

	// If either criterion is not converging toward the threshold, return null
	// (both must be met for 5-1-1 to trigger)
	if (stepsToInterval === Infinity || stepsToDuration === Infinity) return null;

	// Convert steps to minutes using current average interval
	const avgInt = intervals.reduce((a, b) => a + b, 0) / intervals.length;
	const maxSteps = Math.max(stepsToInterval, stepsToDuration);

	const trendMinutes = maxSteps * avgInt;

	// Also account for sustained time: the pattern must persist for sustainedMinutes
	const firstStart = new Date(completed[0].start).getTime();
	const lastStart = new Date(completed[completed.length - 1].start).getTime();
	const currentSpan = (lastStart - firstStart) / 60000;
	const remainingSustained = Math.max(0, threshold.sustainedMinutes - currentSpan);

	const estimatedMinutes = Math.max(trendMinutes, remainingSustained);

	// Cap at 4 hours - beyond that the estimate is unreliable
	if (estimatedMinutes > 240) return null;

	return Math.round(estimatedMinutes);
}
