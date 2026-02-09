import type { Contraction, ThresholdConfig } from '../types';
import { getDurationSeconds, getSessionFilteredIntervals, getLatestSession, getTrend, estimateTimeTo511 } from '../data/calculations';
import { formatDurationShort, formatInterval } from '../utils/formatters';

/**
 * Trend analysis section showing contraction progression
 * and estimated time to 5-1-1 threshold.
 */
export class ProgressionInsight {
	private el: HTMLElement;
	private threshold: ThresholdConfig;
	private gapThresholdMin: number;

	constructor(parent: HTMLElement, threshold: ThresholdConfig, gapThresholdMin = 0) {
		this.threshold = threshold;
		this.gapThresholdMin = gapThresholdMin;
		this.el = parent.createDiv({ cls: 'ct-insight ct-hidden' });
	}

	update(contractions: Contraction[]): void {
		const allCompleted = contractions.filter(c => c.end !== null);
		// Use only the latest session when gap filtering is active
		const completed = this.gapThresholdMin > 0
			? getLatestSession(allCompleted, this.gapThresholdMin)
			: allCompleted;
		this.el.empty();

		if (completed.length < 4) {
			this.el.addClass('ct-hidden');
			return;
		}

		this.el.removeClass('ct-hidden');
		this.el.createDiv({ cls: 'ct-section-label', text: 'Trend' });

		// Calculate trends using session-filtered intervals
		const durations = completed.map(getDurationSeconds);
		const intervals = this.gapThresholdMin > 0
			? getSessionFilteredIntervals(completed, this.gapThresholdMin)
			: (() => {
				const iv: number[] = [];
				for (let i = 1; i < completed.length; i++) {
					iv.push(completed[i] && completed[i - 1]
						? (new Date(completed[i].start).getTime() - new Date(completed[i - 1].start).getTime()) / 60000
						: 0);
				}
				return iv;
			})();

		const durationTrend = getTrend(durations);
		const intervalTrend = getTrend(intervals);

		// Interval trend row
		if (intervalTrend && intervals.length >= 3) {
			const row = this.el.createDiv({ cls: 'ct-insight-row' });
			const first = formatInterval(intervalTrend.firstValue);
			const last = formatInterval(intervalTrend.lastValue);
			const arrow = intervalTrend.direction === 'decreasing' ? '\u2193'
				: intervalTrend.direction === 'increasing' ? '\u2191' : '\u2194';
			const desc = intervalTrend.direction === 'decreasing' ? 'getting closer together'
				: intervalTrend.direction === 'increasing' ? 'spreading further apart' : 'staying about the same';
			row.createSpan({ cls: 'ct-insight-label', text: 'Gap between: ' });
			row.createSpan({
				cls: `ct-insight-value ct-insight-value--${intervalTrend.direction}`,
				text: `${first} \u2192 ${last} (${desc} ${arrow})`,
			});
		}

		// Duration trend row
		if (durationTrend && durations.length >= 3) {
			const row = this.el.createDiv({ cls: 'ct-insight-row' });
			const first = formatDurationShort(durationTrend.firstValue);
			const last = formatDurationShort(durationTrend.lastValue);
			const arrow = durationTrend.direction === 'increasing' ? '\u2191'
				: durationTrend.direction === 'decreasing' ? '\u2193' : '\u2194';
			const desc = durationTrend.direction === 'increasing' ? 'each one lasting longer'
				: durationTrend.direction === 'decreasing' ? 'each one getting shorter' : 'staying about the same';
			row.createSpan({ cls: 'ct-insight-label', text: 'Each contraction: ' });
			row.createSpan({
				cls: `ct-insight-value ct-insight-value--${durationTrend.direction === 'increasing' ? 'decreasing' : durationTrend.direction === 'decreasing' ? 'increasing' : 'stable'}`,
				text: `${first} \u2192 ${last} (${desc} ${arrow})`,
			});
		}

		// Estimated time to 5-1-1
		const estimate = estimateTimeTo511(completed, this.threshold, this.gapThresholdMin);
		if (estimate !== null) {
			const estimateEl = this.el.createDiv({ cls: 'ct-insight-estimate' });
			if (estimate === 0) {
				estimateEl.textContent = `${this.threshold.intervalMinutes}-1-1 criteria currently met`;
			} else {
				estimateEl.textContent = `At this pace, may reach ${this.threshold.intervalMinutes}-1-1 in ~${estimate} min`;
			}
			const disclaimerText = `Based on last ${intervals.length} interval${intervals.length !== 1 ? 's' : ''} (this session)`;
			this.el.createDiv({
				cls: 'ct-insight-disclaimer',
				text: disclaimerText,
			});
		}
	}
}
