/**
 * P2P sharing state store.
 * Tracks connection status, room info, peer list, and sharing mode.
 */

import { writable, derived } from 'svelte/store';
import type { PeerInfo } from '../p2p/quick-connect';
import type { ConnectionDiagnostics } from '../p2p/diagnostics';

export interface P2PState {
	status: 'disconnected' | 'connecting' | 'hosting' | 'joined';
	roomCode: string | null;
	peers: PeerInfo[];
	mode: 'collaborative' | 'view-only';
	isOwner: boolean;
	error: string | null;
	/** Which sharing mode is active */
	shareMode: 'quick' | 'private' | null;
	/** Private mode: the compressed offer code (host only) */
	privateOfferCode: string | null;
	/** Private mode: the compressed answer code (guest only) */
	privateAnswerCode: string | null;
	/** Fine-grained connection phase for UI progress display */
	connectPhase: string | null;
	/** Connection diagnostics for troubleshooting */
	diagnostics: ConnectionDiagnostics | null;
}

const INITIAL_STATE: P2PState = {
	status: 'disconnected',
	roomCode: null,
	peers: [],
	mode: 'collaborative',
	isOwner: false,
	error: null,
	shareMode: null,
	privateOfferCode: null,
	privateAnswerCode: null,
	connectPhase: null,
	diagnostics: null,
};

export const peerState = writable<P2PState>({ ...INITIAL_STATE });

/** Whether P2P is currently active (hosting or joined) */
export const isP2PActive = derived(peerState, ($s) =>
	$s.status === 'hosting' || $s.status === 'joined'
);

/** Number of connected peers (including self) */
export const peerCount = derived(peerState, ($s) => $s.peers.length);

/** Reset to disconnected state */
export function resetP2PState(): void {
	peerState.set({ ...INITIAL_STATE });
}
