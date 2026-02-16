<script lang="ts">
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import { EMPTY_SESSION, DEFAULT_SETTINGS } from '../../lib/labor-logic/types';
	import { listArchives, restoreArchive, deleteArchive, newSession, type ArchiveEntry } from '../../lib/sessionArchive';
	import { saveSession } from '../../lib/storage';
	import { Plus } from 'lucide-svelte';
	import { _ } from '../../lib/i18n/index';

	let archives = $state<ArchiveEntry[]>(listArchives());
	let confirmDeleteKey = $state<string | null>(null);
	let confirmNew = $state(false);

	function handleNewSession() {
		if (!confirmNew) { confirmNew = true; return; }
		// Flush the debounced save so archive captures the latest state
		saveSession($session);
		newSession();
		session.set({ ...EMPTY_SESSION, layout: [...EMPTY_SESSION.layout] });
		settings.set({ ...DEFAULT_SETTINGS });
		confirmNew = false;
		// Let the store subscription settle before refreshing archives
		queueMicrotask(() => { archives = listArchives(); });
	}

	function handleRestore(key: string) {
		const data = restoreArchive(key);
		if (data) {
			session.set(data);
			archives = listArchives();
		}
	}

	function handleDelete(key: string) {
		if (confirmDeleteKey !== key) { confirmDeleteKey = key; return; }
		deleteArchive(key);
		confirmDeleteKey = null;
		archives = listArchives();
	}
</script>

<div class="session-manager">
	<div class="sm-header">
		{#if !confirmNew}
			<button class="sm-new-btn" onclick={handleNewSession}>
				<Plus size={18} />
				{$_('shared.sessionManager.newSession')}
			</button>
		{:else}
			<div class="sm-confirm">
				<span class="sm-confirm-text">{$_('shared.sessionManager.archiveConfirmPrompt')}</span>
				<div class="sm-confirm-btns">
					<button class="sm-btn sm-btn--yes" onclick={handleNewSession}>{$_('shared.sessionManager.yesStartNew')}</button>
					<button class="sm-btn sm-btn--no" onclick={() => confirmNew = false}>{$_('common.cancel')}</button>
				</div>
			</div>
		{/if}
	</div>

	{#if archives.length > 0}
		<div class="sm-label">{$_('shared.sessionManager.previousSessions')}</div>
		<div class="sm-list">
			{#each archives as arc (arc.key)}
				<div class="sm-archive">
					<div class="sm-archive-info">
						<span class="sm-archive-date">{arc.date}</span>
						<span class="sm-archive-count">{arc.summary}</span>
					</div>
					<div class="sm-archive-actions">
						<button class="sm-btn sm-btn--restore" onclick={() => handleRestore(arc.key)}>{$_('shared.sessionManager.restore')}</button>
						{#if confirmDeleteKey === arc.key}
							<button class="sm-btn sm-btn--delete-confirm" onclick={() => handleDelete(arc.key)}>{$_('shared.sessionManager.confirmDelete')}</button>
						{:else}
							<button class="sm-btn sm-btn--delete" onclick={() => handleDelete(arc.key)}>{$_('common.delete')}</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="sm-empty">{$_('shared.sessionManager.noArchivedSessions')}</div>
	{/if}
</div>

<style>
	.session-manager {
		padding: var(--space-4);
	}

	.sm-header {
		margin-bottom: var(--space-4);
	}

	.sm-new-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-3);
		border-radius: var(--radius-md);
		border: 1px solid var(--accent-muted);
		background: var(--accent-muted);
		color: var(--accent);
		font-size: var(--text-base);
		font-weight: 600;
		cursor: pointer;
	}

	.sm-confirm {
		padding: var(--space-3);
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
	}

	.sm-confirm-text {
		display: block;
		font-size: var(--text-base);
		color: var(--text-secondary);
		margin-bottom: var(--space-2);
	}

	.sm-confirm-btns {
		display: flex;
		gap: var(--space-2);
	}

	.sm-btn {
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-sm);
		font-size: var(--text-sm);
		cursor: pointer;
		border: 1px solid var(--border);
		background: var(--border-muted);
		color: var(--text-secondary);
	}

	.sm-btn--yes {
		background: var(--accent-muted);
		border-color: var(--accent-muted);
		color: var(--accent);
		font-weight: 600;
	}

	.sm-btn--no {
		color: var(--text-muted);
	}

	.sm-btn--restore {
		color: var(--accent);
		border-color: var(--accent-muted);
	}

	.sm-btn--delete {
		color: var(--danger);
		border-color: var(--danger-muted);
	}

	.sm-btn--delete-confirm {
		background: var(--danger-muted);
		border-color: var(--danger);
		color: var(--danger);
		font-weight: 600;
	}

	.sm-label {
		font-size: var(--text-sm);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-faint);
		margin-bottom: var(--space-2);
	}

	.sm-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.sm-archive {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-3) var(--space-3);
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
	}

	.sm-archive-info {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.sm-archive-date {
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.sm-archive-count {
		font-size: var(--text-xs);
		color: var(--text-muted);
	}

	.sm-archive-actions {
		display: flex;
		gap: var(--space-2);
	}

	.sm-empty {
		text-align: center;
		padding: var(--space-5);
		font-size: var(--text-sm);
		color: var(--text-faint);
	}
</style>
