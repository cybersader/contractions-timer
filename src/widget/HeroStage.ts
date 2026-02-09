import type { Contraction, SessionStats, TimerPhase, LaborStage, Parity, StageThresholdConfig } from '../types';
import { getTimeInCurrentStage } from '../data/calculations';
import { getLaborStageLabel, formatElapsedApprox, formatDurationRange } from '../utils/formatters';

const STAGE_COLORS: Record<string, string> = {
	'pre-labor': 'var(--text-muted)',
	early: 'var(--color-green)',
	active: 'var(--color-orange)',
	transition: 'var(--color-red)',
};

/**
 * Stage badge hero: large centered badge showing the estimated labor stage,
 * time in stage, and typical duration range.
 */
export class HeroStage {
	private el: HTMLElement;
	private badgeEl: HTMLElement;
	private timeEl: HTMLElement;
	private rangeEl: HTMLElement;
	private stageThresholds: Record<string, StageThresholdConfig>;
	private parity: Parity;

	constructor(parent: HTMLElement, stageThresholds: Record<string, StageThresholdConfig>, parity: Parity) {
		this.stageThresholds = stageThresholds;
		this.parity = parity;
		this.el = parent.createDiv({ cls: 'ct-hero ct-hero-stage' });
		this.badgeEl = this.el.createDiv({ cls: 'ct-hero-badge' });
		this.badgeEl.textContent = 'Ready to start';
		this.timeEl = this.el.createDiv({ cls: 'ct-hero-time' });
		this.rangeEl = this.el.createDiv({ cls: 'ct-hero-range' });
	}

	update(phase: TimerPhase, contractions: Contraction[], stats: SessionStats): void {
		const stage = stats.laborStage;

		if (phase === 'idle' || !stage) {
			this.badgeEl.textContent = 'Ready to start';
			this.badgeEl.style.color = 'var(--text-muted)';
			this.timeEl.textContent = '';
			this.rangeEl.textContent = '';
			return;
		}

		this.badgeEl.textContent = getLaborStageLabel(stage).toUpperCase();
		this.badgeEl.style.color = STAGE_COLORS[stage] || 'var(--text-normal)';

		// Time in stage — hidden for pre-labor (no meaningful expected duration)
		if (stage !== 'pre-labor') {
			const stageInfo = getTimeInCurrentStage(contractions, this.stageThresholds);
			if (stageInfo) {
				this.timeEl.textContent = `${formatElapsedApprox(stageInfo.minutesInStage)} in this stage`;
			} else {
				this.timeEl.textContent = '';
			}
		} else {
			this.timeEl.textContent = '';
		}

		// Typical duration range — hidden for pre-labor
		const config = this.stageThresholds[stage];
		if (config && stage !== 'pre-labor') {
			const range = this.parity === 'first-baby'
				? config.typicalDurationFirstMin
				: config.typicalDurationSubsequentMin;
			const rangeStr = formatDurationRange(range);
			this.rangeEl.textContent = rangeStr ? `Typically ${rangeStr}` : '';
		} else {
			this.rangeEl.textContent = '';
		}
	}

	setPaused(paused: boolean): void {
		if (paused) {
			this.el.addClass('ct-hero--paused');
		} else {
			this.el.removeClass('ct-hero--paused');
		}
	}

	getEl(): HTMLElement {
		return this.el;
	}
}
