import type { DepartureAdvice, DepartureUrgency, RangeEstimate } from '../data/hospitalAdvisor';
import type { AdvisorMode } from '../types';
import type { CollapsibleSection } from '../widget/CollapsibleSection';

const URGENCY_LABELS: Record<DepartureUrgency, string> = {
	'not-yet': 'Not yet',
	'start-preparing': 'Preparing',
	'time-to-go': 'Time to go',
	'go-now': 'Go now',
};

/**
 * Hospital departure advisor panel.
 * Supports three display modes:
 *   range   — earliest/likely/latest timing with pattern + trend
 *   urgency — color-coded urgency with headline + detail + factors
 *   minimal — one-liner pattern summary
 */
export class HospitalAdvisorPanel {
	private el: HTMLElement;
	private mode: AdvisorMode;
	private collapsible: CollapsibleSection | null;

	constructor(parent: HTMLElement, mode: AdvisorMode, collapsible?: CollapsibleSection) {
		this.mode = mode;
		this.collapsible = collapsible || null;
		this.el = parent.createDiv({ cls: 'ct-hospital-advisor' });
	}

	/** Update the panel with new data. Both arguments are always computed. */
	update(advice: DepartureAdvice, rangeEstimate: RangeEstimate | null): void {
		this.el.empty();

		switch (this.mode) {
			case 'range':
				this.renderRange(rangeEstimate, advice);
				break;
			case 'minimal':
				this.renderMinimal(advice, rangeEstimate);
				break;
			default:
				this.renderUrgency(advice);
				break;
		}
	}

	private renderUrgency(advice: DepartureAdvice): void {
		this.el.className = `ct-hospital-advisor ct-advisor--${advice.urgency}`;

		this.el.createDiv({ cls: 'ct-advisor-headline', text: advice.headline });
		this.el.createDiv({ cls: 'ct-advisor-detail', text: advice.detail });

		if (advice.factors.length > 0) {
			const factorsEl = this.el.createDiv({ cls: 'ct-advisor-factors' });
			for (const factor of advice.factors) {
				factorsEl.createDiv({ cls: 'ct-advisor-factor', text: factor });
			}
		}

		if (this.collapsible) {
			this.collapsible.setBadge(URGENCY_LABELS[advice.urgency]);
			if (advice.urgency === 'time-to-go' || advice.urgency === 'go-now') {
				this.collapsible.expand();
			}
		}
	}

	private renderRange(estimate: RangeEstimate | null, fallbackAdvice: DepartureAdvice): void {
		// Fall back to urgency if no range data
		if (!estimate) {
			this.renderUrgency(fallbackAdvice);
			return;
		}

		this.el.className = `ct-hospital-advisor ct-advisor-range ct-advisor-range--${estimate.confidence}`;

		// Recommendation (main headline)
		this.el.createDiv({ cls: 'ct-advisor-recommendation', text: estimate.recommendation });

		// Pattern summary
		if (estimate.patternSummary) {
			this.el.createDiv({ cls: 'ct-advisor-pattern', text: estimate.patternSummary });
		}

		// Trend
		if (estimate.trendSummary) {
			this.el.createDiv({ cls: 'ct-advisor-trend', text: estimate.trendSummary });
		}

		// Factors
		if (estimate.factors.length > 0) {
			const factorsEl = this.el.createDiv({ cls: 'ct-advisor-factors' });
			for (const factor of estimate.factors) {
				factorsEl.createDiv({ cls: 'ct-advisor-factor', text: factor });
			}
		}

		// Collapsible badge
		if (this.collapsible) {
			const badgeMap: Record<string, string> = {
				low: 'Low confidence',
				medium: 'Medium',
				high: 'High confidence',
			};
			this.collapsible.setBadge(badgeMap[estimate.confidence] || estimate.confidence);
			// Auto-expand for imminent estimates
			if (estimate.earliestMinutes === 0 && estimate.likelyMinutes === 0) {
				this.collapsible.expand();
			}
		}
	}

	private renderMinimal(advice: DepartureAdvice, estimate: RangeEstimate | null): void {
		this.el.className = `ct-hospital-advisor ct-advisor-minimal ct-advisor--${advice.urgency}`;

		const text = estimate?.patternSummary || advice.detail;
		this.el.createDiv({ cls: 'ct-advisor-minimal-text', text });

		if (this.collapsible) {
			this.collapsible.setBadge(URGENCY_LABELS[advice.urgency]);
		}
	}
}
