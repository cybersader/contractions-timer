/**
 * Reusable collapsible section component.
 * Wraps content with a chevron + title header, optional badge,
 * and persists open/closed state in localStorage.
 * Optionally shows up/down arrows for reordering.
 */
export class CollapsibleSection {
	private el: HTMLElement;
	private headerEl: HTMLElement;
	private bodyEl: HTMLElement;
	private chevronEl: HTMLElement;
	private badgeEl: HTMLElement | null = null;
	private moveControls: HTMLElement | null = null;
	private expanded: boolean;
	private storageKey: string;

	constructor(
		parent: HTMLElement,
		title: string,
		id: string,
		defaultExpanded: boolean = true,
		badgeText?: string
	) {
		this.storageKey = `ct-collapse-${id}`;

		// Read persisted state, fallback to default
		const stored = localStorage.getItem(this.storageKey);
		this.expanded = stored !== null ? stored === '1' : defaultExpanded;

		this.el = parent.createDiv({ cls: 'ct-collapsible' });
		this.el.dataset.sectionId = id;
		this.headerEl = this.el.createDiv({ cls: 'ct-collapsible-header' });

		this.chevronEl = this.headerEl.createSpan({ cls: 'ct-collapsible-chevron' });
		this.chevronEl.textContent = this.expanded ? '\u25BC' : '\u25B6';

		this.headerEl.createSpan({ cls: 'ct-collapsible-title', text: title });

		if (badgeText) {
			this.badgeEl = this.headerEl.createSpan({ cls: 'ct-collapsible-badge', text: badgeText });
		}

		this.bodyEl = this.el.createDiv({ cls: 'ct-collapsible-body' });
		if (!this.expanded) this.bodyEl.addClass('ct-hidden');

		this.headerEl.addEventListener('click', (e) => {
			// Don't toggle when clicking move buttons or drag handle
			if ((e.target as HTMLElement).closest('.ct-move-controls')) return;
			if ((e.target as HTMLElement).closest('.ct-drag-handle')) return;
			this.toggle();
		});
	}

	/** Add up/down move arrows to the header. */
	enableMove(onMoveUp: () => void, onMoveDown: () => void): void {
		if (this.moveControls) return;

		this.moveControls = this.headerEl.createDiv({ cls: 'ct-move-controls' });

		const upBtn = this.moveControls.createEl('button', {
			cls: 'ct-move-btn ct-move-btn--up',
			title: 'Move up',
		});
		upBtn.textContent = '\u25B2';
		upBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			onMoveUp();
		});

		const downBtn = this.moveControls.createEl('button', {
			cls: 'ct-move-btn ct-move-btn--down',
			title: 'Move down',
		});
		downBtn.textContent = '\u25BC';
		downBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			onMoveDown();
		});
	}

	/** Update which arrows are enabled based on position. */
	setMoveEnabled(canMoveUp: boolean, canMoveDown: boolean): void {
		if (!this.moveControls) return;
		const up = this.moveControls.querySelector('.ct-move-btn--up') as HTMLButtonElement;
		const down = this.moveControls.querySelector('.ct-move-btn--down') as HTMLButtonElement;
		if (up) up.disabled = !canMoveUp;
		if (down) down.disabled = !canMoveDown;
	}

	/** Returns the container element for child content. */
	getBodyEl(): HTMLElement {
		return this.bodyEl;
	}

	/** Returns the root element of the collapsible. */
	getEl(): HTMLElement {
		return this.el;
	}

	/** Toggle expanded/collapsed state. */
	toggle(): void {
		this.expanded = !this.expanded;
		this.chevronEl.textContent = this.expanded ? '\u25BC' : '\u25B6';
		if (this.expanded) {
			this.bodyEl.removeClass('ct-hidden');
		} else {
			this.bodyEl.addClass('ct-hidden');
		}
		localStorage.setItem(this.storageKey, this.expanded ? '1' : '0');
	}

	/** Update the badge text. */
	setBadge(text: string): void {
		if (!this.badgeEl) {
			this.badgeEl = this.headerEl.createSpan({ cls: 'ct-collapsible-badge', text });
		} else {
			this.badgeEl.textContent = text;
		}
	}

	/** Remove the badge. */
	clearBadge(): void {
		if (this.badgeEl) {
			this.badgeEl.remove();
			this.badgeEl = null;
		}
	}

	/** Programmatically expand the section (e.g., for urgent alerts). */
	expand(): void {
		if (!this.expanded) this.toggle();
	}

	/** Programmatically collapse the section. */
	collapse(): void {
		if (this.expanded) this.toggle();
	}

	/** Check if currently expanded. */
	isExpanded(): boolean {
		return this.expanded;
	}

	/** Add a drag handle for pointer-based reordering. */
	enableDrag(onReorder: (direction: -1 | 1) => void): void {
		const handle = this.headerEl.createDiv({ cls: 'ct-drag-handle' });
		handle.textContent = '\u2807'; // ⠇ braille dots = grip icon

		let startY = 0;
		let dragging = false;

		handle.addEventListener('pointerdown', (e) => {
			e.preventDefault();
			e.stopPropagation();
			startY = e.clientY;
			dragging = true;
			this.el.addClass('ct-dragging');
			handle.setPointerCapture(e.pointerId);
		});

		handle.addEventListener('pointermove', (e) => {
			if (!dragging) return;
			const delta = e.clientY - startY;
			if (Math.abs(delta) > 30) {
				onReorder(delta < 0 ? -1 : 1);
				startY = e.clientY; // reset for continuous drag
			}
		});

		const endDrag = () => {
			dragging = false;
			this.el.removeClass('ct-dragging');
		};

		handle.addEventListener('pointerup', endDrag);
		handle.addEventListener('pointercancel', endDrag);
	}

	/** Hide or show the entire section (header + body). */
	setVisible(visible: boolean): void {
		if (visible) {
			this.el.removeClass('ct-hidden');
		} else {
			this.el.addClass('ct-hidden');
		}
	}
}
