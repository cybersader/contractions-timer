import type { Contraction, ContractionLocation } from '../types';
import { formatDuration, getIntensityLabel, getLocationLabel } from '../utils/formatters';
import { getDurationSeconds } from '../data/calculations';

/**
 * Inline editor for modifying a past contraction.
 * Replaces a timeline row temporarily with editable fields.
 */
export class ContractionEditor {
	private el: HTMLElement;
	private contraction: Contraction;
	private durationInput!: HTMLInputElement;
	private endInput: HTMLInputElement | null = null;
	private onSave: (updated: Contraction) => void;
	private onDelete: (id: string) => void;
	private onCancel: () => void;

	constructor(
		parent: HTMLElement,
		contraction: Contraction,
		onSave: (updated: Contraction) => void,
		onDelete: (id: string) => void,
		onCancel: () => void
	) {
		this.contraction = { ...contraction };
		this.onSave = onSave;
		this.onDelete = onDelete;
		this.onCancel = onCancel;

		this.el = parent.createDiv({ cls: 'ct-editor' });
		this.buildEditor();
	}

	/**
	 * Parse a duration string like "M:SS", "MM:SS", or plain seconds.
	 * Returns total seconds, or null if invalid.
	 */
	private parseDuration(raw: string): number | null {
		const trimmed = raw.trim();
		if (!trimmed) return null;

		// Try M:SS or MM:SS format
		const colonMatch = trimmed.match(/^(\d{1,3}):(\d{1,2})$/);
		if (colonMatch) {
			const minutes = parseInt(colonMatch[1], 10);
			const seconds = parseInt(colonMatch[2], 10);
			if (seconds >= 60) return null;
			const total = minutes * 60 + seconds;
			if (total <= 0 || total > 86400) return null;
			return total;
		}

		// Try plain seconds
		const num = parseInt(trimmed, 10);
		if (!isNaN(num) && num > 0 && num <= 86400) return num;

		return null;
	}

	/** Format seconds as M:SS for duration input display. */
	private formatDurationForInput(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	private buildEditor(): void {
		this.el.empty();

		// Editable start/end time inputs
		const timeRow = this.el.createDiv({ cls: 'ct-editor-row ct-editor-time-row' });
		const startDate = new Date(this.contraction.start);
		const endDate = this.contraction.end ? new Date(this.contraction.end) : null;

		timeRow.createSpan({ cls: 'ct-editor-label', text: 'Start' });
		const startInput = timeRow.createEl('input', {
			cls: 'ct-editor-time-input',
			type: 'time',
			value: this.toTimeInputValue(startDate),
		});
		startInput.setAttribute('step', '1'); // show seconds
		startInput.addEventListener('change', () => {
			const updated = this.applyTimeInput(startDate, startInput.value);
			if (updated) this.contraction.start = updated.toISOString();
			this.updateDurationDisplay();
		});

		if (endDate) {
			timeRow.createSpan({ cls: 'ct-editor-label', text: 'End' });
			this.endInput = timeRow.createEl('input', {
				cls: 'ct-editor-time-input',
				type: 'time',
				value: this.toTimeInputValue(endDate),
			});
			this.endInput.setAttribute('step', '1');
			this.endInput.addEventListener('change', () => {
				const updated = this.applyTimeInput(endDate!, this.endInput!.value);
				if (updated) this.contraction.end = updated.toISOString();
				this.updateDurationDisplay();
			});
		}

		// Duration input (editable, bidirectional sync with end time)
		timeRow.createSpan({ cls: 'ct-editor-label', text: 'Dur' });
		this.durationInput = timeRow.createEl('input', {
			cls: 'ct-editor-duration-input',
			type: 'text',
			placeholder: 'M:SS',
		});
		this.durationInput.setAttribute('inputmode', 'numeric');
		if (!endDate) {
			this.durationInput.value = '(active)';
			this.durationInput.disabled = true;
		} else {
			const dur = getDurationSeconds(this.contraction);
			this.durationInput.value = this.formatDurationForInput(dur);
		}
		this.durationInput.addEventListener('change', () => {
			if (!this.contraction.end) return;
			const parsed = this.parseDuration(this.durationInput.value);
			if (parsed === null) {
				this.durationInput.addClass('ct-editor-duration-input--invalid');
				setTimeout(() => this.durationInput.removeClass('ct-editor-duration-input--invalid'), 1000);
				// Reset to current value
				const dur = getDurationSeconds(this.contraction);
				this.durationInput.value = this.formatDurationForInput(dur);
				return;
			}
			// Compute new end = start + duration
			const startMs = new Date(this.contraction.start).getTime();
			const newEnd = new Date(startMs + parsed * 1000);
			this.contraction.end = newEnd.toISOString();
			// Update end input
			if (this.endInput) {
				this.endInput.value = this.toTimeInputValue(newEnd);
			}
		});

		// Intensity buttons
		const intensityRow = this.el.createDiv({ cls: 'ct-editor-row' });
		intensityRow.createSpan({ cls: 'ct-editor-label', text: 'Intensity' });
		const intensityBtns = intensityRow.createDiv({ cls: 'ct-editor-buttons' });
		for (let i = 1; i <= 5; i++) {
			const btn = intensityBtns.createEl('button', {
				cls: `ct-editor-btn${this.contraction.intensity === i ? ' ct-editor-btn--selected' : ''}`,
				text: String(i),
			});
			btn.setAttribute('title', getIntensityLabel(i));
			btn.addEventListener('click', () => {
				this.contraction.intensity = i;
				intensityBtns.querySelectorAll('.ct-editor-btn')
					.forEach(b => b.removeClass('ct-editor-btn--selected'));
				btn.addClass('ct-editor-btn--selected');
			});
		}

		// Location buttons
		const locationRow = this.el.createDiv({ cls: 'ct-editor-row' });
		locationRow.createSpan({ cls: 'ct-editor-label', text: 'Location' });
		const locationBtns = locationRow.createDiv({ cls: 'ct-editor-buttons' });
		const locations: ContractionLocation[] = ['front', 'back', 'wrapping'];
		for (const loc of locations) {
			const btn = locationBtns.createEl('button', {
				cls: `ct-editor-btn${this.contraction.location === loc ? ' ct-editor-btn--selected' : ''}`,
				text: getLocationLabel(loc),
			});
			btn.addEventListener('click', () => {
				this.contraction.location = loc;
				locationBtns.querySelectorAll('.ct-editor-btn')
					.forEach(b => b.removeClass('ct-editor-btn--selected'));
				btn.addClass('ct-editor-btn--selected');
			});
		}

		// Action buttons
		const actions = this.el.createDiv({ cls: 'ct-editor-actions' });
		const saveBtn = actions.createEl('button', {
			cls: 'ct-editor-save',
			text: 'Save',
		});
		saveBtn.addEventListener('click', () => this.onSave(this.contraction));

		const cancelBtn = actions.createEl('button', {
			cls: 'ct-editor-cancel',
			text: 'Cancel',
		});
		cancelBtn.addEventListener('click', () => this.onCancel());

		const deleteBtn = actions.createEl('button', {
			cls: 'ct-editor-delete',
			text: 'Delete',
		});
		deleteBtn.addEventListener('click', () => {
			this.onDelete(this.contraction.id);
		});
	}

	/** Convert a Date to HH:MM:SS for input[type=time]. */
	private toTimeInputValue(d: Date): string {
		const h = String(d.getHours()).padStart(2, '0');
		const m = String(d.getMinutes()).padStart(2, '0');
		const s = String(d.getSeconds()).padStart(2, '0');
		return `${h}:${m}:${s}`;
	}

	/** Apply a time input value (HH:MM or HH:MM:SS) to an existing Date, keeping the date. */
	private applyTimeInput(base: Date, value: string): Date | null {
		const parts = value.split(':').map(Number);
		if (parts.length < 2) return null;
		const result = new Date(base);
		result.setHours(parts[0], parts[1], parts[2] ?? 0, 0);
		return result;
	}

	/** Update the duration input value from current start/end. */
	private updateDurationDisplay(): void {
		if (!this.durationInput) return;
		if (this.contraction.end) {
			const dur = getDurationSeconds(this.contraction);
			this.durationInput.value = this.formatDurationForInput(dur);
		} else {
			this.durationInput.value = '(active)';
		}
	}

	destroy(): void {
		this.el.remove();
	}
}
