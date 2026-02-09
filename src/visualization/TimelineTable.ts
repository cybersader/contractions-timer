import type { Contraction } from '../types';
import { getDurationSeconds, getIntervalMinutes, getRestBetween } from '../data/calculations';
import { formatDurationShort, formatInterval, formatTime, getIntensityLabel, getLocationLabel } from '../utils/formatters';
import { ContractionEditor } from '../widget/ContractionEditor';

/**
 * Reverse-chronological table of all contractions.
 * Rows are clickable to open an inline editor.
 */
export class TimelineTable {
	private el: HTMLElement;
	private tableBody!: HTMLElement;
	private contractions: Contraction[] = [];
	private activeEditor: ContractionEditor | null = null;
	private activeEditorRow: HTMLElement | null = null;
	private activeEditingRow: HTMLElement | null = null;
	private editingId: string | null = null;
	private onSave: ((updated: Contraction) => void) | null = null;
	private onDelete: ((id: string) => void) | null = null;

	constructor(parent: HTMLElement) {
		this.el = parent.createDiv({ cls: 'ct-timeline' });
		this.buildTable();
	}

	/** Set callbacks for save and delete actions from the inline editor. */
	setEditCallbacks(
		onSave: (updated: Contraction) => void,
		onDelete: (id: string) => void
	): void {
		this.onSave = onSave;
		this.onDelete = onDelete;
	}

	private buildTable(): void {
		const table = this.el.createEl('table', { cls: 'ct-table' });
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');

		['#', 'Time', 'Duration', 'Rest', 'Interval', 'Intensity', 'Location'].forEach(h => {
			headerRow.createEl('th', { text: h });
		});

		this.tableBody = table.createEl('tbody');
	}

	update(contractions: Contraction[]): void {
		this.contractions = contractions;
		this.closeEditor();
		this.tableBody.empty();

		const completed = contractions.filter(c => c.end !== null);

		if (completed.length === 0) {
			const row = this.tableBody.createEl('tr');
			const cell = row.createEl('td', { attr: { colspan: '7' } });
			cell.textContent = 'No contractions recorded yet';
			cell.addClass('ct-table-empty');
			return;
		}

		// Reverse chronological
		for (let i = completed.length - 1; i >= 0; i--) {
			const c = completed[i];
			const row = this.tableBody.createEl('tr', { cls: 'ct-table-row--clickable' });

			// #
			row.createEl('td', { text: String(i + 1), cls: 'ct-table-num' });

			// Time
			row.createEl('td', { text: formatTime(c.start), cls: 'ct-table-time' });

			// Duration
			const dur = getDurationSeconds(c);
			row.createEl('td', { text: formatDurationShort(dur), cls: 'ct-table-duration' });

			// Rest (end-to-start gap to next contraction)
			if (i < completed.length - 1) {
				const rest = getRestBetween(c, completed[i + 1]);
				row.createEl('td', { text: formatDurationShort(rest), cls: 'ct-table-rest' });
			} else {
				row.createEl('td', { text: '--', cls: 'ct-table-rest' });
			}

			// Interval (start-to-start)
			if (i > 0) {
				const interval = getIntervalMinutes(c, completed[i - 1]);
				row.createEl('td', { text: formatInterval(interval), cls: 'ct-table-interval' });
			} else {
				row.createEl('td', { text: '--', cls: 'ct-table-interval' });
			}

			// Intensity
			const intensityCell = row.createEl('td', { cls: 'ct-table-intensity' });
			if (c.intensity) {
				intensityCell.createSpan({ cls: `ct-dot ct-dot--${c.intensity}` });
				intensityCell.createSpan({ text: ` ${getIntensityLabel(c.intensity)}` });
			} else {
				intensityCell.textContent = '--';
			}

			// Location
			row.createEl('td', {
				text: c.location ? getLocationLabel(c.location) : '--',
				cls: 'ct-table-location',
			});

			// Click to edit
			if (this.onSave && this.onDelete) {
				row.addEventListener('click', () => this.openEditor(c, row));
			}
		}
	}

	/** Close any open editor, removing all associated DOM elements. */
	private closeEditor(): void {
		if (this.activeEditor) {
			this.activeEditor.destroy();
			this.activeEditor = null;
		}
		if (this.activeEditingRow) {
			this.activeEditingRow.removeClass('ct-table-row--editing');
			this.activeEditingRow = null;
		}
		if (this.activeEditorRow) {
			this.activeEditorRow.remove();
			this.activeEditorRow = null;
		}
		this.editingId = null;
	}

	private openEditor(contraction: Contraction, row: HTMLElement): void {
		const wasEditing = this.editingId === contraction.id;
		this.closeEditor();
		if (wasEditing) return; // Toggle off

		this.editingId = contraction.id;
		this.activeEditingRow = row;
		row.addClass('ct-table-row--editing');

		this.activeEditorRow = this.tableBody.createEl('tr', { cls: 'ct-timeline-editor-tr' });
		const editorCell = this.activeEditorRow.createEl('td', { attr: { colspan: '7' } });
		row.after(this.activeEditorRow);

		this.activeEditor = new ContractionEditor(
			editorCell,
			contraction,
			(updated) => { this.closeEditor(); this.onSave?.(updated); },
			(id) => { this.closeEditor(); this.onDelete?.(id); },
			() => { this.closeEditor(); }
		);
	}
}
