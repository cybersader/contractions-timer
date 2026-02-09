/**
 * Format a duration in seconds to a human-readable string.
 * Returns "M:SS" format (e.g., "1:23", "0:45", "12:05")
 */
export function formatDuration(seconds: number): string {
	if (seconds < 0) seconds = 0;
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format a rest timer value with adaptive formatting:
 * - 0-59 min:  M:SS  (e.g., "5:23", "45:09")
 * - 60-1439 min (1-24h):  Xh Ym [Zs]  (seconds optional)
 * - 1440+ min (24h+):  Xd Yh  (e.g., "1d 3h")
 */
export function formatRestTime(seconds: number, showSeconds = false): string {
	if (seconds < 0) seconds = 0;
	const totalMinutes = Math.floor(seconds / 60);
	if (totalMinutes < 60) {
		const secs = Math.floor(seconds % 60);
		return `${totalMinutes}:${secs.toString().padStart(2, '0')}`;
	}
	if (totalMinutes < 1440) {
		const hours = Math.floor(totalMinutes / 60);
		const mins = totalMinutes % 60;
		if (showSeconds) {
			const secs = Math.floor(seconds % 60);
			return `${hours}h ${mins}m ${secs}s`;
		}
		return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
	}
	const days = Math.floor(totalMinutes / 1440);
	const hours = Math.floor((totalMinutes % 1440) / 60);
	return hours === 0 ? `${days}d` : `${days}d ${hours}h`;
}

/**
 * Format a duration in seconds to a short label.
 * Returns "Xm Ys" or "Xs" format.
 */
export function formatDurationShort(seconds: number): string {
	if (seconds < 0) seconds = 0;
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	if (mins === 0) return `${secs}s`;
	if (secs === 0) return `${mins}m`;
	return `${mins}m ${secs}s`;
}

/**
 * Format an interval in minutes to a human-readable string.
 * Returns "Xm Ys" format.
 */
export function formatInterval(minutes: number): string {
	if (minutes < 0) minutes = 0;
	const mins = Math.floor(minutes);
	const secs = Math.round((minutes - mins) * 60);
	if (mins === 0) return `${secs}s`;
	if (secs === 0) return `${mins}m`;
	return `${mins}m ${secs}s`;
}

/**
 * Format an ISO8601 timestamp to a short time string.
 * Returns "2:30 PM" format.
 */
export function formatTime(iso: string): string {
	const date = new Date(iso);
	return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Format a Date or timestamp to a compact time for chart labels.
 * Returns "2:30p" (12h) or "14:30" (24h).
 */
export function formatTimeShort(date: Date, format: '12h' | '24h' = '12h'): string {
	if (format === '24h') {
		const h = date.getHours().toString().padStart(2, '0');
		const m = date.getMinutes().toString().padStart(2, '0');
		return `${h}:${m}`;
	}
	let h = date.getHours();
	const suffix = h >= 12 ? 'p' : 'a';
	h = h % 12 || 12;
	const m = date.getMinutes().toString().padStart(2, '0');
	return `${h}:${m}${suffix}`;
}

/**
 * Get a label for a labor stage.
 */
export function getLaborStageLabel(stage: string): string {
	const labels: Record<string, string> = {
		'pre-labor': 'Pre-labor',
		'early': 'Early labor',
		'active': 'Active labor',
		'transition': 'Transition',
	};
	return labels[stage] || stage;
}

/**
 * Map a 5-scale intensity to the nearest 3-scale value.
 */
export function mapIntensityTo3(level: number): number {
	if (level <= 2) return 1;
	if (level <= 3) return 3;
	return 5;
}

/**
 * Get intensity label for a given level.
 */
export function getIntensityLabel(level: number): string {
	const labels: Record<number, string> = {
		1: 'Mild',
		2: 'Moderate',
		3: 'Strong',
		4: 'Very strong',
		5: 'Intense',
	};
	return labels[level] || `Level ${level}`;
}

/**
 * Get location label.
 */
export function getLocationLabel(location: string): string {
	const labels: Record<string, string> = {
		front: 'Lower belly',
		back: 'Lower back',
		wrapping: 'All around',
	};
	return labels[location] || location;
}

/**
 * Format elapsed time in minutes to an approximate human-readable string.
 */
export function formatElapsedApprox(minutes: number): string {
	if (minutes < 1) return '<1 min';
	if (minutes < 60) return `~${Math.round(minutes)} min`;
	const hours = minutes / 60;
	if (hours < 1.5) return '~1 hour';
	return `~${Math.round(hours)} hours`;
}

/**
 * Format a duration in minutes to a compact label (no ~ prefix).
 */
export function formatDurationApprox(minutes: number): string {
	if (minutes < 60) return `${minutes} min`;
	const hours = minutes / 60;
	if (hours === 1) return '1 hour';
	if (Number.isInteger(hours)) return `${hours} hours`;
	return `${hours.toFixed(1)} hours`;
}

/**
 * Format a [lower, upper] minute range as a readable string.
 */
export function formatDurationRange(rangeMin: [number, number]): string {
	if (rangeMin[0] === 0 && rangeMin[1] === 0) return '';
	return `${formatDurationApprox(rangeMin[0])} \u2013 ${formatDurationApprox(rangeMin[1])}`;
}

/**
 * Generate a short random ID.
 */
export function generateId(): string {
	return Math.random().toString(36).substring(2, 8);
}
