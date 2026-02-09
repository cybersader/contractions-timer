import { App, TFile, MarkdownPostProcessorContext } from 'obsidian';
import type { SessionData, SectionId } from '../types';
import { EMPTY_SESSION, DEFAULT_LAYOUT } from '../types';

/**
 * Handles reading and writing session data to/from the code block JSON.
 * Uses ctx.getSectionInfo() to locate the code block and app.vault.process()
 * for atomic read-modify-write operations.
 */
export class CodeBlockStore {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Parse session data from code block source text.
	 */
	parse(source: string): SessionData {
		try {
			const trimmed = source.trim();
			if (!trimmed) return { ...EMPTY_SESSION, layout: [...DEFAULT_LAYOUT] };
			const parsed = JSON.parse(trimmed);

			// Backward-compat: merge saved layout with defaults (new sections get appended)
			let layout: SectionId[] = [...DEFAULT_LAYOUT];
			if (Array.isArray(parsed.layout) && parsed.layout.length > 0) {
				const valid = new Set<SectionId>(DEFAULT_LAYOUT);
				const saved = parsed.layout.filter((id: string) => valid.has(id as SectionId)) as SectionId[];
				const missing = DEFAULT_LAYOUT.filter(id => !saved.includes(id));
				layout = [...saved, ...missing];
			}

			return {
				contractions: Array.isArray(parsed.contractions) ? parsed.contractions : [],
				events: Array.isArray(parsed.events) ? parsed.events : [],
				sessionStartedAt: parsed.sessionStartedAt || null,
				layout,
				paused: parsed.paused === true,
				settingsOverrides: parsed.settingsOverrides && typeof parsed.settingsOverrides === 'object'
					? parsed.settingsOverrides
					: undefined,
			};
		} catch {
			return { ...EMPTY_SESSION, layout: [...DEFAULT_LAYOUT] };
		}
	}

	/**
	 * Save session data back to the code block in the file.
	 * This will trigger a re-render of the code block processor.
	 */
	async save(
		ctx: MarkdownPostProcessorContext,
		containerEl: HTMLElement,
		data: SessionData
	): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
		if (!(file instanceof TFile)) return;

		const sectionInfo = ctx.getSectionInfo(containerEl);
		if (!sectionInfo) {
			console.warn('Contraction Timer: could not get section info for save');
			return;
		}

		const json = JSON.stringify(data);

		await this.app.vault.process(file, (content) => {
			const lines = content.split('\n');
			const { lineStart, lineEnd } = sectionInfo;

			// lineStart is the ``` opening fence, lineEnd is the ``` closing fence
			// Replace everything between them (exclusive of fences)
			const before = lines.slice(0, lineStart + 1);
			const after = lines.slice(lineEnd);

			return [...before, json, ...after].join('\n');
		});
	}
}
