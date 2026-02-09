import type { Contraction, SessionStats, TimerPhase } from '../types';
import { getElapsedSeconds, getRestSeconds, getDurationSeconds } from '../data/calculations';
import { formatDuration, formatDurationShort } from '../utils/formatters';

/**
 * Compact timer hero: single line with rest time / contraction time,
 * minimal footprint above the big button.
 */
export class HeroCompactTimer {
	private el: HTMLElement;
	private lineEl: HTMLElement;
	private contractions: Contraction[] = [];

	constructor(parent: HTMLElement) {
		this.el = parent.createDiv({ cls: 'ct-hero ct-hero-compact' });
		this.lineEl = this.el.createDiv({ cls: 'ct-hero-compact-line' });
		this.lineEl.textContent = 'Ready to start';
	}

	update(phase: TimerPhase, contractions: Contraction[], stats: SessionStats): void {
		this.contractions = contractions;

		if (phase === 'idle') {
			this.lineEl.textContent = 'Ready to start';
			this.el.className = 'ct-hero ct-hero-compact';
			return;
		}

		if (phase === 'contracting') {
			const active = contractions.find(c => c.end === null);
			if (active) {
				const elapsed = getElapsedSeconds(active);
				this.lineEl.textContent = `Contracting: ${formatDuration(elapsed)}`;
			}
			this.el.className = 'ct-hero ct-hero-compact ct-hero-compact--contracting';
			return;
		}

		// Resting
		const restSec = getRestSeconds(contractions);
		const completed = contractions.filter(c => c.end !== null);
		const last = completed.length > 0 ? completed[completed.length - 1] : null;
		const lastDur = last ? getDurationSeconds(last) : 0;

		this.lineEl.textContent = `Rest: ${formatDuration(restSec)} \u00B7 Last: ${formatDurationShort(lastDur)}`;
		this.el.className = 'ct-hero ct-hero-compact ct-hero-compact--resting';
	}

	/** Re-update the live display during tick (called from TimerWidget). */
	tick(phase: TimerPhase): void {
		if (phase === 'contracting') {
			const active = this.contractions.find(c => c.end === null);
			if (active) {
				const elapsed = getElapsedSeconds(active);
				this.lineEl.textContent = `Contracting: ${formatDuration(elapsed)}`;
			}
		} else if (phase === 'resting') {
			const restSec = getRestSeconds(this.contractions);
			const completed = this.contractions.filter(c => c.end !== null);
			const last = completed.length > 0 ? completed[completed.length - 1] : null;
			const lastDur = last ? getDurationSeconds(last) : 0;
			this.lineEl.textContent = `Rest: ${formatDuration(restSec)} \u00B7 Last: ${formatDurationShort(lastDur)}`;
		}
	}

	setPaused(paused: boolean): void {
		if (paused) {
			this.el.addClass('ct-hero--paused');
			this.lineEl.textContent = 'Paused';
		} else {
			this.el.removeClass('ct-hero--paused');
		}
	}

	getEl(): HTMLElement {
		return this.el;
	}
}
