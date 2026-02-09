import type { ContractionPhases } from '../types';

/**
 * Single-button live contraction rating overlay.
 * Shows a "Past the peak" button during a contraction.
 * When tapped, records the elapsed seconds as the peak offset.
 * This gives the wave chart asymmetric curve data.
 *
 * Design rationale: you don't know you've hit the peak
 * until the contraction starts easing. So we only need
 * one button — "It's easing" — which implicitly marks the peak.
 */
export class LiveRatingOverlay {
	private el: HTMLElement;
	private btn: HTMLButtonElement;
	private active = false;
	private peakOffsetSec: number | null = null;
	private currentElapsed = 0;
	private callback: ((phases: ContractionPhases) => void) | null = null;
	private haptic: boolean;

	constructor(parent: HTMLElement, haptic: boolean) {
		this.haptic = haptic;
		// Render directly as a button (no wrapper div) — sits inline in the button row
		this.el = parent.createDiv({ cls: 'ct-live-rating-wrap ct-hidden' });
		this.btn = this.el.createEl('button', {
			cls: 'ct-live-rating-peak-btn',
			text: 'Past the peak',
		});
		this.btn.addEventListener('click', () => this.markPeak());
	}

	setCallback(cb: (phases: ContractionPhases) => void): void {
		this.callback = cb;
	}

	/** Reset for a new contraction. */
	begin(): void {
		this.peakOffsetSec = null;
		this.currentElapsed = 0;
		this.active = true;
		this.el.addClass('ct-hidden');
		this.btn.textContent = 'Past the peak';
		this.btn.disabled = false;
		this.btn.removeClass('ct-live-rating-peak-btn--done');
	}

	/** Called every tick with elapsed seconds of the active contraction. */
	tick(elapsedSeconds: number): void {
		this.currentElapsed = elapsedSeconds;
		if (!this.active) return;

		// Show the button after 5 seconds (too early feels premature)
		if (elapsedSeconds >= 5 && this.peakOffsetSec === null) {
			this.el.removeClass('ct-hidden');
		}
	}

	/** Called when the contraction ends. */
	onContractionEnd(): void {
		this.active = false;
		this.el.addClass('ct-hidden');
	}

	/** Hide the overlay. */
	hide(): void {
		this.el.addClass('ct-hidden');
		this.active = false;
	}

	/** Get the current phase ratings (backward-compatible format). */
	getPhases(): ContractionPhases {
		return {
			building: null,
			peak: null,
			easing: null,
			peakOffsetSec: this.peakOffsetSec ?? undefined,
		};
	}

	private markPeak(): void {
		if (this.peakOffsetSec !== null) return; // Already marked
		if (this.haptic && navigator.vibrate) navigator.vibrate(10);

		this.peakOffsetSec = Math.round(this.currentElapsed);

		// Visual feedback — show confirmed state briefly then hide
		this.btn.textContent = 'Peak marked';
		this.btn.disabled = true;
		this.btn.addClass('ct-live-rating-peak-btn--done');

		setTimeout(() => {
			this.el.addClass('ct-hidden');
		}, 800);

		if (this.callback) {
			this.callback(this.getPhases());
		}
	}
}
