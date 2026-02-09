import { formatTimeShort } from '../utils/formatters';
import { haptic } from '../utils/dom';

/**
 * "Had one" button + time-ago picker + confirmation.
 * Lives inline in the button row next to the BigButton.
 *
 * States:
 * - idle: Compact "Had one" button visible
 * - picking: Time-ago pills replace the BigButton
 * - custom: Hour/minute stepper replaces the pills
 * - confirmed: Confirmation + intensity picker appears above button row
 */
export class UntimedPicker {
	private hadOneBtn: HTMLButtonElement;
	private pillsRow: HTMLElement;
	private pillsGrid: HTMLElement;
	private customRow: HTMLElement;
	private confirmEl: HTMLElement;
	private state: 'idle' | 'picking' | 'custom' | 'confirmed' = 'idle';
	private hapticEnabled: boolean;

	// Custom stepper state
	private customHours = 1;
	private customMinutes = 0;
	private customDisplay: HTMLElement | null = null;

	private onLog: (minutesAgo: number) => void;
	private onUndo: () => void;
	private onIntensity: (level: number) => void;
	private onStateChange: (state: 'idle' | 'picking' | 'confirmed') => void;

	constructor(
		buttonRow: HTMLElement,
		confirmParent: HTMLElement,
		callbacks: {
			onLog: (minutesAgo: number) => void;
			onUndo: () => void;
			onIntensity: (level: number) => void;
			onStateChange: (state: 'idle' | 'picking' | 'confirmed') => void;
		},
		hapticEnabled = true
	) {
		this.onLog = callbacks.onLog;
		this.onUndo = callbacks.onUndo;
		this.onIntensity = callbacks.onIntensity;
		this.onStateChange = callbacks.onStateChange;
		this.hapticEnabled = hapticEnabled;

		// "Had one" button (compact, appears left of BigButton)
		this.hadOneBtn = buttonRow.createEl('button', {
			cls: 'ct-had-one-btn',
		});
		this.hadOneBtn.createDiv({ cls: 'ct-had-one-main', text: 'Had one' });
		this.hadOneBtn.createDiv({ cls: 'ct-had-one-sub', text: 'Log missed' });
		this.hadOneBtn.addEventListener('click', () => this.enterPicking());

		// Time-ago pills (hidden initially, replaces BigButton in button row)
		this.pillsRow = buttonRow.createDiv({ cls: 'ct-time-pills ct-hidden' });

		const header = this.pillsRow.createDiv({ cls: 'ct-time-pills-header' });
		header.createSpan({ text: 'How long ago?' });
		const cancelBtn = header.createEl('button', {
			cls: 'ct-time-pill-cancel',
			text: '\u2715',
		});
		cancelBtn.addEventListener('click', () => this.cancel());

		// Quick-pick pills grid
		this.pillsGrid = this.pillsRow.createDiv({ cls: 'ct-time-pills-grid' });
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
				if (hapticEnabled) haptic(30);
				this.pickTime(t.minutes);
			});
		}
		// "Custom..." pill spans full width
		const customPill = this.pillsGrid.createEl('button', {
			cls: 'ct-time-pill ct-time-pill--custom',
			text: 'Earlier...',
		});
		customPill.addEventListener('click', () => {
			if (hapticEnabled) haptic(30);
			this.enterCustom();
		});

		// Custom time stepper (hidden initially, shown in place of pills grid)
		this.customRow = this.pillsRow.createDiv({ cls: 'ct-custom-stepper ct-hidden' });
		this.buildCustomStepper();

		// Confirmation area (hidden initially, shown above button row)
		this.confirmEl = confirmParent.createDiv({ cls: 'ct-untimed-confirm ct-hidden' });
	}

	private buildCustomStepper(): void {
		const stepperRow = this.customRow.createDiv({ cls: 'ct-stepper-controls' });

		// Hours control
		const hourGroup = stepperRow.createDiv({ cls: 'ct-stepper-group' });
		const hourMinus = hourGroup.createEl('button', { cls: 'ct-stepper-btn', text: '\u2212' });
		const hourDisplay = hourGroup.createDiv({ cls: 'ct-stepper-value' });
		const hourPlus = hourGroup.createEl('button', { cls: 'ct-stepper-btn', text: '+' });

		// Separator
		stepperRow.createDiv({ cls: 'ct-stepper-sep', text: ':' });

		// Minutes control
		const minGroup = stepperRow.createDiv({ cls: 'ct-stepper-group' });
		const minMinus = minGroup.createEl('button', { cls: 'ct-stepper-btn', text: '\u2212' });
		const minDisplay = minGroup.createDiv({ cls: 'ct-stepper-value' });
		const minPlus = minGroup.createEl('button', { cls: 'ct-stepper-btn', text: '+' });

		hourMinus.addEventListener('click', () => {
			if (this.customHours > 0) {
				this.customHours--;
				if (this.hapticEnabled) haptic(20);
				this.updateCustomDisplay();
			}
		});
		hourPlus.addEventListener('click', () => {
			if (this.customHours < 48) {
				this.customHours++;
				if (this.hapticEnabled) haptic(20);
				this.updateCustomDisplay();
			}
		});
		minMinus.addEventListener('click', () => {
			if (this.customMinutes > 0) {
				this.customMinutes -= 15;
			} else if (this.customHours > 0) {
				this.customHours--;
				this.customMinutes = 45;
			}
			if (this.hapticEnabled) haptic(20);
			this.updateCustomDisplay();
		});
		minPlus.addEventListener('click', () => {
			if (this.customMinutes < 45) {
				this.customMinutes += 15;
			} else {
				this.customMinutes = 0;
				if (this.customHours < 48) this.customHours++;
			}
			if (this.hapticEnabled) haptic(20);
			this.updateCustomDisplay();
		});

		this.customDisplay = this.customRow.createDiv({ cls: 'ct-stepper-preview' });

		// Log button
		const logBtn = this.customRow.createEl('button', {
			cls: 'ct-stepper-log-btn',
			text: 'Log it',
		});
		logBtn.addEventListener('click', () => {
			if (this.hapticEnabled) haptic(30);
			const totalMinutes = this.customHours * 60 + this.customMinutes;
			this.pickTime(totalMinutes);
		});

		// Store references for updates
		(this as any)._hourDisplay = hourDisplay;
		(this as any)._minDisplay = minDisplay;
		this.updateCustomDisplay();
	}

	private updateCustomDisplay(): void {
		const hd = (this as any)._hourDisplay as HTMLElement;
		const md = (this as any)._minDisplay as HTMLElement;
		if (hd) hd.textContent = `${this.customHours}h`;
		if (md) md.textContent = `${this.customMinutes}m`;
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

	private enterPicking(): void {
		if (this.hapticEnabled) haptic(50);
		this.state = 'picking';
		this.hadOneBtn.addClass('ct-hidden');
		this.pillsGrid.removeClass('ct-hidden');
		this.customRow.addClass('ct-hidden');
		this.pillsRow.removeClass('ct-hidden');
		this.onStateChange('picking');
	}

	private enterCustom(): void {
		this.state = 'custom';
		this.customHours = 1;
		this.customMinutes = 0;
		this.updateCustomDisplay();
		this.pillsGrid.addClass('ct-hidden');
		this.customRow.removeClass('ct-hidden');
		this.onStateChange('picking'); // BigButton stays hidden
	}

	private cancel(): void {
		this.state = 'idle';
		this.pillsRow.addClass('ct-hidden');
		this.customRow.addClass('ct-hidden');
		this.pillsGrid.removeClass('ct-hidden');
		this.hadOneBtn.removeClass('ct-hidden');
		this.onStateChange('idle');
	}

	private pickTime(minutesAgo: number): void {
		this.state = 'confirmed';
		this.pillsRow.addClass('ct-hidden');
		this.customRow.addClass('ct-hidden');
		this.pillsGrid.removeClass('ct-hidden');
		this.hadOneBtn.removeClass('ct-hidden');
		this.onLog(minutesAgo);
		this.onStateChange('confirmed');
	}

	/** Show confirmation with timestamp, intensity picker, and undo. */
	showConfirmation(timestamp: string): void {
		this.confirmEl.empty();
		this.confirmEl.removeClass('ct-hidden');

		const time = formatTimeShort(new Date(timestamp));
		this.confirmEl.createDiv({
			cls: 'ct-untimed-confirm-header',
			text: `\u2713 Logged at ${time}`,
		});

		// Intensity picker row
		const intensityRow = this.confirmEl.createDiv({ cls: 'ct-untimed-intensity' });
		intensityRow.createSpan({ cls: 'ct-untimed-intensity-label', text: 'How strong?' });
		const btnRow = intensityRow.createDiv({ cls: 'ct-untimed-intensity-btns' });

		const levels = [
			{ level: 1, label: 'Mild' },
			{ level: 3, label: 'Moderate' },
			{ level: 5, label: 'Strong' },
		];
		for (const { level, label } of levels) {
			const btn = btnRow.createEl('button', {
				cls: `ct-intensity-btn ct-intensity-btn--${level}`,
				text: label,
			});
			btn.addEventListener('click', () => {
				if (this.hapticEnabled) haptic(30);
				btnRow.querySelectorAll('.ct-intensity-btn').forEach(b =>
					(b as HTMLElement).removeClass('ct-intensity-btn--selected'));
				btn.addClass('ct-intensity-btn--selected');
				this.onIntensity(level);
			});
		}

		// Undo button
		const undoBtn = this.confirmEl.createEl('button', {
			cls: 'ct-untimed-undo',
			text: 'Undo',
		});
		undoBtn.addEventListener('click', () => {
			if (this.hapticEnabled) haptic(30);
			this.reset();
			this.onUndo();
		});
	}

	/** Reset to idle state, clearing confirmation. */
	reset(): void {
		this.state = 'idle';
		this.confirmEl.addClass('ct-hidden');
		this.confirmEl.empty();
		this.pillsRow.addClass('ct-hidden');
		this.customRow.addClass('ct-hidden');
		this.pillsGrid.removeClass('ct-hidden');
		this.hadOneBtn.removeClass('ct-hidden');
	}

	/** Show/hide based on timer phase (hidden during contracting). */
	setVisible(visible: boolean): void {
		if (visible) {
			this.hadOneBtn.removeClass('ct-hidden');
		} else {
			this.hadOneBtn.addClass('ct-hidden');
			if (this.state === 'picking' || this.state === 'custom') {
				this.cancel();
			}
		}
	}
}
