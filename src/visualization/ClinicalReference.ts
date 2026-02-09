import type { LaborStage, Parity, StageThresholdConfig } from '../types';
import { getLaborStageLabel, formatDurationRange } from '../utils/formatters';
import { BH_VS_REAL } from '../data/clinicalData';

/**
 * Clinical reference panel with labor education content.
 * Collapsible (default closed), serves as a "labor guide" reference.
 */
export class ClinicalReference {
	private el: HTMLElement;
	private stageTable: HTMLElement;
	private bhComparison: HTMLElement;
	private whenToCall: HTMLElement;

	constructor(parent: HTMLElement) {
		this.el = parent.createDiv({ cls: 'ct-clinical-reference' });

		// Stage reference table
		this.el.createDiv({ cls: 'ct-ref-heading', text: 'Labor stages' });
		this.stageTable = this.el.createDiv({ cls: 'ct-ref-stage-table' });
		this.buildStageTable(null);

		// BH vs Real comparison
		this.el.createDiv({ cls: 'ct-ref-heading', text: 'Braxton Hicks vs real labor' });
		this.bhComparison = this.el.createDiv({ cls: 'ct-ref-comparison' });
		this.buildComparison();

		// When to call
		this.el.createDiv({ cls: 'ct-ref-heading', text: 'Call your provider immediately if' });
		this.whenToCall = this.el.createDiv({ cls: 'ct-ref-call-list' });
		this.buildCallList();

		// Disclaimer
		this.el.createDiv({
			cls: 'ct-ref-disclaimer',
			text: 'General guidelines only. Always follow your provider\u2019s instructions.',
		});
	}

	/** Update to highlight the current stage row. */
	update(currentStage: LaborStage | null, stageThresholds: Record<string, StageThresholdConfig>, parity: Parity): void {
		this.buildStageTable(currentStage, stageThresholds, parity);
	}

	private buildStageTable(
		currentStage: LaborStage | null,
		stageThresholds?: Record<string, StageThresholdConfig>,
		parity: Parity = 'first-baby'
	): void {
		this.stageTable.empty();

		const table = this.stageTable.createEl('table', { cls: 'ct-ref-table' });
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		['Stage', 'Timing', 'Cervix (opening)', 'Typical length', 'Where'].forEach(h => {
			headerRow.createEl('th', { text: h });
		});

		const tbody = table.createEl('tbody');
		const stages: LaborStage[] = ['pre-labor', 'early', 'active', 'transition'];

		for (const stage of stages) {
			const config = stageThresholds?.[stage];
			const classes = [`ct-ref-row--${stage}`];
			if (stage === currentStage) classes.push('ct-ref-row--current');
			const row = tbody.createEl('tr', { cls: classes.join(' ') });
			row.createEl('td', { text: getLaborStageLabel(stage) });
			row.createEl('td', { text: config?.contractionPattern || '' });
			row.createEl('td', { text: config?.cervix || '' });
			let typical = '';
			if (config) {
				const range = parity === 'first-baby'
					? config.typicalDurationFirstMin
					: config.typicalDurationSubsequentMin;
				typical = formatDurationRange(range) || 'Variable';
			}
			row.createEl('td', { text: typical });
			row.createEl('td', { text: config?.location || '' });
		}

		// Cervix context note
		this.stageTable.createDiv({
			cls: 'ct-ref-cervix-note',
			text: 'Cervix = the opening of the uterus. Dilation is measured in cm (0 = closed, 10 = fully open for delivery).',
		});
	}

	private buildComparison(): void {
		const container = this.bhComparison;
		container.empty();

		const grid = container.createDiv({ cls: 'ct-ref-bh-grid' });

		const bhCol = grid.createDiv({ cls: 'ct-ref-bh-col' });
		bhCol.createDiv({ cls: 'ct-ref-bh-col-title', text: 'Braxton Hicks' });
		for (const sign of BH_VS_REAL.braxtonHicks) {
			bhCol.createDiv({ cls: 'ct-ref-bh-item', text: `\u2717 ${sign}` });
		}

		const realCol = grid.createDiv({ cls: 'ct-ref-real-col' });
		realCol.createDiv({ cls: 'ct-ref-bh-col-title', text: 'Real labor' });
		for (const sign of BH_VS_REAL.realLabor) {
			realCol.createDiv({ cls: 'ct-ref-real-item', text: `\u2713 ${sign}` });
		}
	}

	private buildCallList(): void {
		this.whenToCall.empty();
		const items = [
			'Water breaks (any color or amount)',
			'Heavy bleeding (more than a period)',
			'Baby stops moving or moves much less',
			'Severe headache with vision changes',
			'Fever above 100.4\u00B0F (38\u00B0C)',
			'Contractions before 37 weeks',
		];
		for (const item of items) {
			this.whenToCall.createDiv({ cls: 'ct-ref-call-item', text: `\u26A0 ${item}` });
		}
	}
}
