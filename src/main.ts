import { Editor, Plugin } from 'obsidian';
import type { ContractionTimerSettings, SessionData } from './types';
import { DEFAULT_SETTINGS, EMPTY_SESSION } from './types';
import { CodeBlockStore } from './data/CodeBlockStore';
import { TimerWidget } from './widget/TimerWidget';
import { ContractionTimerSettingsTab } from './settings';
import { deepMerge } from './utils/deepMerge';

export default class ContractionTimerPlugin extends Plugin {
	settings: ContractionTimerSettings = DEFAULT_SETTINGS;
	private store!: CodeBlockStore;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.store = new CodeBlockStore(this.app);

		// Register the code block processor
		this.registerMarkdownCodeBlockProcessor(
			'contraction-timer',
			(source, el, ctx) => {
				const data = this.store.parse(source);
				const widget = new TimerWidget(el, this, data, ctx);
				ctx.addChild(widget);
			}
		);

		// Command: insert a new contraction timer code block
		this.addCommand({
			id: 'insert-contraction-timer',
			name: 'Insert contraction timer',
			editorCallback: (editor: Editor) => {
				const emptyData = JSON.stringify(EMPTY_SESSION);
				editor.replaceSelection(
					`\`\`\`contraction-timer\n${emptyData}\n\`\`\`\n`
				);
			},
		});

		// Add ribbon icon
		this.addRibbonIcon('timer', 'Insert contraction timer', () => {
			const activeEditor = this.app.workspace.activeEditor;
			if (activeEditor?.editor) {
				const emptyData = JSON.stringify(EMPTY_SESSION);
				activeEditor.editor.replaceSelection(
					`\`\`\`contraction-timer\n${emptyData}\n\`\`\`\n`
				);
			}
		});

		// Settings tab
		this.addSettingTab(new ContractionTimerSettingsTab(this.app, this));
	}

	async loadSettings(): Promise<void> {
		this.settings = deepMerge(DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
