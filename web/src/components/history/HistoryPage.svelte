<script lang="ts">
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import { formatTime, formatDurationShort, formatInterval, getIntensityLabel, getLocationLabel, generateId, formatTimeShort } from '../../lib/labor-logic/formatters';
	import { getDurationSeconds, getIntervalMinutes } from '../../lib/labor-logic/calculations';
	import { haptic } from '../../lib/haptic';
	import type { Contraction } from '../../lib/labor-logic/types';

	$: completed = $session.contractions.filter(c => c.end !== null);
	$: reversed = [...completed].reverse();
	$: eventsList = $session.events;

	let editingId: string | null = null;
	let editIntensity: number | null = null;
	let editLocation: string | null = null;

	function startEdit(c: Contraction) {
		if ($settings.hapticFeedback) haptic(20);
		editingId = c.id;
		editIntensity = c.intensity;
		editLocation = c.location;
	}

	function saveEdit() {
		if (!editingId) return;
		const id = editingId;
		session.update(s => ({
			...s,
			contractions: s.contractions.map(c =>
				c.id === id ? { ...c, intensity: editIntensity, location: editLocation as any } : c
			),
		}));
		editingId = null;
	}

	function cancelEdit() {
		editingId = null;
	}

	function deleteContraction(id: string) {
		if ($settings.hapticFeedback) haptic(30);
		session.update(s => ({
			...s,
			contractions: s.contractions.filter(c => c.id !== id),
		}));
		editingId = null;
	}
</script>

<div class="page">
	<h2 class="page-title">History</h2>

	{#if reversed.length === 0}
		<div class="empty-state">
			<p>No contractions recorded yet.</p>
		</div>
	{:else}
		<div class="history-list">
			{#each reversed as c, i}
				{@const idx = completed.length - 1 - i}

				<!-- Interleave events that occurred between this and next contraction -->
				{#each eventsList.filter(e => {
					const et = new Date(e.timestamp).getTime();
					const ct = new Date(c.start).getTime();
					const nextC = reversed[i - 1];
					const nt = nextC ? new Date(nextC.start).getTime() : Infinity;
					return et >= ct && et < nt;
				}) as event}
					<div class="event-row event--{event.type}">
						<span class="event-icon">
							{event.type === 'water-break' ? '💧' : '📌'}
						</span>
						<span class="event-text">
							{event.type === 'water-break' ? 'Water broke' : event.type} at {formatTime(event.timestamp)}
						</span>
					</div>
				{/each}

				{#if editingId === c.id}
					<!-- Inline editor -->
					<div class="editor-card">
						<div class="editor-header">
							<span>Editing #{idx + 1}</span>
							<span class="editor-time">{formatTime(c.start)}</span>
						</div>
						<div class="editor-section">
							<span class="editor-label">Intensity</span>
							<div class="editor-pills">
								{#each [1, 2, 3, 4, 5] as level}
									<button
										class="editor-pill"
										class:selected={editIntensity === level}
										style="--dot-color: var(--color-intensity-{level})"
										on:click={() => editIntensity = level}
									>
										{level}
									</button>
								{/each}
								<button class="editor-pill" class:selected={editIntensity === null} on:click={() => editIntensity = null}>
									None
								</button>
							</div>
						</div>
						<div class="editor-section">
							<span class="editor-label">Location</span>
							<div class="editor-pills">
								{#each [['front', 'Front'], ['back', 'Back'], ['wrapping', 'Wrap']] as [val, label]}
									<button
										class="editor-pill"
										class:selected={editLocation === val}
										on:click={() => editLocation = val}
									>
										{label}
									</button>
								{/each}
								<button class="editor-pill" class:selected={editLocation === null} on:click={() => editLocation = null}>
									None
								</button>
							</div>
						</div>
						<div class="editor-actions">
							<button class="editor-btn editor-btn--save" on:click={saveEdit}>Save</button>
							<button class="editor-btn" on:click={cancelEdit}>Cancel</button>
							<button class="editor-btn editor-btn--delete" on:click={() => deleteContraction(c.id)}>Delete</button>
						</div>
					</div>
				{:else}
					<!-- Normal row -->
					<button class="history-item" on:click={() => startEdit(c)}>
						<div class="item-num">#{idx + 1}</div>
						<div class="item-details">
							<div class="item-time">{formatTime(c.start)}</div>
							<div class="item-meta">
								{#if c.untimed}
									<span>Untimed</span>
								{:else}
									<span>{formatDurationShort(getDurationSeconds(c))}</span>
								{/if}
								{#if idx > 0}
									<span class="sep">&middot;</span>
									<span>{formatInterval(getIntervalMinutes(c, completed[idx - 1]))} apart</span>
								{/if}
							</div>
						</div>
						<div class="item-rating">
							{#if c.intensity}
								<span class="intensity-dot" style="background: var(--color-intensity-{c.intensity})"></span>
								<span class="intensity-label">{getIntensityLabel(c.intensity)}</span>
							{/if}
							{#if c.location}
								<span class="location-label">{getLocationLabel(c.location)}</span>
							{/if}
						</div>
					</button>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<style>
	.empty-state { text-align: center; padding: 48px 16px; color: rgba(255, 255, 255, 0.4); font-size: 0.9rem; }

	.history-list { display: flex; flex-direction: column; gap: 4px; }

	.history-item {
		display: flex; align-items: center; gap: 10px; padding: 10px 12px;
		background: rgba(255, 255, 255, 0.02); border-radius: 10px;
		border: none; width: 100%; text-align: left; cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	.history-item:active { background: rgba(255, 255, 255, 0.05); }

	.item-num { font-size: 0.72rem; color: rgba(255, 255, 255, 0.3); min-width: 28px; font-weight: 600; }
	.item-details { flex: 1; }
	.item-time { font-size: 0.82rem; color: rgba(255, 255, 255, 0.8); }
	.item-meta { font-size: 0.72rem; color: rgba(255, 255, 255, 0.4); margin-top: 2px; }
	.sep { margin: 0 3px; }
	.item-rating { display: flex; align-items: center; gap: 4px; font-size: 0.7rem; color: rgba(255, 255, 255, 0.5); }
	.intensity-dot { width: 6px; height: 6px; border-radius: 50%; }
	.intensity-label, .location-label { font-size: 0.68rem; }

	/* Event rows */
	.event-row { display: flex; align-items: center; gap: 8px; padding: 6px 12px; font-size: 0.75rem; color: rgba(255, 255, 255, 0.5); }
	.event--water-break { color: #60a5fa; }
	.event-icon { font-size: 0.85rem; }

	/* Editor */
	.editor-card { background: rgba(129, 140, 248, 0.04); border: 1px solid rgba(129, 140, 248, 0.2); border-radius: 12px; padding: 12px; }
	.editor-header { display: flex; justify-content: space-between; font-size: 0.82rem; color: rgba(255, 255, 255, 0.7); margin-bottom: 10px; }
	.editor-time { color: rgba(255, 255, 255, 0.4); }
	.editor-section { margin-bottom: 8px; }
	.editor-label { font-size: 0.72rem; color: rgba(255, 255, 255, 0.4); margin-bottom: 4px; display: block; }
	.editor-pills { display: flex; gap: 4px; flex-wrap: wrap; }
	.editor-pill { padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.03); color: rgba(255, 255, 255, 0.5); font-size: 0.72rem; cursor: pointer; }
	.editor-pill.selected { background: rgba(129, 140, 248, 0.12); border-color: rgba(129, 140, 248, 0.3); color: #818cf8; }
	.editor-actions { display: flex; gap: 6px; margin-top: 10px; }
	.editor-btn { padding: 6px 14px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.03); color: rgba(255, 255, 255, 0.5); font-size: 0.75rem; cursor: pointer; }
	.editor-btn--save { background: rgba(129, 140, 248, 0.1); border-color: rgba(129, 140, 248, 0.3); color: #818cf8; font-weight: 600; }
	.editor-btn--delete { color: #f87171; border-color: rgba(248, 113, 113, 0.2); margin-left: auto; }
</style>
