import type { LaborStage, Parity, StageThresholdConfig } from '../types';
import { formatElapsedApprox, formatDurationRange, getLaborStageLabel } from '../utils/formatters';

/**
 * Visual progress bar showing time in current labor stage
 * with evidence-based typical duration range.
 * Hidden for pre-labor (no meaningful progress to show).
 */
export class StageDurationBar {
	private el: HTMLElement;
	private stageLabel: HTMLElement;
	private timeLabel: HTMLElement;
	private barTrack: HTMLElement;
	private barFill: HTMLElement;
	private tipEl: HTMLElement;

	constructor(parent: HTMLElement) {
		this.el = parent.createDiv({ cls: 'ct-stage-duration' });

		const headerRow = this.el.createDiv({ cls: 'ct-stage-duration-header' });
		this.stageLabel = headerRow.createSpan({ cls: 'ct-stage-label' });
		this.timeLabel = headerRow.createSpan({ cls: 'ct-stage-time' });

		this.barTrack = this.el.createDiv({ cls: 'ct-stage-bar-track' });
		this.barFill = this.barTrack.createDiv({ cls: 'ct-stage-bar-fill' });

		this.tipEl = this.el.createDiv({ cls: 'ct-stage-tip' });
	}

	/** Update the bar with current stage info. */
	update(
		stage: LaborStage | null,
		minutesInStage: number,
		stageThresholds: Record<string, StageThresholdConfig>,
		parity: Parity
	): void {
		if (!stage) {
			this.el.addClass('ct-hidden');
			return;
		}

		const config = stageThresholds[stage];
		const range = config
			? (parity === 'first-baby' ? config.typicalDurationFirstMin : config.typicalDurationSubsequentMin)
			: [0, 0] as [number, number];

		// Hide for pre-labor or stages with no meaningful range
		if (range[0] === 0 && range[1] === 0) {
			this.el.addClass('ct-hidden');
			return;
		}

		this.el.removeClass('ct-hidden');

		// Stage label with color
		this.stageLabel.textContent = getLaborStageLabel(stage);
		this.stageLabel.className = `ct-stage-label ct-stage-label--${stage}`;

		// Time in stage — make it clearly personal
		this.timeLabel.textContent = `You've been here ${formatElapsedApprox(minutesInStage)}`;

		// Progress bar (based on upper end of range)
		const progress = range[1] > 0 ? Math.min(1, minutesInStage / range[1]) : 0;
		this.barFill.style.width = `${Math.round(progress * 100)}%`;
		this.barFill.className = `ct-stage-bar-fill ct-stage-bar-fill--${stage}`;

		// Typical range + location tip
		const rangeStr = formatDurationRange(range);
		const location = config?.location || '';
		const parts: string[] = [];
		if (rangeStr) parts.push(`Typical: ${rangeStr}`);
		if (location) parts.push(`Location: ${location}`);
		this.tipEl.textContent = parts.join(' \u00B7 ');
	}
}
