import type { BHAssessment, BHCriterion } from '../data/braxtonHicksAssessment';
import type { BHThresholdConfig } from '../types';

const VERDICT_LABELS: Record<string, string> = {
	'likely-braxton-hicks': 'Likely practice contractions',
	'uncertain': 'Mixed signals',
	'likely-real-labor': 'Likely real labor',
};

const VERDICT_DESCRIPTIONS: Record<string, string> = {
	'likely-braxton-hicks': 'Pattern looks more like Braxton Hicks than real labor',
	'uncertain': 'Not enough evidence to tell \u2014 keep tracking for a clearer picture',
	'likely-real-labor': 'Pattern matches real labor characteristics',
};

const RESULT_ICONS: Record<string, string> = {
	'real-labor': '\u25CF',      // filled circle (red)
	'braxton-hicks': '\u25CB',   // open circle
	'inconclusive': '\u25CF',    // filled circle (gray)
};

/** Map criterion names to their threshold tooltip text. */
function getCriterionTooltip(name: string, t: BHThresholdConfig): string | null {
	switch (name) {
		case 'Regular timing':
			return `Regular: CV < ${t.regularityCVLow} | Irregular: CV > ${t.regularityCVHigh}`;
		case 'Pain location':
			return `Back/wrapping > ${Math.round(t.locationRatioHigh * 100)}% = real | Front < ${Math.round(t.locationRatioLow * 100)}% = practice`;
		case 'Sustained pattern':
			return `Sustained: ${t.sustainedMinMinutes} min, max gap ${t.sustainedMaxGapMinutes} min`;
		default:
			return null;
	}
}

/**
 * Pattern assessment panel showing BH vs real labor verdict
 * with individual criterion results.
 */
export class BraxtonHicksPanel {
	private el: HTMLElement;
	private verdictEl: HTMLElement;
	private criteriaList: HTMLElement;
	private noteEl: HTMLElement;
	private onOpenSettings?: () => void;
	private thresholds?: BHThresholdConfig;

	constructor(parent: HTMLElement, onOpenSettings?: () => void, thresholds?: BHThresholdConfig) {
		this.onOpenSettings = onOpenSettings;
		this.thresholds = thresholds;
		this.el = parent.createDiv({ cls: 'ct-bh-panel' });
		this.verdictEl = this.el.createDiv({ cls: 'ct-bh-verdict' });
		this.criteriaList = this.el.createDiv({ cls: 'ct-bh-criteria' });
		this.noteEl = this.el.createDiv({
			cls: 'ct-bh-note',
			text: 'This is a pattern estimate, not a diagnosis. Contact your provider with concerns.',
		});
	}

	/** Update with new assessment data. */
	update(assessment: BHAssessment): void {
		if (assessment.requiresMore) {
			this.el.addClass('ct-hidden');
			return;
		}
		this.el.removeClass('ct-hidden');

		// Verdict badge + description + settings gear
		this.verdictEl.empty();
		const badgeRow = this.verdictEl.createDiv({ cls: 'ct-bh-badge-row' });
		badgeRow.createSpan({
			cls: `ct-bh-badge ct-bh-badge--${assessment.verdict}`,
			text: VERDICT_LABELS[assessment.verdict] || assessment.verdict,
		});
		if (this.onOpenSettings) {
			const gear = badgeRow.createSpan({
				cls: 'ct-settings-link',
				text: '\u2699',
			});
			gear.setAttribute('title', 'Adjust pattern assessment thresholds');
			gear.addEventListener('click', (e) => {
				e.stopPropagation();
				this.onOpenSettings!();
			});
		}
		this.verdictEl.createDiv({
			cls: 'ct-bh-verdict-desc',
			text: VERDICT_DESCRIPTIONS[assessment.verdict] || '',
		});

		// Criteria checklist with threshold tooltips
		this.criteriaList.empty();
		for (const criterion of assessment.criteria) {
			const row = this.criteriaList.createDiv({ cls: 'ct-bh-criterion' });
			// Add tooltip showing threshold if available
			if (this.thresholds) {
				const tooltip = getCriterionTooltip(criterion.name, this.thresholds);
				if (tooltip) row.setAttribute('title', tooltip);
			}
			row.createSpan({
				cls: `ct-bh-icon ct-bh-icon--${criterion.result}`,
				text: RESULT_ICONS[criterion.result] || '\u25CF',
			});
			const textCol = row.createDiv({ cls: 'ct-bh-criterion-text' });
			textCol.createDiv({ cls: 'ct-bh-criterion-name', text: criterion.name });
			textCol.createDiv({ cls: 'ct-bh-criterion-detail', text: criterion.detail });
		}
	}
}
