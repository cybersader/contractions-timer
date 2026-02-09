import { getIntensityLabel, mapIntensityTo3 } from '../utils/formatters';
import { haptic } from '../utils/dom';

/**
 * Post-contraction intensity picker with 5 (or 3) large tap buttons.
 */
export class IntensityPicker {
	private el: HTMLElement;
	private onSelect: (level: number) => void;
	private scale: 3 | 5;
	private selectedLevel: number | null = null;

	constructor(
		parent: HTMLElement,
		onSelect: (level: number) => void,
		scale: 3 | 5 = 5,
		hapticEnabled: boolean = true
	) {
		this.onSelect = onSelect;
		this.scale = scale;

		this.el = parent.createDiv({ cls: 'ct-intensity-picker ct-hidden' });
		this.el.createDiv({ cls: 'ct-picker-label', text: 'How strong?' });

		const btnContainer = this.el.createDiv({ cls: 'ct-intensity-buttons' });

		const levels = scale === 3 ? [1, 3, 5] : [1, 2, 3, 4, 5];
		const labels = scale === 3
			? ['Mild', 'Moderate', 'Strong']
			: undefined;

		levels.forEach((level, idx) => {
			const label = labels ? labels[idx] : getIntensityLabel(level);
			const btn = btnContainer.createEl('button', {
				cls: `ct-intensity-btn ct-intensity-btn--${level}`,
				text: label,
			});
			btn.addEventListener('click', () => {
				if (hapticEnabled) haptic(30);
				this.selectedLevel = level;
				this.highlightSelected(level);
				this.onSelect(level);
			});
		});
	}

	private highlightSelected(level: number): void {
		const buttons = this.el.querySelectorAll('.ct-intensity-btn');
		buttons.forEach(btn => btn.removeClass('ct-intensity-btn--selected'));
		const selected = this.el.querySelector(`.ct-intensity-btn--${level}`);
		if (selected) selected.addClass('ct-intensity-btn--selected');
	}

	show(preselected?: number | null): void {
		this.el.removeClass('ct-hidden');
		if (preselected) {
			// Map 5-scale values to nearest 3-scale button when in 3-scale mode
			const displayLevel = this.scale === 3 ? mapIntensityTo3(preselected) : preselected;
			this.selectedLevel = preselected;
			this.highlightSelected(displayLevel);
		}
	}

	hide(): void {
		this.el.addClass('ct-hidden');
		this.selectedLevel = null;
	}
}
