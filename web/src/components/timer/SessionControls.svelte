<script lang="ts">
	import { _ } from '../../lib/i18n/index';
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import { EMPTY_SESSION, DEFAULT_SETTINGS } from '../../lib/labor-logic/types';
	import { haptic } from '../../lib/haptic';
	import { newSession } from '../../lib/sessionArchive';
	import { Undo2 } from 'lucide-svelte';

	let hasContractions = $derived($session.contractions.length > 0);

	let showNewConfirm = $state(false);

	function deleteLast() {
		if ($settings.hapticFeedback) haptic(30);
		session.update(s => {
			const contractions = s.contractions.slice(0, -1);
			return {
				...s,
				contractions,
				// Reset pause when no contractions remain (prevents stuck overlay)
				paused: contractions.length === 0 ? false : s.paused,
			};
		});
	}

	function handleNewSession() {
		if (!showNewConfirm) {
			showNewConfirm = true;
			return;
		}
		if ($settings.hapticFeedback) haptic(50);
		newSession();
		session.set({ ...EMPTY_SESSION, layout: [...EMPTY_SESSION.layout] });
		settings.set({ ...DEFAULT_SETTINGS });
		showNewConfirm = false;
	}
</script>

{#if hasContractions}
	<div class="session-controls">
		<button class="ctrl-btn ctrl-btn--undo" onclick={deleteLast}>
			<Undo2 size={14} aria-hidden="true" />
			{$_('timer.sessionControls.undoLast')}
		</button>

		{#if showNewConfirm}
			<button class="ctrl-btn ctrl-btn--danger" onclick={handleNewSession}>
				{$_('timer.sessionControls.archiveAndStartNew')}
			</button>
			<button class="ctrl-btn" onclick={() => showNewConfirm = false}>
				{$_('common.cancel')}
			</button>
		{:else}
			<button class="ctrl-btn ctrl-btn--new" onclick={handleNewSession}>
				{$_('timer.sessionControls.newSession')}
			</button>
		{/if}
	</div>
{/if}

<style>
	.session-controls {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-4);
		justify-content: center;
	}

	.ctrl-btn {
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius-sm);
		border: 1px solid var(--input-border);
		background: var(--bg-card);
		color: var(--text-muted);
		font-size: var(--text-sm);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.ctrl-btn--undo {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	.ctrl-btn--new {
		color: var(--accent);
		border-color: var(--accent-muted);
	}

	.ctrl-btn--danger {
		color: var(--danger);
		background: var(--danger-muted);
		border-color: var(--danger-muted);
		font-weight: 600;
	}
</style>
