/**
 * Bidirectional sync bridge: Y.js doc <-> session Svelte store.
 *
 * - Local changes (user actions) → pushed to Y.Doc → broadcast to peers
 * - Remote changes (peer actions) → pulled from Y.Doc → written to session store
 * - Generation-based loop guard prevents feedback loops
 *
 * Supports two connection modes:
 * - Quick: y-webrtc with signaling server + STUN (one room code)
 * - Private: raw WebRTC with manual SDP exchange (zero servers, same network)
 */

import * as Y from 'yjs';
import { get } from 'svelte/store';
import { session } from '../stores/session';
import { peerState } from '../stores/p2p';
import {
	createRoom,
	joinRoom,
	leaveRoom as leaveQuickRoom,
	pushLocalChanges as pushQuickChanges,
	getRoomMode,
	getRoomUrl,
	getSignalingType,
	getStoredSignalingUrl,
	type PeerInfo,
} from './quick-connect';
import {
	createHttpRoom,
	joinHttpRoom,
	leaveHttpRoom,
	pushHttpLocalChanges,
	buildBackendWithFallback,
} from './http-signaling';
import { createPrivateOffer, acceptPrivateOffer, type PrivateConnection } from './private-connect';
import { createYDoc, applySessionDelta, observeYDoc, yDocToSession } from './ydoc';
import { DataChannelProvider } from './ydoc-provider';
import type { SessionData } from '../labor-logic/types';
import { EMPTY_DIAGNOSTICS, type ConnectionDiagnostics } from './diagnostics';

// Always log — P2P events are infrequent and critical for debugging
function debug(...args: unknown[]) { console.debug('[sync-bridge]', ...args); }

let lastKnownSession: SessionData | null = null;
let unsubscribeSession: (() => void) | null = null;

// Generation-based loop guard
let syncGeneration = 0;
let lastProcessedGeneration = 0;

// Active mode tracking
let activeMode: 'quick' | 'quick-http' | 'private' | null = null;

// HTTP signaling state
let httpCleanupFn: (() => void) | null = null;

// Private mode state
let privateConnection: PrivateConnection | null = null;
let privateDoc: Y.Doc | null = null;
let privateProvider: DataChannelProvider | null = null;
let privateUnobserve: (() => void) | null = null;
let privateCancelFn: (() => void) | null = null;

// Pending host offer (replaces globalThis.__ct_waitForAnswer)
let pendingHostOffer: {
	waitForAnswer: (code: string) => Promise<PrivateConnection>;
	cancel: () => void;
} | null = null;

// --- Quick Connect (existing) ---

/** Start hosting a room via Quick Connect (signaling server or HTTP relay) */
export async function startSharing(config: {
	ownerName: string;
	mode: 'collaborative' | 'view-only';
	password?: string;
}): Promise<string> {
	const currentSession = get(session);

	lastKnownSession = structuredClone(currentSession);
	syncGeneration = 0;
	lastProcessedGeneration = 0;

	peerState.update(s => ({ ...s, status: 'connecting', error: null }));

	const sigType = getSignalingType();

	if (sigType === 'http') {
		// --- HTTP signaling (CF Worker, ntfy.sh) ---
		try {
			debug('Creating HTTP-signaled room...', 'password:', config.password ? 'yes' : 'no');
			const backend = buildBackendWithFallback(getStoredSignalingUrl());
			const result = await createHttpRoom(
				currentSession,
				{ ownerName: config.ownerName, mode: config.mode, password: config.password },
				backend,
				handleRemoteChange,
				handlePeersChange,
				(phase) => peerState.update(s => ({ ...s, connectPhase: phase })),
				(error) => peerState.update(s => ({ ...s, error })),
			);

			debug('HTTP room created:', result.roomCode);
			activeMode = 'quick-http';
			httpCleanupFn = result.cleanup;

			peerState.update(s => ({
				...s,
				status: 'hosting',
				roomCode: result.roomCode,
				shareMode: 'quick',
				mode: config.mode,
				isOwner: true,
				error: null,
			}));

			startLocalSync();
			return result.roomCode;
		} catch (e) {
			debug('Failed to create HTTP room:', e);
			lastKnownSession = null;
			peerState.update(s => ({
				...s,
				status: 'disconnected',
				error: e instanceof Error ? e.message : 'Failed to create room',
			}));
			throw e;
		}
	}

	// --- WebSocket signaling (y-webrtc) ---
	try {
		debug('Creating quick room (WebSocket)...');
		const connection = await createRoom(
			currentSession,
			config,
			handleRemoteChange,
			handlePeersChange
		);

		debug('Room created:', connection.roomConfig.roomCode);
		activeMode = 'quick';

		peerState.update(s => ({
			...s,
			status: 'hosting',
			roomCode: connection.roomConfig.roomCode,
			shareMode: 'quick',
			mode: config.mode,
			isOwner: true,
			error: null,
		}));

		startLocalSync();
		return connection.roomConfig.roomCode;
	} catch (e) {
		debug('Failed to create room:', e);
		lastKnownSession = null;
		peerState.update(s => ({
			...s,
			status: 'disconnected',
			error: e instanceof Error ? e.message : 'Failed to create room',
		}));
		throw e;
	}
}

/** Join an existing room via Quick Connect */
export async function joinSharing(config: {
	roomCode: string;
	guestName: string;
	password?: string;
}): Promise<void> {
	lastKnownSession = structuredClone(get(session));
	syncGeneration = 0;
	lastProcessedGeneration = 0;

	peerState.update(s => ({ ...s, status: 'connecting', error: null }));

	const sigType = getSignalingType();

	if (sigType === 'http') {
		// --- HTTP signaling (CF Worker, ntfy.sh) ---
		try {
			debug('Joining HTTP room:', config.roomCode, 'password:', config.password ? 'yes' : 'no');
			const backend = buildBackendWithFallback(getStoredSignalingUrl());
			const result = await joinHttpRoom(
				config.roomCode,
				config.guestName,
				backend,
				handleRemoteChange,
				handlePeersChange,
				(phase) => peerState.update(s => ({ ...s, connectPhase: phase })),
				config.password,
			);

			httpCleanupFn = result.cleanup;
			activeMode = 'quick-http';

			peerState.update(s => ({
				...s,
				status: 'connecting',
				roomCode: config.roomCode,
				shareMode: 'quick',
				mode: 'collaborative',
				isOwner: false,
				error: null,
			}));

			// Wait for WebRTC connection to complete
			try {
				await result.waitForConnection();
				debug('HTTP room joined successfully!');
				peerState.update(s => ({
					...s,
					status: 'joined',
					error: null,
				}));
				startLocalSync();
			} catch (connErr) {
				const msg = connErr instanceof Error ? connErr.message : 'Connection failed';
				debug('HTTP connection wait failed:', msg);
				peerState.update(s => ({ ...s, status: 'disconnected', error: msg }));
			}
		} catch (e) {
			debug('Failed to join HTTP room:', e);
			lastKnownSession = null;
			peerState.update(s => ({
				...s,
				status: 'disconnected',
				error: e instanceof Error ? e.message : 'Failed to join room',
			}));
			throw e;
		}
		return;
	}

	// --- WebSocket signaling (y-webrtc) ---
	try {
		debug('Joining quick room (WebSocket):', config.roomCode);
		const connection = await joinRoom(
			config.roomCode,
			config.guestName,
			config.password,
			handleRemoteChange,
			handlePeersChange
		);

		// Wait for actual Y.js sync with the host (not an arbitrary delay)
		try {
			debug('Waiting for Y.js sync with host...');
			await connection.waitForSync();
			debug('Sync complete!');
		} catch (syncErr) {
			// Timeout — show error but stay connected (sync may happen later)
			const msg = syncErr instanceof Error ? syncErr.message : 'Sync timed out';
			debug('Sync wait failed:', msg);
			peerState.update(s => ({ ...s, error: msg }));
		}

		const mode = getRoomMode(connection);
		debug('Room mode:', mode);
		activeMode = 'quick';

		peerState.update(s => ({
			...s,
			status: 'joined',
			roomCode: config.roomCode,
			shareMode: 'quick',
			mode,
			isOwner: false,
			error: s.error, // preserve any sync timeout error
		}));

		if (mode === 'collaborative') {
			startLocalSync();
		}
	} catch (e) {
		debug('Failed to join room:', e);
		lastKnownSession = null;
		peerState.update(s => ({
			...s,
			status: 'disconnected',
			error: e instanceof Error ? e.message : 'Failed to join room',
		}));
		throw e;
	}
}

// --- Private Connect ---

/**
 * HOST: Start a private sharing session.
 * Returns the offer code that must be shared with the guest.
 * Call completePrivateHost(answerCode) after receiving the guest's answer.
 */
export async function startPrivateHost(ownerName: string): Promise<string> {
	const currentSession = get(session);
	lastKnownSession = structuredClone(currentSession);
	syncGeneration = 0;
	lastProcessedGeneration = 0;

	peerState.update(s => ({ ...s, status: 'connecting', shareMode: 'private', error: null }));

	try {
		debug('Creating private offer...');
		const { offerCode, iceResult, waitForAnswer, cancel } = await createPrivateOffer();
		privateCancelFn = cancel;

		// Store the pending offer so completePrivateHost can use it
		pendingHostOffer = { waitForAnswer, cancel };

		// Build diagnostics from ICE gathering
		const diag: ConnectionDiagnostics = {
			...EMPTY_DIAGNOSTICS,
			ice: iceResult,
		};

		// Warn if TURN was configured but no relay candidates
		if (iceResult.relayCandidates === 0) {
			diag.failureReason = 'No TURN relay candidates — cross-network connections may fail';
		}

		// Stay in 'connecting' — UI uses privateOfferCode to show code exchange.
		// Status moves to 'hosting' only after completePrivateHost succeeds.
		peerState.update(s => ({
			...s,
			status: 'connecting',
			shareMode: 'private',
			privateOfferCode: offerCode,
			isOwner: true,
			mode: 'collaborative',
			error: null,
			peers: [{ id: 0, name: ownerName, isOwner: true }],
			diagnostics: diag,
		}));

		debug('Private offer created, code length:', offerCode.length);
		return offerCode;
	} catch (e) {
		debug('Failed to create private offer:', e);
		lastKnownSession = null;
		peerState.update(s => ({
			...s,
			status: 'disconnected',
			error: e instanceof Error ? e.message : 'Failed to create private offer',
		}));
		throw e;
	}
}

/** HOST: Complete the private handshake with the guest's answer code */
export async function completePrivateHost(answerCode: string, ownerName: string): Promise<void> {
	if (!pendingHostOffer) {
		throw new Error('No pending private offer — create an invite first');
	}

	peerState.update(s => ({ ...s, status: 'connecting', error: null }));

	try {
		debug('Completing private handshake with answer code...');
		const conn = await pendingHostOffer.waitForAnswer(answerCode);
		pendingHostOffer = null;
		privateCancelFn = null;

		privateConnection = conn;
		setupPrivateSync(ownerName, true);
		activeMode = 'private';

		debug('Private connection established (host)!');
	} catch (e) {
		debug('Failed to complete private handshake:', e);
		// Clean up stale offer on error
		pendingHostOffer = null;
		peerState.update(s => ({
			...s,
			status: 'disconnected',
			error: e instanceof Error ? e.message : 'Failed to connect',
		}));
		throw e;
	}
}

/**
 * GUEST: Accept a private offer and generate an answer code.
 *
 * Phase 1 (this function): Generate answer code from the offer. Returns quickly (~5s for ICE).
 * Phase 2 (background): Wait for host to enter answer code → data channel opens → sync starts.
 *
 * The caller gets the answer code to display immediately. Connection completion
 * happens in the background and updates peerState when done.
 */
export async function joinPrivateOffer(offerCode: string, guestName: string): Promise<string> {
	lastKnownSession = structuredClone(get(session));
	syncGeneration = 0;
	lastProcessedGeneration = 0;

	peerState.update(s => ({ ...s, status: 'connecting', shareMode: 'private', error: null }));

	// Phase 1: Generate answer code (fast — just SDP exchange + ICE gathering)
	debug('Accepting private offer...');
	const { answerCode, iceResult, waitForConnection, cancel } = await acceptPrivateOffer(offerCode);
	privateCancelFn = cancel;

	const diag: ConnectionDiagnostics = {
		...EMPTY_DIAGNOSTICS,
		ice: iceResult,
	};
	if (iceResult.relayCandidates === 0) {
		diag.failureReason = 'No TURN relay candidates — cross-network connections may fail';
	}

	peerState.update(s => ({
		...s,
		status: 'connecting',
		shareMode: 'private',
		privateAnswerCode: answerCode,
		isOwner: false,
		mode: 'collaborative',
		error: null,
		diagnostics: diag,
	}));

	debug('Answer code generated:', answerCode.length, 'chars. Waiting for host in background...');

	// Phase 2: Wait for connection in background (no timeout — user cancels manually)
	waitForConnection().then((conn) => {
		privateCancelFn = null;
		privateConnection = conn;
		setupPrivateSync(guestName, false);
		activeMode = 'private';
		debug('Private connection established (guest)!');
	}).catch((e) => {
		debug('Private connection failed (guest):', e);
		lastKnownSession = null;
		peerState.update(s => ({
			...s,
			status: 'disconnected',
			error: e instanceof Error ? e.message : 'Connection failed',
		}));
	});

	return answerCode;
}

/** Set up Y.js sync over the private data channel */
function setupPrivateSync(localName: string, isOwner: boolean): void {
	if (!privateConnection) return;

	const currentSession = get(session);
	const doc = createYDoc(currentSession);
	privateDoc = doc;

	// Create Y.js provider over the data channel
	privateProvider = new DataChannelProvider(doc, privateConnection.channel);

	// Observe remote changes
	privateUnobserve = observeYDoc(doc, handleRemoteChange);

	// Track connection state
	privateConnection.channel.addEventListener('close', () => {
		debug('Private data channel closed');
		stopSharing();
	});

	// Update peer state
	const peerList: PeerInfo[] = [
		{ id: 0, name: localName, isOwner },
		{ id: 1, name: isOwner ? 'Partner' : 'Host', isOwner: !isOwner },
	];

	peerState.update(s => ({
		...s,
		status: isOwner ? 'hosting' : 'joined',
		shareMode: 'private',
		mode: 'collaborative',
		peers: peerList,
		error: null,
	}));

	// Start syncing local changes to Y.Doc
	startLocalSync();
}

// --- Shared ---

/** Stop sharing and disconnect (works for all modes) */
export function stopSharing(): void {
	debug('Stopping sharing, mode:', activeMode);
	stopLocalSync();

	if (activeMode === 'quick') {
		leaveQuickRoom();
	} else if (activeMode === 'quick-http') {
		if (httpCleanupFn) {
			httpCleanupFn();
			httpCleanupFn = null;
		}
		leaveHttpRoom();
	} else if (activeMode === 'private') {
		cleanupPrivate();
	}

	// Cancel any pending offer/answer
	if (privateCancelFn) {
		privateCancelFn();
		privateCancelFn = null;
	}
	pendingHostOffer = null;

	lastKnownSession = null;
	syncGeneration = 0;
	lastProcessedGeneration = 0;
	activeMode = null;

	peerState.set({
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
	});
}

function cleanupPrivate(): void {
	if (privateUnobserve) {
		privateUnobserve();
		privateUnobserve = null;
	}
	if (privateProvider) {
		privateProvider.destroy();
		privateProvider = null;
	}
	if (privateDoc) {
		privateDoc.destroy();
		privateDoc = null;
	}
	if (privateConnection) {
		privateConnection.cleanup();
		privateConnection = null;
	}
}

/** Get a shareable URL for the current room (Quick mode only) */
export function getShareUrl(): string | null {
	const state = get(peerState);
	if (!state.roomCode) return null;
	return getRoomUrl(state.roomCode);
}

/** Get the private offer URL for sharing */
export function getPrivateOfferUrl(offerCode: string): string {
	const base = typeof window !== 'undefined'
		? window.location.origin
		: 'https://contractions.app';
	return `${base}/?offer=${encodeURIComponent(offerCode)}`;
}

/** Get the private answer URL for sharing (enables QR back-and-forth) */
export function getPrivateAnswerUrl(answerCode: string): string {
	const base = typeof window !== 'undefined'
		? window.location.origin
		: 'https://contractions.app';
	return `${base}/?answer=${encodeURIComponent(answerCode)}`;
}

// --- Internal ---

function handleRemoteChange(remoteSession: SessionData): void {
	syncGeneration++;
	debug('Remote change received, generation:', syncGeneration);
	lastKnownSession = structuredClone(remoteSession);
	session.set(remoteSession);
}

function handlePeersChange(peers: PeerInfo[]): void {
	debug('Peers changed:', peers.length);
	peerState.update(s => ({ ...s, peers }));
}

function pushLocalChangesToDoc(oldSession: SessionData, newSession: SessionData): void {
	if (activeMode === 'quick') {
		pushQuickChanges(oldSession, newSession);
	} else if (activeMode === 'quick-http') {
		pushHttpLocalChanges(oldSession, newSession);
	} else if (activeMode === 'private' && privateDoc) {
		applySessionDelta(privateDoc, oldSession, newSession);
	}
}

function startLocalSync(): void {
	stopLocalSync();

	debug('Starting local sync, lastKnownSession initialized:', !!lastKnownSession);

	unsubscribeSession = session.subscribe((newSession) => {
		if (syncGeneration !== lastProcessedGeneration) {
			lastProcessedGeneration = syncGeneration;
			debug('Skipping local sync (remote-originated, gen:', syncGeneration, ')');
			return;
		}

		if (!lastKnownSession) {
			debug('WARNING: lastKnownSession is null in subscriber');
			lastKnownSession = structuredClone(newSession);
			return;
		}

		const oldJson = JSON.stringify(lastKnownSession);
		const newJson = JSON.stringify(newSession);
		if (oldJson === newJson) return;

		debug('Local change detected, pushing to Y.Doc');
		pushLocalChangesToDoc(lastKnownSession, newSession);
		lastKnownSession = structuredClone(newSession);
	});
}

function stopLocalSync(): void {
	if (unsubscribeSession) {
		unsubscribeSession();
		unsubscribeSession = null;
	}
}
