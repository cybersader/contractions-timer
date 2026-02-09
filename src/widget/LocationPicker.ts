import type { ContractionLocation } from '../types';
import { getLocationLabel } from '../utils/formatters';
import { haptic } from '../utils/dom';

/**
 * Post-contraction location picker: Front / Back / Wrapping.
 * Helps distinguish Braxton Hicks (front) from real labor (wrapping).
 */
export class LocationPicker {
	private el: HTMLElement;
	private onSelect: (location: ContractionLocation) => void;

	constructor(
		parent: HTMLElement,
		onSelect: (location: ContractionLocation) => void,
		hapticEnabled: boolean = true
	) {
		this.onSelect = onSelect;

		this.el = parent.createDiv({ cls: 'ct-location-picker ct-hidden' });
		this.el.createDiv({ cls: 'ct-picker-label', text: 'Where do you feel it?' });

		const btnContainer = this.el.createDiv({ cls: 'ct-location-buttons' });

		const locations: ContractionLocation[] = ['front', 'back', 'wrapping'];
		locations.forEach(loc => {
			const btn = btnContainer.createEl('button', {
				cls: `ct-location-btn ct-location-btn--${loc}`,
				text: getLocationLabel(loc),
			});
			btn.addEventListener('click', () => {
				if (hapticEnabled) haptic(30);
				this.highlightSelected(loc);
				this.onSelect(loc);
			});
		});
	}

	private highlightSelected(location: ContractionLocation): void {
		const buttons = this.el.querySelectorAll('.ct-location-btn');
		buttons.forEach(btn => btn.removeClass('ct-location-btn--selected'));
		const selected = this.el.querySelector(`.ct-location-btn--${location}`);
		if (selected) selected.addClass('ct-location-btn--selected');
	}

	show(preselected?: ContractionLocation | null): void {
		this.el.removeClass('ct-hidden');
		if (preselected) this.highlightSelected(preselected);
	}

	hide(): void {
		this.el.addClass('ct-hidden');
	}

	clearSelection(): void {
		const buttons = this.el.querySelectorAll('.ct-location-btn');
		buttons.forEach(btn => btn.removeClass('ct-location-btn--selected'));
	}
}
