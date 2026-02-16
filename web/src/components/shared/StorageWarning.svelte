<script lang="ts">
	import { storageError } from '../../lib/storage';
	import { AlertTriangle, X } from 'lucide-svelte';
	import { _ } from 'svelte-i18n';
</script>

{#if $storageError}
	<div class="storage-toast" role="alert">
		<span class="toast-icon"><AlertTriangle size={18} /></span>
		<span class="toast-msg">{$storageError}</span>
		<button class="toast-close" onclick={() => storageError.set(null)} aria-label={$_('shared.storageWarning.dismissAriaLabel')}>
			<X size={16} />
		</button>
	</div>
{/if}

<style>
	.storage-toast {
		position: fixed;
		bottom: calc(72px + env(safe-area-inset-bottom, 0px));
		left: var(--space-3);
		right: var(--space-3);
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--danger-muted);
		border: 1px solid var(--danger);
		color: var(--danger);
		font-size: var(--text-sm);
		z-index: 100;
		animation: toastIn var(--transition-base);
	}

	@keyframes toastIn {
		from { opacity: 0; transform: translateY(var(--space-2)); }
		to { opacity: 1; transform: translateY(0); }
	}

	.toast-icon { display: flex; align-items: center; flex-shrink: 0; }
	.toast-msg { flex: 1; }

	.toast-close {
		background: none;
		border: none;
		color: var(--danger);
		cursor: pointer;
		padding: 0 var(--space-1);
		flex-shrink: 0;
		display: flex;
		align-items: center;
	}
</style>
