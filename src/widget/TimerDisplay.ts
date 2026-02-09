import type { TimerPhase } from '../types';
import { formatDuration, formatDurationShort } from '../utils/formatters';

/**
 * Large timer display showing elapsed time during contraction
 * or rest time between contractions.
 * Supports hover-to-pause overlay on desktop and long-press on mobile.
 */
export class TimerDisplay {
	private el: HTMLElement;
	private timeWrapper: HTMLElement;
	private timeEl: HTMLElement;
	private labelEl: HTMLElement;
	private subtitleEl: HTMLElement;
	private pauseOverlay: HTMLElement;
	private onPauseToggle: ((paused: boolean) => void) | null = null;
	private isPaused = false;
	private currentPhase: TimerPhase = 'idle';
	private longPressTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(parent: HTMLElement) {
		this.el = parent.createDiv({ cls: 'ct-timer-display' });
		this.labelEl = this.el.createDiv({ cls: 'ct-timer-label' });

		// Wrap timeEl so pause overlay only covers the time digits
		this.timeWrapper = this.el.createDiv({ cls: 'ct-timer-time-wrapper' });
		this.timeEl = this.timeWrapper.createDiv({ cls: 'ct-timer-time' });
		this.subtitleEl = this.el.createDiv({ cls: 'ct-timer-subtitle' });
		this.timeEl.textContent = '0:00';

		// Pause overlay inside the time wrapper (only covers digits)
		this.pauseOverlay = this.timeWrapper.createDiv({ cls: 'ct-pause-overlay ct-hidden' });
		this.pauseOverlay.createDiv({ cls: 'ct-pause-icon', text: '\u23F8' });
		this.pauseOverlay.createDiv({ cls: 'ct-pause-text', text: 'Tap to pause' });

		this.setupPauseInteractions();
	}

	/** Set callback for pause toggle. */
	setPauseCallback(cb: (paused: boolean) => void): void {
		this.onPauseToggle = cb;
	}

	private setupPauseInteractions(): void {
		// Desktop: hover shows overlay during resting phase
		this.el.addEventListener('mouseenter', () => {
			if (this.currentPhase === 'resting' && !this.isPaused && this.onPauseToggle) {
				this.pauseOverlay.removeClass('ct-hidden');
				this.pauseOverlay.querySelector('.ct-pause-text')!.textContent = 'Tap to pause';
			}
		});
		this.el.addEventListener('mouseleave', () => {
			if (!this.isPaused) {
				this.pauseOverlay.addClass('ct-hidden');
			}
		});

		// Click overlay to toggle pause
		this.pauseOverlay.addEventListener('click', (e) => {
			e.stopPropagation();
			this.togglePause();
		});

		// Also allow clicking the timer itself when in resting phase
		this.el.addEventListener('click', () => {
			if (this.currentPhase === 'resting' && this.onPauseToggle) {
				this.togglePause();
			}
		});

		// Mobile: long-press (500ms) to show overlay
		this.el.addEventListener('touchstart', (e) => {
			if (this.currentPhase === 'resting' && this.onPauseToggle) {
				this.longPressTimer = setTimeout(() => {
					if (!this.isPaused) {
						this.pauseOverlay.removeClass('ct-hidden');
					}
				}, 500);
			}
		}, { passive: true });

		this.el.addEventListener('touchend', () => {
			if (this.longPressTimer) {
				clearTimeout(this.longPressTimer);
				this.longPressTimer = null;
			}
		});
	}

	private togglePause(): void {
		if (!this.onPauseToggle) return;
		this.isPaused = !this.isPaused;
		this.onPauseToggle(this.isPaused);

		if (this.isPaused) {
			this.pauseOverlay.removeClass('ct-hidden');
			this.pauseOverlay.querySelector('.ct-pause-icon')!.textContent = '\u25B6';
			this.pauseOverlay.querySelector('.ct-pause-text')!.textContent = 'Tap to resume';
			this.pauseOverlay.addClass('ct-pause-overlay--active');
		} else {
			this.pauseOverlay.addClass('ct-hidden');
			this.pauseOverlay.querySelector('.ct-pause-icon')!.textContent = '\u23F8';
			this.pauseOverlay.querySelector('.ct-pause-text')!.textContent = 'Tap to pause';
			this.pauseOverlay.removeClass('ct-pause-overlay--active');
		}
	}

	/** Update the displayed time in seconds. */
	update(seconds: number, phase: TimerPhase): void {
		this.currentPhase = phase;
		this.timeEl.textContent = formatDuration(seconds);

		switch (phase) {
			case 'idle':
				this.labelEl.textContent = 'Ready to start';
				this.subtitleEl.textContent = 'Tap the button when a contraction begins';
				this.el.className = 'ct-timer-display';
				this.hidePauseOverlay();
				break;
			case 'contracting':
				this.labelEl.textContent = 'Contracting...';
				this.subtitleEl.textContent = '';
				this.el.className = 'ct-timer-display ct-timer-display--contracting';
				this.hidePauseOverlay();
				break;
			case 'resting':
				this.labelEl.textContent = 'Time since last contraction';
				this.subtitleEl.textContent = '';
				this.el.className = 'ct-timer-display ct-timer-display--resting';
				break;
		}
	}

	/** Show rest time with context about the last contraction. */
	showRest(restSeconds: number, lastDurationSec: number): void {
		this.currentPhase = 'resting';
		this.timeEl.textContent = formatDuration(restSeconds);
		this.labelEl.textContent = 'Time since last contraction';
		this.subtitleEl.textContent = `Last contraction lasted ${formatDurationShort(lastDurationSec)}`;
		this.el.className = 'ct-timer-display ct-timer-display--resting';
	}

	/** Show paused state with frozen time. */
	showPaused(restSeconds: number, lastDurationSec: number): void {
		this.isPaused = true;
		this.timeEl.textContent = formatDuration(restSeconds);
		this.labelEl.textContent = 'Time since last contraction';
		this.subtitleEl.textContent = `Last contraction lasted ${formatDurationShort(lastDurationSec)}`;
		this.el.className = 'ct-timer-display ct-timer-display--paused';

		// Show resume overlay
		if (this.onPauseToggle) {
			this.pauseOverlay.removeClass('ct-hidden');
			this.pauseOverlay.querySelector('.ct-pause-icon')!.textContent = '\u25B6';
			this.pauseOverlay.querySelector('.ct-pause-text')!.textContent = 'Tap to resume';
			this.pauseOverlay.addClass('ct-pause-overlay--active');
		}
	}

	/** Externally set pause state (e.g. when unpaused by starting contraction). */
	setPaused(paused: boolean): void {
		this.isPaused = paused;
		if (!paused) {
			this.hidePauseOverlay();
		}
	}

	getEl(): HTMLElement {
		return this.el;
	}

	private hidePauseOverlay(): void {
		this.isPaused = false;
		this.pauseOverlay.addClass('ct-hidden');
		this.pauseOverlay.removeClass('ct-pause-overlay--active');
	}
}
