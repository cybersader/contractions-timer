<script lang="ts">
	import { peerState } from '../../lib/stores/p2p';
	import type { PeerInfo } from '../../lib/p2p/quick-connect';
	import { Wifi, WifiOff } from 'lucide-svelte';
	import { _ } from '../../lib/i18n/index';

	interface ToastMessage {
		id: number;
		text: string;
		type: 'join' | 'leave';
	}

	let toasts: ToastMessage[] = $state([]);
	let nextId = 0;
	let lastPeerIds: Set<number> = new Set();

	function addToast(text: string, type: 'join' | 'leave') {
		const id = nextId++;
		toasts = [...toasts, { id, text, type }];
		setTimeout(() => {
			toasts = toasts.filter(t => t.id !== id);
		}, 3000);
	}

	// Watch for peer changes
	$effect(() => {
		const peers = $peerState.peers;
		const currentIds = new Set(peers.map(p => p.id));

		if (lastPeerIds.size > 0) {
			// Check for new peers
			for (const peer of peers) {
				if (!lastPeerIds.has(peer.id)) {
					addToast($_('shared.toast.peerJoined', { values: { name: peer.name } }), 'join');
				}
			}
			// Check for left peers
			for (const id of lastPeerIds) {
				if (!currentIds.has(id)) {
					addToast($_('shared.toast.partnerDisconnected'), 'leave');
				}
			}
		}

		lastPeerIds = currentIds;
	});
</script>

{#if toasts.length > 0}
	<div class="toast-container">
		{#each toasts as toast (toast.id)}
			<div class="toast" class:toast-join={toast.type === 'join'} class:toast-leave={toast.type === 'leave'}>
				{#if toast.type === 'join'}
					<Wifi size={14} />
				{:else}
					<WifiOff size={14} />
				{/if}
				<span>{toast.text}</span>
			</div>
		{/each}
	</div>
{/if}

<style>
	.toast-container {
		position: fixed;
		top: calc(var(--header-height, 48px) + env(safe-area-inset-top, 0px) + var(--space-2));
		left: 50%;
		transform: translateX(-50%);
		z-index: 100;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		pointer-events: none;
	}

	.toast {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
		font-weight: 500;
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		animation: toastIn 300ms ease-out;
		white-space: nowrap;
	}

	.toast-join {
		background: var(--accent-muted);
		color: var(--accent);
		border: 1px solid var(--accent);
	}

	.toast-leave {
		background: var(--bg-card);
		color: var(--text-muted);
		border: 1px solid var(--border);
	}

	@keyframes toastIn {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
