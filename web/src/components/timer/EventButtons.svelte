<script lang="ts">
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import { formatTimeShort, generateId } from '../../lib/labor-logic/formatters';
	import { haptic } from '../../lib/haptic';
	import type { LaborEvent } from '../../lib/labor-logic/types';

	$: waterBreak = $session.events.find(e => e.type === 'water-break') as LaborEvent | undefined;
	$: showButton = $settings.showWaterBreakButton;

	let showTimePicker = false;
	let showStepper = false;
	let customHours = 1;
	let customMinutes = 0;

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

	function undoWaterBreak() {
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

	$: customTotal = customHours * 60 + customMinutes;
	$: customPreview = customTotal === 0
		? 'Set a time above'
		: `Around ${formatTimeShort(new Date(Date.now() - customTotal * 60000))}`;
</script>

{#if showButton}
	<div class="event-buttons">
		{#if !waterBreak}
			<button class="water-btn" on:click={recordWaterBreak}>
				<span class="water-icon">💧</span>
				<span>Water broke</span>
			</button>
		{:else}
			<button class="water-btn water-btn--confirmed" disabled>
				<span class="water-icon">💧</span>
				<span>✓ Water broke at {formatTimeShort(new Date(waterBreak.timestamp))}</span>
			</button>

			{#if !showTimePicker}
				<div class="water-actions">
					<button class="action-btn" on:click={openTimePicker}>✏️ Edit time</button>
					<button class="action-btn action-btn--undo" on:click={undoWaterBreak}>Undo</button>
				</div>
			{:else if !showStepper}
				<div class="time-picker">
					<div class="picker-header">
						<span>When did it happen?</span>
						<button class="picker-close" on:click={() => showTimePicker = false}>✕</button>
					</div>
					<div class="picker-grid">
						<button class="time-pill" on:click={() => pickTime(0)}>Just now</button>
						<button class="time-pill" on:click={() => pickTime(5)}>~5 min ago</button>
						<button class="time-pill" on:click={() => pickTime(15)}>~15 min ago</button>
						<button class="time-pill" on:click={() => pickTime(30)}>~30 min ago</button>
						<button class="time-pill time-pill--custom" on:click={openStepper}>Earlier...</button>
					</div>
				</div>
			{:else}
				<div class="time-picker">
					<div class="picker-header">
						<span>Set custom time</span>
						<button class="picker-close" on:click={() => { showTimePicker = false; showStepper = false; }}>✕</button>
					</div>
					<div class="stepper-row">
						<div class="stepper-group">
							<button class="stepper-btn" on:click={() => adjustHours(-1)}>−</button>
							<div class="stepper-value">{customHours}h</div>
							<button class="stepper-btn" on:click={() => adjustHours(1)}>+</button>
						</div>
						<span class="stepper-sep">:</span>
						<div class="stepper-group">
							<button class="stepper-btn" on:click={() => adjustMinutes(-15)}>−</button>
							<div class="stepper-value">{customMinutes}m</div>
							<button class="stepper-btn" on:click={() => adjustMinutes(15)}>+</button>
						</div>
					</div>
					<div class="stepper-preview">{customPreview}</div>
					<button class="stepper-log" on:click={() => pickTime(customTotal)}>Set time</button>
				</div>
			{/if}
		{/if}
	</div>
{/if}

<style>
	.event-buttons {
		margin-top: 16px;
	}

	.water-btn {
		width: 100%;
		padding: 10px 16px;
		border-radius: 10px;
		border: 1px solid rgba(59, 130, 246, 0.25);
		background: rgba(59, 130, 246, 0.06);
		color: #60a5fa;
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
	}

	.water-btn--confirmed {
		border-color: rgba(59, 130, 246, 0.15);
		background: rgba(59, 130, 246, 0.04);
		color: rgba(96, 165, 250, 0.7);
		cursor: default;
	}

	.water-icon { font-size: 1rem; }

	.water-actions {
		display: flex;
		gap: 8px;
		margin-top: 8px;
		justify-content: center;
	}

	.action-btn {
		padding: 6px 14px;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(255, 255, 255, 0.04);
		color: rgba(255, 255, 255, 0.6);
		font-size: 0.78rem;
		cursor: pointer;
	}

	.action-btn--undo {
		color: #f87171;
		border-color: rgba(248, 113, 113, 0.2);
	}

	.time-picker {
		margin-top: 8px;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		padding: 12px;
	}

	.picker-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10px;
		font-size: 0.82rem;
		color: rgba(255, 255, 255, 0.6);
	}

	.picker-close {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.4);
		font-size: 1rem;
		cursor: pointer;
		padding: 0 4px;
	}

	.picker-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 6px;
	}

	.time-pill {
		padding: 8px 12px;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(255, 255, 255, 0.04);
		color: rgba(255, 255, 255, 0.7);
		font-size: 0.78rem;
		cursor: pointer;
	}

	.time-pill:active { background: rgba(255, 255, 255, 0.08); }

	.time-pill--custom {
		grid-column: span 2;
		border-color: rgba(129, 140, 248, 0.2);
		color: #818cf8;
	}

	.stepper-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin-bottom: 8px;
	}

	.stepper-group {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.stepper-btn {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(255, 255, 255, 0.04);
		color: rgba(255, 255, 255, 0.7);
		font-size: 1rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.stepper-value {
		min-width: 36px;
		text-align: center;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.9rem;
		color: rgba(255, 255, 255, 0.8);
	}

	.stepper-sep {
		color: rgba(255, 255, 255, 0.3);
		font-size: 1.2rem;
	}

	.stepper-preview {
		text-align: center;
		font-size: 0.78rem;
		color: rgba(255, 255, 255, 0.4);
		margin-bottom: 8px;
	}

	.stepper-log {
		width: 100%;
		padding: 8px;
		border-radius: 8px;
		border: 1px solid rgba(129, 140, 248, 0.3);
		background: rgba(129, 140, 248, 0.08);
		color: #818cf8;
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
	}
</style>
