import type { TimerPhase } from '../types';
import { haptic } from '../utils/dom';

/**
 * The primary interaction element: a large, touch-friendly start/stop button.
 */
export class BigButton {
	private el: HTMLButtonElement;
	private phase: TimerPhase = 'idle';
	private onStart: () => void;
	private onStop: () => void;
	private hapticEnabled: boolean;
	private nextNumber = 1;

	constructor(
		parent: HTMLElement,
		onStart: () => void,
		onStop: () => void,
		hapticEnabled: boolean = true
	) {
		this.onStart = onStart;
		this.onStop = onStop;
		this.hapticEnabled = hapticEnabled;

		this.el = parent.createEl('button', {
			cls: 'ct-big-button ct-big-button--idle',
			text: 'Start contraction',
		});
		this.el.addEventListener('click', () => this.handleClick());
	}

	private handleClick(): void {
		if (this.hapticEnabled) haptic(50);

		if (this.phase === 'contracting') {
			this.onStop();
		} else {
			this.onStart();
		}
	}

	setPhase(phase: TimerPhase): void {
		this.phase = phase;
		this.el.className = `ct-big-button ct-big-button--${phase}`;
		this.updateText();
	}

	setNextNumber(n: number): void {
		this.nextNumber = n;
		this.updateText();
	}

	private updateText(): void {
		switch (this.phase) {
			case 'idle':
				this.el.textContent = 'Start contraction';
				break;
			case 'contracting':
				this.el.textContent = 'Stop';
				break;
			case 'resting':
				this.el.textContent = `Start contraction #${this.nextNumber}`;
				break;
		}
	}

	setDisabled(disabled: boolean): void {
		this.el.disabled = disabled;
	}

	getEl(): HTMLElement {
		return this.el;
	}
}
