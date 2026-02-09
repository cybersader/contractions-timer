import type { LaborEventType, LaborEvent } from '../types';
import { formatTimeShort } from '../utils/formatters';
import { haptic } from '../utils/dom';

/**
 * Water break event button with undo + edit-time picker.
 */
export class EventButtons {
	private el: HTMLElement;
	private waterBtn: HTMLButtonElement;
	private actionsRow: HTMLElement | null = null;
	private undoBtn: HTMLButtonElement | null = null;
	private editBtn: HTMLButtonElement | null = null;
	private timePickerEl: HTMLElement | null = null;
	private customStepperEl: HTMLElement | null = null;
	private pillsGrid: HTMLElement | null = null;

	private onEvent: (type: LaborEventType) => void;
	private onUndo: ((type: LaborEventType) => void) | null = null;
	private onEditTime: ((type: LaborEventType, minutesAgo: number) => void) | null = null;
	private confirmed = false;
	private hapticEnabled: boolean;

	// Custom stepper state
	private customHours = 1;
	private customMinutes = 0;
	private customDisplay: HTMLElement | null = null;
	private hourDisplay: HTMLElement | null = null;
	private minDisplay: HTMLElement | null = null;

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

	setUndoCallback(onUndo: (type: LaborEventType) => void): void {
		this.onUndo = onUndo;
	}

	setEditTimeCallback(onEditTime: (type: LaborEventType, minutesAgo: number) => void): void {
		this.onEditTime = onEditTime;
	}

	showConfirmation(event: LaborEvent): void {
		this.confirmed = true;
		const time = formatTimeShort(new Date(event.timestamp));
		this.setWaterLabel(`\u2713 Water broke at ${time}`);
		this.waterBtn.addClass('ct-event-btn--confirmed');
		this.waterBtn.disabled = true;

		if (!this.actionsRow) {
			this.actionsRow = this.el.createDiv({ cls: 'ct-water-actions' });

			this.editBtn = this.actionsRow.createEl('button', {
				cls: 'ct-event-btn ct-event-btn--edit',
				title: 'Edit time',
			});
			this.editBtn.createSpan({ text: '\u270F\uFE0F' });
			this.editBtn.createSpan({ text: ' Edit time' });
			this.editBtn.addEventListener('click', () => {
				if (this.hapticEnabled) haptic(30);
				this.showTimePicker();
			});

			this.undoBtn = this.actionsRow.createEl('button', {
				cls: 'ct-event-btn ct-event-btn--undo',
				text: 'Undo water broke',
				title: 'Remove water break record',
			});
			this.undoBtn.addEventListener('click', () => {
				if (this.hapticEnabled) haptic(30);
				this.resetWaterButton();
				if (this.onUndo) this.onUndo('water-break');
			});
		}
	}

	private showTimePicker(): void {
		if (this.actionsRow) this.actionsRow.addClass('ct-hidden');

		if (!this.timePickerEl) {
			this.timePickerEl = this.el.createDiv({ cls: 'ct-time-pills' });

			// Header
			const header = this.timePickerEl.createDiv({ cls: 'ct-time-pills-header' });
			header.createSpan({ text: 'When did it happen?' });
			const cancelBtn = header.createEl('button', {
				cls: 'ct-time-pill-cancel',
				text: '\u2715',
			});
			cancelBtn.addEventListener('click', () => this.hideTimePicker());

			// Quick-pick grid
			this.pillsGrid = this.timePickerEl.createDiv({ cls: 'ct-time-pills-grid' });
			const times = [
				{ label: 'Just now', minutes: 0 },
				{ label: '~5 min ago', minutes: 5 },
				{ label: '~15 min ago', minutes: 15 },
				{ label: '~30 min ago', minutes: 30 },
			];
			for (const t of times) {
				const pill = this.pillsGrid.createEl('button', {
					cls: 'ct-time-pill',
					text: t.label,
				});
				pill.addEventListener('click', () => {
					if (this.hapticEnabled) haptic(30);
					this.pickTime(t.minutes);
				});
			}
			// Earlier...
			const customPill = this.pillsGrid.createEl('button', {
				cls: 'ct-time-pill ct-time-pill--custom',
				text: 'Earlier...',
			});
			customPill.addEventListener('click', () => {
				if (this.hapticEnabled) haptic(30);
				this.showCustomStepper();
			});

			// Custom stepper (hidden initially)
			this.customStepperEl = this.timePickerEl.createDiv({ cls: 'ct-custom-stepper ct-hidden' });
			this.buildCustomStepper();
		} else {
			this.timePickerEl.removeClass('ct-hidden');
			if (this.pillsGrid) this.pillsGrid.removeClass('ct-hidden');
			if (this.customStepperEl) this.customStepperEl.addClass('ct-hidden');
		}
	}

	private hideTimePicker(): void {
		if (this.timePickerEl) this.timePickerEl.addClass('ct-hidden');
		if (this.actionsRow) this.actionsRow.removeClass('ct-hidden');
	}

	private showCustomStepper(): void {
		this.customHours = 1;
		this.customMinutes = 0;
		this.updateStepperDisplay();
		if (this.pillsGrid) this.pillsGrid.addClass('ct-hidden');
		if (this.customStepperEl) this.customStepperEl.removeClass('ct-hidden');
	}

	private buildCustomStepper(): void {
		if (!this.customStepperEl) return;

		const stepperRow = this.customStepperEl.createDiv({ cls: 'ct-stepper-controls' });

		// Hours
		const hourGroup = stepperRow.createDiv({ cls: 'ct-stepper-group' });
		const hourMinus = hourGroup.createEl('button', { cls: 'ct-stepper-btn', text: '\u2212' });
		this.hourDisplay = hourGroup.createDiv({ cls: 'ct-stepper-value' });
		const hourPlus = hourGroup.createEl('button', { cls: 'ct-stepper-btn', text: '+' });

		stepperRow.createDiv({ cls: 'ct-stepper-sep', text: ':' });

		// Minutes
		const minGroup = stepperRow.createDiv({ cls: 'ct-stepper-group' });
		const minMinus = minGroup.createEl('button', { cls: 'ct-stepper-btn', text: '\u2212' });
		this.minDisplay = minGroup.createDiv({ cls: 'ct-stepper-value' });
		const minPlus = minGroup.createEl('button', { cls: 'ct-stepper-btn', text: '+' });

		hourMinus.addEventListener('click', () => {
			if (this.customHours > 0) { this.customHours--; if (this.hapticEnabled) haptic(20); this.updateStepperDisplay(); }
		});
		hourPlus.addEventListener('click', () => {
			if (this.customHours < 48) { this.customHours++; if (this.hapticEnabled) haptic(20); this.updateStepperDisplay(); }
		});
		minMinus.addEventListener('click', () => {
			if (this.customMinutes > 0) { this.customMinutes -= 15; }
			else if (this.customHours > 0) { this.customHours--; this.customMinutes = 45; }
			if (this.hapticEnabled) haptic(20); this.updateStepperDisplay();
		});
		minPlus.addEventListener('click', () => {
			if (this.customMinutes < 45) { this.customMinutes += 15; }
			else { this.customMinutes = 0; if (this.customHours < 48) this.customHours++; }
			if (this.hapticEnabled) haptic(20); this.updateStepperDisplay();
		});

		this.customDisplay = this.customStepperEl.createDiv({ cls: 'ct-stepper-preview' });

		const logBtn = this.customStepperEl.createEl('button', {
			cls: 'ct-stepper-log-btn',
			text: 'Set time',
		});
		logBtn.addEventListener('click', () => {
			if (this.hapticEnabled) haptic(30);
			this.pickTime(this.customHours * 60 + this.customMinutes);
		});

		this.updateStepperDisplay();
	}

	private updateStepperDisplay(): void {
		if (this.hourDisplay) this.hourDisplay.textContent = `${this.customHours}h`;
		if (this.minDisplay) this.minDisplay.textContent = `${this.customMinutes}m`;
		if (this.customDisplay) {
			const total = this.customHours * 60 + this.customMinutes;
			if (total === 0) {
				this.customDisplay.textContent = 'Set a time above';
			} else {
				const when = new Date(Date.now() - total * 60000);
				this.customDisplay.textContent = `Around ${formatTimeShort(when)}`;
			}
		}
	}

	private pickTime(minutesAgo: number): void {
		this.hideTimePicker();
		if (this.onEditTime) this.onEditTime('water-break', minutesAgo);
	}

	private resetWaterButton(): void {
		this.confirmed = false;
		this.setWaterLabel('Water broke');
		this.waterBtn.removeClass('ct-event-btn--confirmed');
		this.waterBtn.disabled = false;

		if (this.actionsRow) { this.actionsRow.remove(); this.actionsRow = null; this.undoBtn = null; this.editBtn = null; }
		if (this.timePickerEl) { this.timePickerEl.remove(); this.timePickerEl = null; this.pillsGrid = null; this.customStepperEl = null; }
	}

	updateFromEvents(events: LaborEvent[]): void {
		const waterBreak = events.find(e => e.type === 'water-break');
		if (waterBreak) {
			this.showConfirmation(waterBreak);
		} else {
			this.resetWaterButton();
		}
	}

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
