<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import { formatTimeShort, generateId } from '../../lib/labor-logic/formatters';
	import { haptic } from '../../lib/haptic';
	import { Droplets, Pencil, Undo2, X, Check } from 'lucide-svelte';

	let waterBreak = $derived($session.events.find(e => e.type === 'water-break'));

	let showTimePicker = $state(false);
	let showStepper = $state(false);
	let customHours = $state(1);
	let customMinutes = $state(0);
	let confirmingUndo = $state(false);
	let undoTimeout: ReturnType<typeof setTimeout> | null = $state(null);

	function recordWaterBreak() {
		if (waterBreak) return;
		if ($settings.hapticFeedback) haptic(50);
		session.update(s => ({
			...s,
			events: [...s.events, {
				id: generateId(),
				type: 'water-break' as const,
				timestamp: new Date().toISOString(),
				notes: '',
			}],
		}));
	}

	function startUndoConfirm() {
		if ($settings.hapticFeedback) haptic(30);
		confirmingUndo = true;
		undoTimeout = setTimeout(() => {
			confirmingUndo = false;
			undoTimeout = null;
		}, 5000);
	}

	function cancelUndo() {
		confirmingUndo = false;
		if (undoTimeout) { clearTimeout(undoTimeout); undoTimeout = null; }
	}

	function confirmUndoWaterBreak() {
		if (undoTimeout) { clearTimeout(undoTimeout); undoTimeout = null; }
		confirmingUndo = false;
		if ($settings.hapticFeedback) haptic(30);
		session.update(s => ({
			...s,
			events: s.events.filter(e => e.type !== 'water-break'),
		}));
		showTimePicker = false;
		showStepper = false;
	}

	function openTimePicker() {
		if ($settings.hapticFeedback) haptic(30);
		showTimePicker = true;
		showStepper = false;
	}

	function closeTimePicker() {
		showTimePicker = false;
		showStepper = false;
	}

	function pickTime(minutesAgo: number) {
		const ts = new Date(Date.now() - minutesAgo * 60000).toISOString();
		session.update(s => ({
			...s,
			events: s.events.map(e =>
				e.type === 'water-break' ? { ...e, timestamp: ts } : e
			),
		}));
		showTimePicker = false;
		showStepper = false;
	}

	function openStepper() {
		if ($settings.hapticFeedback) haptic(30);
		customHours = 1;
		customMinutes = 0;
		showStepper = true;
	}

	function adjustHours(delta: number) {
		customHours = Math.max(0, Math.min(48, customHours + delta));
		if ($settings.hapticFeedback) haptic(20);
	}

	function adjustMinutes(delta: number) {
		let m = customMinutes + delta;
		if (m < 0) {
			if (customHours > 0) { customHours--; m = 45; }
			else m = 0;
		} else if (m > 45) {
			if (customHours < 48) { customHours++; m = 0; }
			else m = 45;
		}
		customMinutes = m;
		if ($settings.hapticFeedback) haptic(20);
	}

	let customTotal = $derived(customHours * 60 + customMinutes);
	let customPreview = $derived(
		customTotal === 0
			? $_('timer.waterBreakQuickAction.setATimeAbove')
			: $_('timer.waterBreakQuickAction.aroundTime', { values: { time: formatTimeShort(new Date(Date.now() - customTotal * 60000)) } })
	);
</script>

{#if !waterBreak}
	<button class="water-quick" onclick={recordWaterBreak}>
		<Droplets size={16} aria-hidden="true" />
		<span>{$_('timer.waterBreakQuickAction.waterBroke')}</span>
	</button>
{:else}
	<div class="water-confirmed-area">
		<div class="water-quick water-quick--confirmed">
			<Droplets size={16} aria-hidden="true" />
			<span>{$_('timer.waterBreakQuickAction.waterBrokeAt', { values: { time: formatTimeShort(new Date(waterBreak.timestamp)) } })}</span>
			<div class="water-actions">
				<button class="water-action-btn" onclick={openTimePicker} aria-label={$_('timer.waterBreakQuickAction.editTimeAriaLabel')}>
					<Pencil size={12} aria-hidden="true" />
				</button>
				{#if !confirmingUndo}
					<button class="water-action-btn water-action-btn--undo" onclick={startUndoConfirm} aria-label={$_('timer.waterBreakQuickAction.removeWaterBreakAriaLabel')} title={$_('timer.waterBreakQuickAction.removeWaterBreakAriaLabel')}>
						<Undo2 size={12} aria-hidden="true" />
						<span class="undo-label">{$_('timer.waterBreakQuickAction.undoLabel')}</span>
					</button>
				{:else}
					<div class="undo-confirm">
						<button class="water-action-btn water-action-btn--confirm-yes" onclick={confirmUndoWaterBreak} aria-label={$_('timer.waterBreakQuickAction.confirmRemoveAriaLabel')}>
							<Check size={12} aria-hidden="true" />
						</button>
						<button class="water-action-btn water-action-btn--confirm-no" onclick={cancelUndo} aria-label={$_('timer.waterBreakQuickAction.cancelAriaLabel')}>
							<X size={12} aria-hidden="true" />
						</button>
					</div>
				{/if}
			</div>
		</div>

		{#if showTimePicker && !showStepper}
			<div class="time-picker">
				<div class="picker-header">
					<span>{$_('timer.waterBreakQuickAction.whenDidItHappen')}</span>
					<button class="picker-close" onclick={closeTimePicker} aria-label={$_('timer.waterBreakQuickAction.closeAriaLabel')}>
						<X size={14} />
					</button>
				</div>
				<div class="picker-grid">
					<button class="time-pill" onclick={() => pickTime(0)}>{$_('timer.waterBreakQuickAction.justNow')}</button>
					<button class="time-pill" onclick={() => pickTime(5)}>{$_('timer.waterBreakQuickAction.fiveMinAgo')}</button>
					<button class="time-pill" onclick={() => pickTime(15)}>{$_('timer.waterBreakQuickAction.fifteenMinAgo')}</button>
					<button class="time-pill" onclick={() => pickTime(30)}>{$_('timer.waterBreakQuickAction.thirtyMinAgo')}</button>
					<button class="time-pill time-pill--custom" onclick={openStepper}>{$_('timer.waterBreakQuickAction.earlier')}</button>
				</div>
			</div>
		{:else if showTimePicker && showStepper}
			<div class="time-picker">
				<div class="picker-header">
					<span>{$_('timer.waterBreakQuickAction.setCustomTime')}</span>
					<button class="picker-close" onclick={closeTimePicker} aria-label={$_('timer.waterBreakQuickAction.closeAriaLabel')}>
						<X size={14} />
					</button>
				</div>
				<div class="stepper-row">
					<div class="stepper-group">
						<button class="stepper-btn" onclick={() => adjustHours(-1)}>-</button>
						<div class="stepper-value">{customHours}h</div>
						<button class="stepper-btn" onclick={() => adjustHours(1)}>+</button>
					</div>
					<span class="stepper-sep">:</span>
					<div class="stepper-group">
						<button class="stepper-btn" onclick={() => adjustMinutes(-15)}>-</button>
						<div class="stepper-value">{customMinutes}m</div>
						<button class="stepper-btn" onclick={() => adjustMinutes(15)}>+</button>
					</div>
				</div>
				<div class="stepper-preview">{customPreview}</div>
				<button class="stepper-log" onclick={() => pickTime(customTotal)}>{$_('timer.waterBreakQuickAction.setTime')}</button>
			</div>
		{/if}
	</div>
{/if}

<style>
	.water-quick {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-2) var(--space-3);
		margin-top: var(--space-3);
		border-radius: var(--radius-md);
		border: 1px dashed var(--water-muted);
		background: none;
		color: var(--water);
		font-size: var(--text-sm);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.water-quick:active {
		background: var(--water-muted);
	}

	.water-confirmed-area {
		margin-top: var(--space-3);
	}

	.water-quick--confirmed {
		margin-top: 0;
		border-style: solid;
		background: var(--water-muted);
		color: var(--water);
		cursor: default;
		justify-content: flex-start;
	}

	.water-actions {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.water-action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--space-5);
		height: var(--space-5);
		border: none;
		background: none;
		color: var(--water);
		cursor: pointer;
		border-radius: var(--radius-sm);
		opacity: 0.7;
		-webkit-tap-highlight-color: transparent;
	}

	.water-action-btn:active {
		background: var(--bg-card-hover);
		opacity: 1;
	}

	.water-action-btn--undo {
		color: var(--text-muted);
		width: auto;
		gap: var(--space-1);
		padding: 0 var(--space-1);
	}

	.undo-label {
		font-size: var(--text-xs);
		color: var(--text-muted);
		font-weight: 500;
	}

	.undo-confirm {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		animation: undo-fade-in 150ms ease;
	}

	.water-action-btn--confirm-yes {
		color: var(--danger);
		background: var(--danger-muted);
		border-radius: var(--radius-sm);
	}

	.water-action-btn--confirm-no {
		color: var(--text-muted);
	}

	@keyframes undo-fade-in {
		from { opacity: 0; transform: scale(0.9); }
		to { opacity: 1; transform: scale(1); }
	}

	/* Time picker */
	.time-picker {
		margin-top: var(--space-2);
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: var(--space-3);
	}

	.picker-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-3);
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.picker-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--space-5);
		height: var(--space-5);
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		border-radius: var(--radius-sm);
		-webkit-tap-highlight-color: transparent;
	}

	.picker-close:active {
		background: var(--bg-card-hover);
	}

	.picker-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--space-2);
	}

	.time-pill {
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-sm);
		border: 1px solid var(--input-border);
		background: var(--border-muted);
		color: var(--text-secondary);
		font-size: var(--text-sm);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.time-pill:active { background: var(--border); }

	.time-pill--custom {
		grid-column: span 2;
		border-color: var(--accent-muted);
		color: var(--accent);
	}

	.stepper-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}

	.stepper-group {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.stepper-btn {
		width: var(--btn-height-sm);
		height: var(--btn-height-sm);
		border-radius: var(--radius-sm);
		border: 1px solid var(--input-border);
		background: var(--border-muted);
		color: var(--text-secondary);
		font-size: var(--text-lg);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		-webkit-tap-highlight-color: transparent;
	}

	.stepper-value {
		min-width: var(--btn-height-sm);
		text-align: center;
		font-family: 'JetBrains Mono', monospace;
		font-size: var(--text-base);
		color: var(--text-primary);
	}

	.stepper-sep {
		color: var(--text-faint);
		font-size: var(--text-xl);
	}

	.stepper-preview {
		text-align: center;
		font-size: var(--text-sm);
		color: var(--text-muted);
		margin-bottom: var(--space-2);
	}

	.stepper-log {
		width: 100%;
		padding: var(--space-2);
		border-radius: var(--radius-sm);
		border: 1px solid var(--water-muted);
		background: var(--water-muted);
		color: var(--water);
		font-size: var(--text-base);
		font-weight: 600;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
</style>
