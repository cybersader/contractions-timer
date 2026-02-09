import type { LaborEvent, Contraction, WaterBreakStats } from '../types';
import { formatElapsedApprox } from '../utils/formatters';

/**
 * Shows contextual water break information after the event is recorded.
 * Prioritizes the call-your-provider action, then supporting stats.
 * If no provider phone is set, shows an inline input to add one.
 */
export class WaterBreakInfo {
	private el: HTMLElement;
	private providerPhone: string;
	private stats: WaterBreakStats;
	private onPhoneSave: ((phone: string) => void) | null = null;

	constructor(parent: HTMLElement, providerPhone: string = '', stats?: WaterBreakStats) {
		this.el = parent.createDiv({ cls: 'ct-water-break-info ct-hidden' });
		this.providerPhone = providerPhone;
		this.stats = stats ?? {
			beforeContractions: '8-15%',
			duringLabor: '~90%',
			laborWithin12Hours: '45%',
			laborWithin24Hours: '77-95%',
		};
	}

	/** Set callback for when user saves a phone number inline. */
	setPhoneSaveCallback(cb: (phone: string) => void): void {
		this.onPhoneSave = cb;
	}

	/** Update the stored phone and re-render if needed. */
	setProviderPhone(phone: string): void {
		this.providerPhone = phone;
	}

	/** Update display based on current events and contractions. */
	update(events: LaborEvent[], contractions: Contraction[]): void {
		const waterBreak = events.find(e => e.type === 'water-break');
		if (!waterBreak) {
			this.el.addClass('ct-hidden');
			return;
		}

		this.el.removeClass('ct-hidden');
		this.el.empty();

		const elapsed = (Date.now() - new Date(waterBreak.timestamp).getTime()) / 60000;
		const completed = contractions.filter(c => c.end !== null);

		// Time since water broke
		this.el.createDiv({
			cls: 'ct-water-elapsed',
			text: `Water broke ${formatElapsedApprox(elapsed)} ago`,
		});

		// Call-to-action: call your provider
		const action = this.el.createDiv({ cls: 'ct-water-action' });
		if (this.providerPhone) {
			this.buildPhoneLink(action);
		} else {
			this.buildPhoneInput(action);
		}
		action.createDiv({
			cls: 'ct-water-action-detail',
			text: 'They will advise whether to come in or wait at home.',
		});

		// Note about fluid color
		this.el.createDiv({
			cls: 'ct-water-safety-note',
			text: 'Note the fluid color. Clear or pale yellow is normal. Green or brown — call immediately.',
		});

		// Contextual stats
		const stats = this.el.createDiv({ cls: 'ct-water-stats' });

		const firstContractionTime = completed.length > 0
			? new Date(completed[0].start).getTime()
			: Infinity;
		const waterTime = new Date(waterBreak.timestamp).getTime();

		if (waterTime < firstContractionTime) {
			stats.createDiv({
				cls: 'ct-water-stat',
				text: `Water breaking before contractions happens in about ${this.stats.beforeContractions} of pregnancies`,
			});
		}

		stats.createDiv({
			cls: 'ct-water-stat',
			text: `${this.stats.laborWithin12Hours} start active labor within 12 hours of water breaking`,
		});
		stats.createDiv({
			cls: 'ct-water-stat',
			text: `${this.stats.laborWithin24Hours} start active labor within 24 hours`,
		});
	}

	private buildPhoneLink(parent: HTMLElement): void {
		const link = parent.createEl('a', {
			cls: 'ct-water-phone-link',
			text: `Call your provider: ${this.providerPhone}`,
			href: `tel:${this.providerPhone.replace(/[^\d+]/g, '')}`,
		});
		link.setAttr('rel', 'noopener');
	}

	private buildPhoneInput(parent: HTMLElement): void {
		const row = parent.createDiv({ cls: 'ct-water-phone-row' });

		row.createSpan({
			cls: 'ct-water-phone-label',
			text: 'Call your provider.',
		});

		const addBtn = row.createEl('button', {
			cls: 'ct-water-phone-add',
			text: 'Add number',
		});

		addBtn.addEventListener('click', () => {
			// Replace the row content with an input
			row.empty();

			const input = row.createEl('input', {
				cls: 'ct-water-phone-input',
				type: 'tel',
				placeholder: '(555) 123-4567',
			});
			input.focus();

			const saveBtn = row.createEl('button', {
				cls: 'ct-water-phone-save',
				text: 'Save',
			});

			const doSave = () => {
				const phone = input.value.trim();
				if (phone) {
					this.providerPhone = phone;
					if (this.onPhoneSave) this.onPhoneSave(phone);
					// Replace input row with the phone link
					row.empty();
					this.buildPhoneLink(row);
				}
			};

			saveBtn.addEventListener('click', doSave);
			input.addEventListener('keydown', (e) => {
				if (e.key === 'Enter') doSave();
			});
		});
	}
}
