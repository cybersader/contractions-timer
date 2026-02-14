/**
 * Quick Connect: P2P connection manager using y-webrtc.
 * Uses a signaling server + optional STUN for easy one-code connection.
 * Less private than Private Connect (contacts third-party servers).
 */

import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { generateRoomCode } from './room-codes';
import { createYDoc, yDocToSession, applySessionDelta, observeYDoc } from './ydoc';
import { deriveKey } from './encryption';
import { buildPeerOpts } from './ice-config';
import type { SessionData } from '../labor-logic/types';

// Always log — P2P events are infrequent and critical for debugging
function debug(...args: unknown[]) { console.debug('[quick-connect]', ...args); }

export interface RoomConfig {
	roomCode: string;
	password?: string;
	mode: 'collaborative' | 'view-only';
	ownerName: string;
}

export interface PeerInfo {
	id: number;
	name: string;
	isOwner: boolean;
}

export interface P2PConnection {
	doc: Y.Doc;
	provider: WebrtcProvider;
	roomConfig: RoomConfig;
	encryptionKey: CryptoKey | null;
	cleanup: () => void;
	/** Resolves when Y.js sync completes with a peer, rejects on timeout */
	waitForSync: () => Promise<void>;
}

/** Signaling transport type */
export type SignalingType = 'http' | 'websocket';

/** Signaling server presets */
export interface SignalingPreset {
	label: string;
	url: string;
	type: SignalingType;
	description: string;
}

export const SIGNALING_PRESETS: SignalingPreset[] = [
	{ label: 'ntfy.sh (no setup)', url: 'https://ntfy.sh', type: 'http', description: 'Public relay. SDP encrypted client-side. No account needed.' },
	{ label: 'My Cloudflare Worker', url: '', type: 'http', description: 'Your own relay on Cloudflare Workers. Most reliable option.' },
	{ label: 'Self-hosted (WebSocket)', url: 'ws://localhost:4444', type: 'websocket', description: 'y-webrtc signaling server. Deploy via Docker or run locally.' },
	{ label: 'Custom', url: '', type: 'websocket', description: 'Enter your own signaling server URL.' },
];

// Signaling prefix to avoid room collisions with other apps
const ROOM_PREFIX = 'ct-';

let activeConnection: P2PConnection | null = null;

/** Get the currently active connection, if any */
export function getConnection(): P2PConnection | null {
	return activeConnection;
}

/** Create and host a room with the current session data */
export async function createRoom(
	sessionData: SessionData,
	config: Omit<RoomConfig, 'roomCode'> & { roomCode?: string },
	onRemoteChange: (data: SessionData) => void,
	onPeersChange: (peers: PeerInfo[]) => void
): Promise<P2PConnection> {
	if (activeConnection) {
		leaveRoom();
	}

	const roomCode = config.roomCode || generateRoomCode();
	const fullConfig: RoomConfig = { ...config, roomCode };

	debug('Creating room:', roomCode, 'mode:', fullConfig.mode);

	const doc = createYDoc(sessionData);

	// Store room config in the Y.Doc so joiners know the mode
	const roomMeta = doc.getMap('roomConfig');
	doc.transact(() => {
		roomMeta.set('mode', fullConfig.mode);
		roomMeta.set('ownerName', fullConfig.ownerName);
	});

	const encryptionKey = fullConfig.password
		? await deriveKey(fullConfig.password, roomCode)
		: null;

	const signalingUrl = getStoredSignalingUrl();
	debug('Signaling server:', signalingUrl);

	const peerOpts = await buildPeerOpts();
	debug('ICE config:', JSON.stringify(peerOpts));

	const provider = new WebrtcProvider(ROOM_PREFIX + roomCode, doc, {
		signaling: [signalingUrl],
		password: fullConfig.password || undefined,
		peerOpts,
	});

	// Set awareness (presence)
	provider.awareness.setLocalStateField('user', {
		name: fullConfig.ownerName,
		isOwner: true,
	});

	// Emit initial peer list (includes self immediately)
	const initialPeers = getPeersFromAwareness(provider);
	debug('Initial peers (self):', initialPeers.length);
	onPeersChange(initialPeers);

	// Watch for remote changes
	const unobserve = observeYDoc(doc, (data) => {
		debug('Remote Y.Doc change observed');
		onRemoteChange(data);
	});

	// Watch for peer changes
	const awarenessHandler = () => {
		const peers = getPeersFromAwareness(provider);
		debug('Awareness change, peers:', peers.length, peers.map(p => p.name));
		onPeersChange(peers);
	};
	provider.awareness.on('change', awarenessHandler);

	// Sync tracking — resolves when Y.js sync completes with a peer
	let syncResolved = false;
	const syncPromise = new Promise<void>((resolve) => {
		const handler = (ev: { synced: boolean }) => {
			if (ev.synced && !syncResolved) {
				syncResolved = true;
				debug('Provider synced!');
				resolve();
			}
		};
		provider.on('synced', handler);
		// Also check if already synced
		if ((provider as any).synced) {
			syncResolved = true;
			debug('Provider already synced');
			resolve();
		}
	});

	const waitForSync = (): Promise<void> => {
		return Promise.race([
			syncPromise,
			new Promise<void>((_, reject) =>
				setTimeout(() => reject(new Error('Sync timed out — peer may not be connected yet')), 15000)
			),
		]);
	};

	const cleanup = () => {
		debug('Cleaning up room:', roomCode);
		unobserve();
		provider.awareness.off('change', awarenessHandler);
		provider.disconnect();
		provider.destroy();
		doc.destroy();
	};

	activeConnection = {
		doc,
		provider,
		roomConfig: fullConfig,
		encryptionKey,
		cleanup,
		waitForSync,
	};

	return activeConnection;
}

/** Join an existing room as a guest */
export async function joinRoom(
	roomCode: string,
	guestName: string,
	password?: string,
	onRemoteChange?: (data: SessionData) => void,
	onPeersChange?: (peers: PeerInfo[]) => void
): Promise<P2PConnection> {
	if (activeConnection) {
		leaveRoom();
	}

	debug('Joining room:', roomCode, 'as:', guestName);

	const doc = new Y.Doc();

	const encryptionKey = password
		? await deriveKey(password, roomCode)
		: null;

	const signalingUrl = getStoredSignalingUrl();
	debug('Signaling server:', signalingUrl);

	const peerOpts = await buildPeerOpts();
	debug('ICE config:', JSON.stringify(peerOpts));

	const provider = new WebrtcProvider(ROOM_PREFIX + roomCode, doc, {
		signaling: [signalingUrl],
		password: password || undefined,
		peerOpts,
	});

	// Set awareness
	provider.awareness.setLocalStateField('user', {
		name: guestName,
		isOwner: false,
	});

	const cleanupCallbacks: (() => void)[] = [];

	if (onRemoteChange) {
		const unobserve = observeYDoc(doc, (data) => {
			debug('Remote Y.Doc change observed (guest)');
			onRemoteChange(data);
		});
		cleanupCallbacks.push(unobserve);
	}

	if (onPeersChange) {
		// Emit initial peer list
		const initialPeers = getPeersFromAwareness(provider);
		debug('Initial peers (guest self):', initialPeers.length);
		onPeersChange(initialPeers);

		const awarenessHandler = () => {
			const peers = getPeersFromAwareness(provider);
			debug('Awareness change (guest), peers:', peers.length, peers.map(p => p.name));
			onPeersChange(peers);
		};
		provider.awareness.on('change', awarenessHandler);
		cleanupCallbacks.push(() => provider.awareness.off('change', awarenessHandler));
	}

	// Sync tracking
	let syncResolved = false;
	const syncPromise = new Promise<void>((resolve) => {
		const handler = (ev: { synced: boolean }) => {
			if (ev.synced && !syncResolved) {
				syncResolved = true;
				debug('Provider synced (guest)!');
				resolve();
			}
		};
		provider.on('synced', handler);
		if ((provider as any).synced) {
			syncResolved = true;
			debug('Provider already synced (guest)');
			resolve();
		}
	});

	const waitForSync = (): Promise<void> => {
		return Promise.race([
			syncPromise,
			new Promise<void>((_, reject) =>
				setTimeout(() => reject(new Error('Sync timed out — host may not be connected')), 15000)
			),
		]);
	};

	const config: RoomConfig = {
		roomCode,
		password,
		mode: 'collaborative',
		ownerName: '',
	};

	const cleanup = () => {
		debug('Cleaning up guest connection:', roomCode);
		for (const cb of cleanupCallbacks) cb();
		provider.disconnect();
		provider.destroy();
		doc.destroy();
	};

	activeConnection = {
		doc,
		provider,
		roomConfig: config,
		encryptionKey,
		cleanup,
		waitForSync,
	};

	return activeConnection;
}

/** Disconnect from the current room */
export function leaveRoom(): void {
	if (activeConnection) {
		activeConnection.cleanup();
		activeConnection = null;
	}
}

/** Apply local session changes to the Y.Doc for broadcast */
export function pushLocalChanges(
	oldSession: SessionData,
	newSession: SessionData
): void {
	if (!activeConnection) return;
	applySessionDelta(activeConnection.doc, oldSession, newSession);
}

/** Get current session data from the Y.Doc */
export function getRemoteSession(): SessionData | null {
	if (!activeConnection) return null;
	return yDocToSession(activeConnection.doc);
}

/** Build a shareable URL for the current room */
export function getRoomUrl(roomCode: string, password?: string): string {
	const base = typeof window !== 'undefined'
		? window.location.origin
		: 'https://contractions.app';
	let url = `${base}/?room=${encodeURIComponent(roomCode)}`;
	if (password) {
		url += `#key=${encodeURIComponent(password)}`;
	}
	return url;
}

/** Get the room mode from a joined room's Y.Doc */
export function getRoomMode(connection: P2PConnection): 'collaborative' | 'view-only' {
	const roomMeta = connection.doc.getMap('roomConfig');
	return (roomMeta.get('mode') as 'collaborative' | 'view-only') ?? 'collaborative';
}

// --- Settings persistence ---

const SIGNALING_KEY = 'ct-signaling-url';

/** Known-dead signaling servers — auto-migrate to default if stored */
const DEAD_SIGNALING_URLS = ['wss://signaling.yjs.dev'];

export function getStoredSignalingUrl(): string {
	if (typeof localStorage === 'undefined') return SIGNALING_PRESETS[0].url;
	const stored = localStorage.getItem(SIGNALING_KEY);
	if (!stored || DEAD_SIGNALING_URLS.includes(stored)) {
		return SIGNALING_PRESETS[0].url;
	}
	return stored;
}

export function setStoredSignalingUrl(url: string): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(SIGNALING_KEY, url);
}

/** Get the signaling type for the currently selected preset */
export function getSignalingType(): SignalingType {
	const url = getStoredSignalingUrl();
	const preset = SIGNALING_PRESETS.find(p => p.url === url);
	if (preset) return preset.type;
	// Heuristic: if it starts with ws:// or wss://, it's websocket
	if (url.startsWith('ws://') || url.startsWith('wss://')) return 'websocket';
	return 'http';
}

// --- Helpers ---

function getPeersFromAwareness(provider: WebrtcProvider): PeerInfo[] {
	const peers: PeerInfo[] = [];
	const states = provider.awareness.getStates();
	const localId = provider.awareness.clientID;

	states.forEach((state, clientId) => {
		const user = state.user as { name: string; isOwner: boolean } | undefined;
		if (user) {
			peers.push({
				id: clientId,
				name: user.name,
				isOwner: user.isOwner ?? false,
			});
		}
	});

	// Ensure self is always in the list even if awareness hasn't propagated yet
	if (!peers.some(p => p.id === localId)) {
		const localState = provider.awareness.getLocalState();
		const localUser = localState?.user as { name: string; isOwner: boolean } | undefined;
		if (localUser) {
			peers.unshift({
				id: localId,
				name: localUser.name,
				isOwner: localUser.isOwner ?? false,
			});
		}
	}

	return peers;
}
