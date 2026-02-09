/**
 * Session management controls: pause, delete last, clear all.
 */
export class SessionControls {
	private el: HTMLElement;
	private pauseBtn: HTMLButtonElement;
	private paused = false;
	private onPause: (paused: boolean) => void;

	constructor(
		parent: HTMLElement,
		onClearAll: () => void,
		onDeleteLast: () => void,
		onPause: (paused: boolean) => void
	) {
		this.onPause = onPause;
		this.el = parent.createDiv({ cls: 'ct-session-controls' });

		this.pauseBtn = this.el.createEl('button', {
			cls: 'ct-control-btn ct-control-btn--pause',
			text: 'Pause',
		});
		this.pauseBtn.addEventListener('click', () => this.togglePause());

		const deleteBtn = this.el.createEl('button', {
			cls: 'ct-control-btn ct-control-btn--delete-last',
			text: 'Delete last',
		});
		deleteBtn.addEventListener('click', onDeleteLast);

		const clearBtn = this.el.createEl('button', {
			cls: 'ct-control-btn ct-control-btn--clear',
			text: 'Clear all',
		});
		clearBtn.addEventListener('click', onClearAll);
	}

	private togglePause(): void {
		this.paused = !this.paused;
		this.pauseBtn.textContent = this.paused ? 'Resume' : 'Pause';
		this.pauseBtn.toggleClass('ct-control-btn--active', this.paused);
		this.onPause(this.paused);
	}

	setPaused(paused: boolean): void {
		this.paused = paused;
		this.pauseBtn.textContent = paused ? 'Resume' : 'Pause';
		this.pauseBtn.toggleClass('ct-control-btn--active', paused);
	}

	/** Enable or disable the pause button (e.g. disable during contracting). */
	setPauseEnabled(enabled: boolean): void {
		this.pauseBtn.disabled = !enabled;
	}

	show(): void {
		this.el.removeClass('ct-hidden');
	}

	hide(): void {
		this.el.addClass('ct-hidden');
	}

	setVisible(visible: boolean): void {
		if (visible) this.show();
		else this.hide();
	}
}
