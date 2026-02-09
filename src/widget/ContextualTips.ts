import type { ClinicalTip } from '../data/clinicalData';
import { dismissTip } from '../data/clinicalData';

const CATEGORY_ICONS: Record<string, string> = {
	safety: '\u26A0\uFE0F',
	action: '\u27A1\uFE0F',
	timing: '\u23F0',
	comfort: '\u2764\uFE0F',
	education: '\uD83D\uDCD6',
};

/**
 * Displays 1-2 contextual clinical tips based on current labor state.
 * Tips can be dismissed individually.
 */
export class ContextualTips {
	private el: HTMLElement;

	constructor(parent: HTMLElement) {
		this.el = parent.createDiv({ cls: 'ct-contextual-tips' });
	}

	/** Update displayed tips. */
	update(tips: ClinicalTip[]): void {
		this.el.empty();
		if (tips.length === 0) {
			this.el.addClass('ct-hidden');
			return;
		}
		this.el.removeClass('ct-hidden');

		for (const tip of tips) {
			const tipEl = this.el.createDiv({ cls: `ct-tip ct-tip--${tip.category}` });

			const icon = CATEGORY_ICONS[tip.category] || '';
			const textEl = tipEl.createDiv({ cls: 'ct-tip-content' });
			textEl.createSpan({ cls: 'ct-tip-icon', text: icon });
			textEl.createSpan({ cls: 'ct-tip-text', text: tip.text });

			const dismissBtn = tipEl.createEl('button', {
				cls: 'ct-tip-dismiss',
				text: '\u00D7',
			});
			dismissBtn.setAttribute('aria-label', 'Dismiss tip');
			dismissBtn.addEventListener('click', () => {
				dismissTip(tip.id);
				tipEl.remove();
				if (this.el.children.length === 0) {
					this.el.addClass('ct-hidden');
				}
			});
		}
	}
}
