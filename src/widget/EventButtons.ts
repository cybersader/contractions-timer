import type { LaborEventType, LaborEvent } from '../types';
import { formatTimeShort } from '../utils/formatters';
import { haptic } from '../utils/dom';

/**
 * Event recording buttons (water broke, etc.) displayed below the BigButton.
 */
export class EventButtons {
	private el: HTMLElement;
	private waterBtn: HTMLButtonElement;
	private undoBtn: HTMLButtonElement | null = null;
	private onEvent: (type: LaborEventType) => void;
	private onUndo: ((type: LaborEventType) => void) | null = null;
	private confirmed = false;
	private hapticEnabled: boolean;

	constructor(
		parent: HTMLElement,
		onEvent: (type: LaborEventType) => void,
		hapticEnabled: boolean = true
	) {
		this.onEvent = onEvent;
		this.hapticEnabled = hapticEnabled;
		this.el = parent.createDiv({ cls: 'ct-event-buttons' });

		this.waterBtn = this.el.createEl('button', {
			cls: 'ct-event-btn ct-event-btn--water-break',
		});
		this.setWaterLabel('Water broke');
		this.waterBtn.addEventListener('click', () => {
			if (this.confirmed) return;
			if (hapticEnabled) haptic(50);
			this.onEvent('water-break');
		});
	}

	/** Set a callback for undoing an event. */
	setUndoCallback(onUndo: (type: LaborEventType) => void): void {
		this.onUndo = onUndo;
	}

	/** Show confirmation state after recording the event. */
	showConfirmation(event: LaborEvent): void {
		this.confirmed = true;
		const time = formatTimeShort(new Date(event.timestamp));
		this.setWaterLabel(`\u2713 Water broke at ${time}`);
		this.waterBtn.addClass('ct-event-btn--confirmed');
		this.waterBtn.disabled = true;

		// Add undo button if not already present
		if (!this.undoBtn) {
			this.undoBtn = this.el.createEl('button', {
				cls: 'ct-event-btn ct-event-btn--undo',
				text: 'Undo',
				title: 'If you misclicked you can use this',
			});
			this.undoBtn.addEventListener('click', () => {
				if (this.hapticEnabled) haptic(30);
				this.resetWaterButton();
				if (this.onUndo) this.onUndo('water-break');
			});
		}
	}

	/** Reset the water button back to its initial state. */
	private resetWaterButton(): void {
		this.confirmed = false;
		this.setWaterLabel('Water broke');
		this.waterBtn.removeClass('ct-event-btn--confirmed');
		this.waterBtn.disabled = false;

		if (this.undoBtn) {
			this.undoBtn.remove();
			this.undoBtn = null;
		}
	}

	/** Check if water break was already recorded and show confirmation. */
	updateFromEvents(events: LaborEvent[]): void {
		const waterBreak = events.find(e => e.type === 'water-break');
		if (waterBreak) {
			this.showConfirmation(waterBreak);
		} else {
			this.resetWaterButton();
		}
	}

	/** Set water button content with a droplet icon prefix. */
	private setWaterLabel(text: string): void {
		this.waterBtn.empty();
		this.waterBtn.createSpan({ cls: 'ct-water-icon', text: '\uD83D\uDCA7' });
		this.waterBtn.createSpan({ text: ` ${text}` });
	}

	show(): void {
		this.el.removeClass('ct-hidden');
	}

	hide(): void {
		this.el.addClass('ct-hidden');
	}
}
