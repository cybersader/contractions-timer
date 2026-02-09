<script lang="ts">
	import { session } from '../../lib/stores/session';
	import { timerPhase } from '../../lib/stores/timer';
	import { EMPTY_SESSION } from '../../lib/labor-logic/types';
	import { haptic } from '../../lib/haptic';
	import { settings } from '../../lib/stores/settings';

	$: phase = $timerPhase;
	$: hasContractions = $session.contractions.length > 0;
	$: paused = $session.paused;

	let showClearConfirm = false;

	function togglePause() {
		if ($settings.hapticFeedback) haptic(30);
		session.update(s => ({ ...s, paused: !s.paused }));
	}

	function deleteLast() {
		if ($settings.hapticFeedback) haptic(30);
		session.update(s => ({
			...s,
			contractions: s.contractions.slice(0, -1),
		}));
	}

	function clearAll() {
		if (!showClearConfirm) {
			showClearConfirm = true;
			return;
		}
		if ($settings.hapticFeedback) haptic(50);
		session.set({ ...EMPTY_SESSION, layout: [...EMPTY_SESSION.layout] });
		showClearConfirm = false;
	}
</script>

{#if hasContractions}
	<div class="session-controls">
		<button
			class="ctrl-btn"
			class:active={paused}
			disabled={phase === 'contracting'}
			on:click={togglePause}
		>
			{paused ? 'Resume' : 'Pause'}
		</button>

		<button class="ctrl-btn ctrl-btn--delete" on:click={deleteLast}>
			Delete last
		</button>

		{#if showClearConfirm}
			<button class="ctrl-btn ctrl-btn--danger" on:click={clearAll}>
				Confirm clear
			</button>
			<button class="ctrl-btn" on:click={() => showClearConfirm = false}>
				Cancel
			</button>
		{:else}
			<button class="ctrl-btn ctrl-btn--clear" on:click={clearAll}>
				Clear all
			</button>
		{/if}
	</div>
{/if}

<style>
	.session-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 16px;
		justify-content: center;
	}

	.ctrl-btn {
		padding: 6px 14px;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(255, 255, 255, 0.03);
		color: rgba(255, 255, 255, 0.5);
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.ctrl-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.ctrl-btn.active {
		background: rgba(129, 140, 248, 0.1);
		border-color: rgba(129, 140, 248, 0.3);
		color: #818cf8;
	}

	.ctrl-btn--delete {
		color: rgba(251, 191, 36, 0.7);
		border-color: rgba(251, 191, 36, 0.15);
	}

	.ctrl-btn--clear {
		color: rgba(248, 113, 113, 0.6);
		border-color: rgba(248, 113, 113, 0.15);
	}

	.ctrl-btn--danger {
		color: #f87171;
		background: rgba(248, 113, 113, 0.1);
		border-color: rgba(248, 113, 113, 0.3);
		font-weight: 600;
	}
</style>
