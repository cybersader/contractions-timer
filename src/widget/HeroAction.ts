import type { Contraction, SessionStats, TimerPhase, LaborStage } from '../types';
import type { RangeEstimate } from '../data/hospitalAdvisor';

interface ActionConfig {
	text: string;
	cls: string;
}

const STAGE_ACTIONS: Record<string, ActionConfig> = {
	'pre-labor': { text: 'Continue normal activities', cls: 'ct-hero-action--prelabor' },
	early: { text: 'Rest and hydrate \u2014 stay home', cls: 'ct-hero-action--early' },
	active: { text: 'Head to hospital soon', cls: 'ct-hero-action--active' },
	transition: { text: 'You should be at the hospital', cls: 'ct-hero-action--transition' },
};

const PHASE_ACTIONS: Record<string, ActionConfig> = {
	idle: { text: 'Tap start when a contraction begins', cls: 'ct-hero-action--idle' },
};

/** Stage-aware messages shown during an active contraction */
const CONTRACTION_MESSAGES: Record<string, string> = {
	'pre-labor': 'Stay relaxed...',
	early: 'Nice and easy...',
	active: 'Breathe through it...',
	transition: 'One at a time \u2014 you\'ve got this',
};
const DEFAULT_CONTRACTION_MSG = 'Breathe through it...';

/**
 * Action card hero: dynamic card showing what to do NOW,
 * color-coded by urgency. Includes hospital time range when available.
 */
export class HeroAction {
	private el: HTMLElement;
	private actionText: HTMLElement;
	private detailText: HTMLElement;
	private hospitalLine: HTMLElement;
	private onHospitalClick: (() => void) | null = null;
	private waterBroke = false;

	constructor(parent: HTMLElement) {
		this.el = parent.createDiv({ cls: 'ct-hero ct-hero-action' });
		this.actionText = this.el.createDiv({ cls: 'ct-hero-action-text' });
		this.detailText = this.el.createDiv({ cls: 'ct-hero-action-detail' });
		this.hospitalLine = this.el.createDiv({ cls: 'ct-hero-action-hospital ct-hidden' });
		this.actionText.textContent = 'Tap start when a contraction begins';

		this.hospitalLine.addEventListener('click', () => {
			if (this.onHospitalClick) this.onHospitalClick();
		});
	}

	/** Set callback for when user taps the hospital time line. */
	setHospitalClickCallback(cb: () => void): void {
		this.onHospitalClick = cb;
	}

	update(phase: TimerPhase, contractions: Contraction[], stats: SessionStats, rangeEstimate?: RangeEstimate): void {
		// Reset classes
		this.el.className = 'ct-hero ct-hero-action';
		this.hospitalLine.addClass('ct-hidden');

		if (phase === 'contracting') {
			const msg = (stats.laborStage && CONTRACTION_MESSAGES[stats.laborStage])
				|| DEFAULT_CONTRACTION_MSG;
			this.actionText.textContent = msg;
			this.el.addClass('ct-hero-action--contracting');
			this.detailText.textContent = '';
			return;
		}

		if (phase === 'idle' || !stats.laborStage) {
			const config = PHASE_ACTIONS.idle;
			this.actionText.textContent = config.text;
			this.el.addClass(config.cls);
			this.detailText.textContent = '';
			return;
		}

		const config = STAGE_ACTIONS[stats.laborStage] || STAGE_ACTIONS['pre-labor'];
		this.actionText.textContent = config.text;
		this.el.addClass(config.cls);

		// Detail line with stats
		if (stats.avgIntervalMin > 0) {
			this.detailText.textContent =
				`~${stats.avgIntervalMin.toFixed(0)} min apart \u00B7 ~${Math.round(stats.avgDurationSec)}s avg`;
		} else {
			this.detailText.textContent = '';
		}

		// Water break override — show urgent messaging when not contracting
		if (this.waterBroke) {
			this.el.addClass('ct-hero-action--water-broke');
			if (!stats.laborStage || stats.laborStage === 'pre-labor' || stats.laborStage === 'early') {
				this.actionText.textContent = 'Water broke \u2014 call your provider';
			} else if (stats.laborStage === 'active') {
				this.actionText.textContent = 'Water broke + active labor \u2014 head to hospital';
			}
			// transition: existing text is already urgent enough
		}

		// Hospital time range line
		if (rangeEstimate && (rangeEstimate.earliestMinutes > 0 || rangeEstimate.latestMinutes > 0)) {
			const earliest = this.formatTimeRange(rangeEstimate.earliestMinutes);
			const latest = this.formatTimeRange(rangeEstimate.latestMinutes);
			this.hospitalLine.textContent =
				`Hospital: ~${earliest} \u2013 ${latest} \u25B8`;
			this.hospitalLine.removeClass('ct-hidden');
		} else if (rangeEstimate && rangeEstimate.recommendation) {
			// Already at hospital-worthy stage
			const completed = contractions.filter(c => c.end !== null);
			if (completed.length >= 3 && stats.laborStage !== 'pre-labor') {
				this.hospitalLine.textContent = `${rangeEstimate.recommendation} \u25B8`;
				this.hospitalLine.removeClass('ct-hidden');
			}
		}
	}

	private formatTimeRange(minutes: number): string {
		if (minutes <= 0) return 'now';
		if (minutes < 60) return `${Math.round(minutes)} min`;
		const hours = minutes / 60;
		return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
	}

	setWaterBroke(active: boolean): void {
		this.waterBroke = active;
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
