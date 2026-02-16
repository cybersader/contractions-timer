<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import { formatTimeShort, generateId } from '../../lib/labor-logic/formatters';
	import { haptic } from '../../lib/haptic';
	import type { LaborEvent } from '../../lib/labor-logic/types';

	interface Props {
		hideWaterBreak?: boolean;
	}
	let { hideWaterBreak = false }: Props = $props();

	let waterBreak = $derived($session.events.find(e => e.type === 'water-break') as LaborEvent | undefined);
	let mucusPlug = $derived($session.events.find(e => e.type === 'mucus-plug') as LaborEvent | undefined);
	let bloodyShow = $derived($session.events.find(e => e.type === 'bloody-show') as LaborEvent | undefined);
	let showButton = $derived($settings.showWaterBreakButton);

	let showMoreEvents = $state(false);
	let showTimePicker = $state(false);
	let showStepper = $state(false);
	let customHours = $state(1);
	let customMinutes = $state(0);
	let confirmingUndoType = $state<string | null>(null);
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

	function startUndoConfirm(type: string) {
		if ($settings.hapticFeedback) haptic(30);
		confirmingUndoType = type;
		undoTimeout = setTimeout(() => {
			confirmingUndoType = null;
			undoTimeout = null;
		}, 5000);
	}

	function cancelUndo() {
		confirmingUndoType = null;
		if (undoTimeout) { clearTimeout(undoTimeout); undoTimeout = null; }
	}

	function confirmUndoEvent(type: string) {
		if (undoTimeout) { clearTimeout(undoTimeout); undoTimeout = null; }
		confirmingUndoType = null;
		if ($settings.hapticFeedback) haptic(30);
		session.update(s => ({
			...s,
			events: s.events.filter(e => e.type !== type),
		}));
		if (type === 'water-break') {
			showTimePicker = false;
			showStepper = false;
		}
	}

	function openTimePicker() {
		if ($settings.hapticFeedback) haptic(30);
		showTimePicker = true;
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

	function recordEvent(type: 'mucus-plug' | 'bloody-show') {
		if ($session.events.some(e => e.type === type)) return;
		if ($settings.hapticFeedback) haptic(50);
		session.update(s => ({
			...s,
			events: [...s.events, {
				id: generateId(),
				type,
				timestamp: new Date().toISOString(),
				notes: '',
			}],
		}));
	}

	// undoEvent replaced by startUndoConfirm/confirmUndoEvent above

	let customTotal = $derived(customHours * 60 + customMinutes);
	let customPreview = $derived(
		customTotal === 0
			? $_('timer.eventButtons.setATimeAbove')
			: $_('timer.eventButtons.aroundTime', { values: { time: formatTimeShort(new Date(Date.now() - customTotal * 60000)) } })
	);
</script>

{#if showButton}
	<div class="event-buttons">
		{#if !hideWaterBreak && !waterBreak}
			<button class="water-btn" onclick={recordWaterBreak}>
				<span class="water-icon">💧</span>
				<span>{$_('timer.eventButtons.waterBroke')}</span>
			</button>
		{:else if !hideWaterBreak}
			<button class="water-btn water-btn--confirmed" disabled>
				<span class="water-icon">💧</span>
				<span>{$_('timer.eventButtons.waterBrokeAt', { values: { time: formatTimeShort(new Date(waterBreak.timestamp)) } })}</span>
			</button>

			{#if !showTimePicker}
				<div class="water-actions">
					<button class="action-btn" onclick={openTimePicker}>{$_('timer.eventButtons.editTime')}</button>
					{#if confirmingUndoType !== 'water-break'}
						<button class="action-btn action-btn--undo" onclick={() => startUndoConfirm('water-break')}>{$_('timer.eventButtons.undo')}</button>
					{:else}
						<div class="undo-confirm-inline">
							<button class="action-btn action-btn--confirm-yes" onclick={() => confirmUndoEvent('water-break')}>{$_('timer.eventButtons.remove')}</button>
							<button class="action-btn action-btn--confirm-no" onclick={cancelUndo}>{$_('common.cancel')}</button>
						</div>
					{/if}
				</div>
			{:else if !showStepper}
				<div class="time-picker">
					<div class="picker-header">
						<span>{$_('timer.eventButtons.whenDidItHappen')}</span>
						<button class="picker-close" onclick={() => showTimePicker = false}>✕</button>
					</div>
					<div class="picker-grid">
						<button class="time-pill" onclick={() => pickTime(0)}>{$_('timer.eventButtons.justNow')}</button>
						<button class="time-pill" onclick={() => pickTime(5)}>{$_('timer.eventButtons.fiveMinAgo')}</button>
						<button class="time-pill" onclick={() => pickTime(15)}>{$_('timer.eventButtons.fifteenMinAgo')}</button>
						<button class="time-pill" onclick={() => pickTime(30)}>{$_('timer.eventButtons.thirtyMinAgo')}</button>
						<button class="time-pill time-pill--custom" onclick={openStepper}>{$_('timer.eventButtons.earlier')}</button>
					</div>
				</div>
			{:else}
				<div class="time-picker">
					<div class="picker-header">
						<span>{$_('timer.eventButtons.setCustomTime')}</span>
						<button class="picker-close" onclick={() => { showTimePicker = false; showStepper = false; }}>✕</button>
					</div>
					<div class="stepper-row">
						<div class="stepper-group">
							<button class="stepper-btn" onclick={() => adjustHours(-1)}>−</button>
							<div class="stepper-value">{customHours}h</div>
							<button class="stepper-btn" onclick={() => adjustHours(1)}>+</button>
						</div>
						<span class="stepper-sep">:</span>
						<div class="stepper-group">
							<button class="stepper-btn" onclick={() => adjustMinutes(-15)}>−</button>
							<div class="stepper-value">{customMinutes}m</div>
							<button class="stepper-btn" onclick={() => adjustMinutes(15)}>+</button>
						</div>
					</div>
					<div class="stepper-preview">{customPreview}</div>
					<button class="stepper-log" onclick={() => pickTime(customTotal)}>{$_('timer.eventButtons.setTime')}</button>
				</div>
			{/if}
		{/if}

		<!-- More events toggle -->
		<button class="more-events-btn" onclick={() => showMoreEvents = !showMoreEvents}>
			{showMoreEvents ? $_('timer.eventButtons.fewerEvents') : $_('timer.eventButtons.moreEvents')}
		</button>
		{#if showMoreEvents}
			<div class="more-events">
				<!-- Mucus plug -->
				{#if !mucusPlug}
					<button class="event-btn event-btn--mucus" onclick={() => recordEvent('mucus-plug')}>
						<span class="event-btn-icon">🔴</span>
						<span>{$_('timer.eventButtons.mucusPlug')}</span>
					</button>
				{:else}
					<div class="event-confirmed">
						<span class="event-btn-icon">🔴</span>
						<span>{$_('timer.eventButtons.mucusPlugAt', { values: { time: formatTimeShort(new Date(mucusPlug.timestamp)) } })}</span>
						{#if confirmingUndoType !== 'mucus-plug'}
						<button class="event-undo" onclick={() => startUndoConfirm('mucus-plug')}>{$_('timer.eventButtons.undo')}</button>
					{:else}
						<div class="undo-confirm-inline">
							<button class="event-undo event-undo--confirm" onclick={() => confirmUndoEvent('mucus-plug')}>{$_('timer.eventButtons.remove')}</button>
							<button class="event-undo event-undo--cancel" onclick={cancelUndo}>{$_('common.cancel')}</button>
						</div>
					{/if}
					</div>
				{/if}

				<!-- Bloody show -->
				{#if !bloodyShow}
					<button class="event-btn event-btn--bloody" onclick={() => recordEvent('bloody-show')}>
						<span class="event-btn-icon">🩸</span>
						<span>{$_('timer.eventButtons.bloodyShow')}</span>
					</button>
				{:else}
					<div class="event-confirmed">
						<span class="event-btn-icon">🩸</span>
						<span>{$_('timer.eventButtons.bloodyShowAt', { values: { time: formatTimeShort(new Date(bloodyShow.timestamp)) } })}</span>
						{#if confirmingUndoType !== 'bloody-show'}
						<button class="event-undo" onclick={() => startUndoConfirm('bloody-show')}>{$_('timer.eventButtons.undo')}</button>
					{:else}
						<div class="undo-confirm-inline">
							<button class="event-undo event-undo--confirm" onclick={() => confirmUndoEvent('bloody-show')}>{$_('timer.eventButtons.remove')}</button>
							<button class="event-undo event-undo--cancel" onclick={cancelUndo}>{$_('common.cancel')}</button>
						</div>
					{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.event-buttons {
		margin-top: var(--space-4);
	}

	.water-btn {
		width: 100%;
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-md);
		border: 1px solid var(--water-muted);
		background: var(--water-muted);
		color: var(--water);
		font-size: var(--text-base);
		font-weight: 500;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
	}

	.water-btn--confirmed {
		border-color: var(--water-muted);
		background: var(--border-muted);
		color: var(--water);
		opacity: 0.7;
		cursor: default;
	}

	.water-icon { font-size: var(--text-lg); }

	.water-actions {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-2);
		justify-content: center;
	}

	.action-btn {
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius-sm);
		border: 1px solid var(--input-border);
		background: var(--border-muted);
		color: var(--text-secondary);
		font-size: var(--text-sm);
		cursor: pointer;
	}

	.action-btn--undo {
		color: var(--danger);
		border-color: var(--danger-muted);
	}

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
		font-size: var(--text-base);
		color: var(--text-secondary);
	}

	.picker-close {
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: var(--text-lg);
		cursor: pointer;
		padding: 0 var(--space-1);
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
		width: var(--space-6);
		height: var(--space-6);
		border-radius: var(--radius-sm);
		border: 1px solid var(--input-border);
		background: var(--border-muted);
		color: var(--text-secondary);
		font-size: var(--text-lg);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
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
		border: 1px solid var(--accent-muted);
		background: var(--accent-muted);
		color: var(--accent);
		font-size: var(--text-base);
		font-weight: 600;
		cursor: pointer;
	}

	.more-events-btn {
		width: 100%;
		margin-top: var(--space-2);
		padding: var(--space-2);
		border-radius: var(--radius-sm);
		border: 1px dashed var(--border);
		background: none;
		color: var(--text-muted);
		font-size: var(--text-sm);
		cursor: pointer;
	}

	.more-events {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}

	.event-btn {
		width: 100%;
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		background: var(--border-muted);
		color: var(--text-secondary);
		font-size: var(--text-base);
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.event-btn-icon { font-size: var(--text-base); }

	.event-confirmed {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--border-muted);
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.event-undo {
		margin-left: auto;
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-sm);
		border: 1px solid var(--danger-muted);
		background: none;
		color: var(--danger);
		font-size: var(--text-sm);
		cursor: pointer;
	}

	.undo-confirm-inline {
		display: flex;
		gap: var(--space-1);
		margin-left: auto;
		animation: undo-fade-in 150ms ease;
	}

	.action-btn--confirm-yes {
		color: var(--danger);
		border-color: var(--danger-muted);
		background: var(--danger-muted);
	}

	.action-btn--confirm-no {
		color: var(--text-muted);
		border-color: var(--border);
	}

	.event-undo--confirm {
		background: var(--danger-muted);
		margin-left: 0;
	}

	.event-undo--cancel {
		color: var(--text-muted);
		border-color: var(--border);
		margin-left: 0;
	}

	@keyframes undo-fade-in {
		from { opacity: 0; transform: scale(0.9); }
		to { opacity: 1; transform: scale(1); }
	}
</style>
