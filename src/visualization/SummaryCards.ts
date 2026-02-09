import type { Contraction, ThresholdConfig } from '../types';
import { getSessionStats } from '../data/calculations';
import { formatDurationShort, formatInterval, getLaborStageLabel } from '../utils/formatters';

/**
 * Summary section with:
 * 1. Three stat cards (avg length, avg apart, count)
 * 2. 5-1-1 progress breakdown with actual values
 * 3. Estimated labor stage indicator
 */
export class SummaryCards {
	private el: HTMLElement;
	private threshold: ThresholdConfig;

	private durationCard!: HTMLElement;
	private intervalCard!: HTMLElement;
	private countCard!: HTMLElement;

	private progressSection!: HTMLElement;
	private stageSection!: HTMLElement;
	private alertBanner!: HTMLElement;

	constructor(parent: HTMLElement, threshold: ThresholdConfig) {
		this.threshold = threshold;
		this.el = parent.createDiv({ cls: 'ct-summary' });
		this.buildCards();
		this.buildProgressSection();
		this.buildStageSection();
	}

	private buildCards(): void {
		const grid = this.el.createDiv({ cls: 'ct-summary-cards' });
		this.durationCard = this.createCard(grid, 'Avg length', '--');
		this.intervalCard = this.createCard(grid, 'Avg apart', '--');
		this.countCard = this.createCard(grid, 'Contractions', '0');
	}

	private createCard(parent: HTMLElement, label: string, value: string): HTMLElement {
		const card = parent.createDiv({ cls: 'ct-card' });
		card.createDiv({ cls: 'ct-card-value', text: value });
		card.createDiv({ cls: 'ct-card-label', text: label });
		return card;
	}

	private buildProgressSection(): void {
		this.alertBanner = this.el.createDiv({ cls: 'ct-alert-banner ct-hidden' });
		this.alertBanner.textContent = 'Time to go!';

		this.progressSection = this.el.createDiv({ cls: 'ct-511-progress ct-hidden' });
		this.progressSection.createDiv({
			cls: 'ct-section-label',
			text: `${this.threshold.intervalMinutes}-1-1 progress`,
		});
	}

	private buildStageSection(): void {
		this.stageSection = this.el.createDiv({ cls: 'ct-stage ct-hidden' });
	}

	update(contractions: Contraction[]): void {
		const completed = contractions.filter(c => c.end !== null);
		const stats = getSessionStats(contractions, this.threshold);

		// Duration card (~ prefix for computed average)
		const durValue = this.durationCard.querySelector('.ct-card-value')!;
		durValue.textContent = completed.length > 0
			? `~${formatDurationShort(stats.avgDurationSec)}`
			: '--';

		// Interval card (~ prefix for computed average)
		const intValue = this.intervalCard.querySelector('.ct-card-value')!;
		intValue.textContent = completed.length > 1
			? `~${formatInterval(stats.avgIntervalMin)}`
			: '--';

		// Count card
		const countValue = this.countCard.querySelector('.ct-card-value')!;
		countValue.textContent = String(stats.totalContractions);

		// 5-1-1 progress
		this.updateProgress(stats, completed.length);

		// Stage indicator
		this.updateStage(stats);
	}

	private updateProgress(stats: ReturnType<typeof getSessionStats>, count: number): void {
		if (count < 2) {
			this.progressSection.addClass('ct-hidden');
			this.alertBanner.addClass('ct-hidden');
			return;
		}

		this.progressSection.removeClass('ct-hidden');

		// Clear existing rows (keep the label)
		const label = this.progressSection.querySelector('.ct-section-label');
		this.progressSection.empty();
		if (label) this.progressSection.appendChild(label);
		else this.progressSection.createDiv({
			cls: 'ct-section-label',
			text: `${this.threshold.intervalMinutes}-1-1 progress`,
		});

		const p = stats.rule511Progress;

		// Alert banner
		if (stats.rule511Met) {
			this.alertBanner.removeClass('ct-hidden');
		} else {
			this.alertBanner.addClass('ct-hidden');
		}

		// Interval row (~ prefix for computed average)
		this.createProgressRow(
			'Interval',
			p.intervalValue > 0 ? `~${p.intervalValue.toFixed(1)} min` : 'Not enough data',
			`need \u2264${this.threshold.intervalMinutes} min`,
			p.intervalOk
		);

		// Duration row (~ prefix for computed average)
		this.createProgressRow(
			'Duration',
			p.durationValue > 0 ? `~${formatDurationShort(p.durationValue)}` : 'Not enough data',
			`need \u2265${formatDurationShort(this.threshold.durationSeconds)}`,
			p.durationOk
		);

		// Sustained row
		this.createProgressRow(
			'Sustained',
			p.sustainedValue > 0 ? `${Math.round(p.sustainedValue)} min` : 'Not enough data',
			`need \u2265${this.threshold.sustainedMinutes} min`,
			p.sustainedOk
		);
	}

	private createProgressRow(
		label: string,
		currentText: string,
		targetText: string,
		met: boolean
	): void {
		const row = this.progressSection.createDiv({ cls: 'ct-511-row' });
		row.createSpan({ cls: `ct-511-indicator ${met ? 'ct-511-met' : 'ct-511-unmet'}` });
		row.createSpan({ cls: 'ct-511-label', text: label });
		row.createSpan({ cls: 'ct-511-value', text: currentText });
		row.createSpan({ cls: 'ct-511-target', text: `(${targetText})` });
	}

	private updateStage(stats: ReturnType<typeof getSessionStats>): void {
		if (!stats.laborStage) {
			this.stageSection.addClass('ct-hidden');
			return;
		}

		this.stageSection.removeClass('ct-hidden');
		this.stageSection.empty();
		this.stageSection.className = `ct-stage ct-stage--${stats.laborStage}`;
		this.stageSection.createSpan({ cls: 'ct-stage-label', text: 'Estimated stage: ' });
		this.stageSection.createSpan({
			cls: 'ct-stage-value',
			text: getLaborStageLabel(stats.laborStage),
		});
	}
}
