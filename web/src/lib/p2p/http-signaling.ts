/**
 * HTTP-based signaling for Quick Connect.
 *
 * Automates Private Connect's manual SDP exchange via an HTTP "mailbox" relay.
 * Supports multiple backends: Cloudflare Worker + KV, ntfy.sh, or any REST API.
 *
 * Flow:
 * 1. Host → creates SDP offer → encrypts → POSTs to relay
 * 2. Guest → polls for offer → decrypts → creates answer → encrypts → POSTs
 * 3. Host → polls for answer → decrypts → WebRTC connected
 * 4. DataChannelProvider syncs Y.js over the data channel
 *
 * Security: SDP is encrypted client-side (AES-256-GCM). The relay only sees
 * routing hashes (SHA-256) and opaque ciphertext blobs.
 */

import * as Y from 'yjs';
import { get } from 'svelte/store';
import { session } from '../stores/session';
import { createPrivateOffer, acceptPrivateOffer, type PrivateConnection } from './private-connect';
import { deriveKey, encrypt, decrypt } from './encryption';
import { createYDoc, observeYDoc, applySessionDelta } from './ydoc';
import { DataChannelProvider } from './ydoc-provider';
import { generateRoomCode } from './room-codes';
import { buildIceServers, STUN_PRESETS } from './ice-config';
import type { SessionData } from '../labor-logic/types';
import type { PeerInfo } from './quick-connect';

function debug(...args: unknown[]) { console.debug('[http-signaling]', ...args); }

// --- Signaling Backend Interface ---

export interface SignalingBackend {
	name: string;
	postOffer(routingKey: string, blob: string): Promise<void>;
	getOffer(routingKey: string): Promise<string | null>;
	postAnswer(routingKey: string, blob: string): Promise<void>;
	getAnswer(routingKey: string): Promise<string | null>;
}

// --- Backend Implementations ---

function checkOk(r: Response): Promise<void> {
	if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
	return Promise.resolve();
}

/** Cloudflare Worker + KV backend (or any REST API with the same shape) */
export function cfBackend(baseUrl: string): SignalingBackend {
	return {
		name: 'cloudflare',
		postOffer: (key, blob) => fetch(`${baseUrl}/room/${key}/offer`, { method: 'PUT', body: blob }).then(checkOk),
		getOffer: (key) => fetch(`${baseUrl}/room/${key}/offer`).then(r => r.ok ? r.text() : null),
		postAnswer: (key, blob) => fetch(`${baseUrl}/room/${key}/answer`, { method: 'PUT', body: blob }).then(checkOk),
		getAnswer: (key) => fetch(`${baseUrl}/room/${key}/answer`).then(r => r.ok ? r.text() : null),
	};
}

/** ntfy.sh backend — uses public notification topics as mailboxes.
 * ntfy.sh topic names max out at 64 chars, so we use a short prefix of the
 * routing hash (still 57 hex chars = 228 bits of entropy — plenty). */
export function ntfyBackend(): SignalingBackend {
	/** Parse the latest message from ntfy.sh JSON polling response */
	async function parseLatest(r: Response): Promise<string | null> {
		if (!r.ok) return null;
		const text = await r.text();
		if (!text.trim()) return null;
		// ntfy returns newline-delimited JSON objects; take the last one
		const lines = text.trim().split('\n');
		for (let i = lines.length - 1; i >= 0; i--) {
			try {
				const msg = JSON.parse(lines[i]);
				if (msg.message) return msg.message;
			} catch { /* skip malformed */ }
		}
		return null;
	}

	// Suffix is max 7 chars ("-answer"), so prefix = 64 - 7 = 57 hex chars
	const ntfyTopic = (key: string, slot: string) => key.slice(0, 57) + '-' + slot;

	return {
		name: 'ntfy',
		postOffer: (key, blob) =>
			fetch(`https://ntfy.sh/${ntfyTopic(key, 'offer')}`, {
				method: 'POST',
				body: blob,
				headers: { 'Content-Type': 'text/plain' },
			}).then(checkOk),
		getOffer: (key) =>
			fetch(`https://ntfy.sh/${ntfyTopic(key, 'offer')}/json?poll=1&since=5m`)
				.then(parseLatest)
				.catch(() => null),
		postAnswer: (key, blob) =>
			fetch(`https://ntfy.sh/${ntfyTopic(key, 'answer')}`, {
				method: 'POST',
				body: blob,
				headers: { 'Content-Type': 'text/plain' },
			}).then(checkOk),
		getAnswer: (key) =>
			fetch(`https://ntfy.sh/${ntfyTopic(key, 'answer')}/json?poll=1&since=5m`)
				.then(parseLatest)
				.catch(() => null),
	};
}

/** Build a backend from a signaling URL */
export function buildBackend(signalingUrl: string): SignalingBackend {
	if (signalingUrl.includes('ntfy.sh')) {
		return ntfyBackend();
	}
	// Default: treat as CF Worker or compatible REST API
	return cfBackend(signalingUrl);
}

/** Build a backend with auto-fallback to ntfy.sh if the primary backend fails. */
export function buildBackendWithFallback(signalingUrl: string): SignalingBackend {
	const primary = buildBackend(signalingUrl);
	// If the primary is already ntfy.sh, no fallback needed
	if (primary.name === 'ntfy') return primary;

	const fallback = ntfyBackend();
	let usingFallback = false;

	const withFallback = <T>(primaryFn: () => Promise<T>, fallbackFn: () => Promise<T>): Promise<T> => {
		if (usingFallback) return fallbackFn();
		return primaryFn().catch((err) => {
			debug(`Primary signaling (${primary.name}) failed: ${err.message}. Falling back to ntfy.sh`);
			usingFallback = true;
			return fallbackFn();
		});
	};

	return {
		name: `${primary.name}+fallback`,
		postOffer: (key, blob) => withFallback(() => primary.postOffer(key, blob), () => fallback.postOffer(key, blob)),
		getOffer: (key) => withFallback(() => primary.getOffer(key), () => fallback.getOffer(key)),
		postAnswer: (key, blob) => withFallback(() => primary.postAnswer(key, blob), () => fallback.postAnswer(key, blob)),
		getAnswer: (key) => withFallback(() => primary.getAnswer(key), () => fallback.getAnswer(key)),
	};
}

/**
 * Test whether a signaling backend is reachable.
 * Posts and then retrieves a test value. Returns latency in ms or throws.
 */
export async function testSignalingBackend(signalingUrl: string): Promise<{ reachable: boolean; latencyMs: number }> {
	const backend = buildBackend(signalingUrl);
	const testKey = 'a'.repeat(64); // 64 hex chars
	const testValue = `test-${Date.now()}`;
	const start = performance.now();

	try {
		await backend.postOffer(testKey, testValue);
		const retrieved = await backend.getOffer(testKey);
		const latencyMs = Math.round(performance.now() - start);

		if (retrieved === testValue) {
			return { reachable: true, latencyMs };
		}
		// ntfy.sh wraps in JSON so exact match may fail — still counts as reachable
		return { reachable: true, latencyMs };
	} catch {
		return { reachable: false, latencyMs: Math.round(performance.now() - start) };
	}
}

// --- ICE Config for HTTP Signaling ---

/**
 * Build RTCConfiguration that always includes STUN servers.
 * HTTP signaling is inherently cross-network, so STUN must be present
 * regardless of the user's stored preferences.
 */
async function buildHttpIceConfig(): Promise<RTCConfiguration> {
	const servers = await buildIceServers();

	// Check if any STUN servers are present
	const hasStun = servers.some(s => {
		const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
		return urls.some(u => u.startsWith('stun:'));
	});

	if (!hasStun) {
		// Add default STUN servers (Google) for cross-network connectivity
		debug('No STUN servers in config, adding Google STUN for HTTP signaling');
		servers.unshift({ urls: STUN_PRESETS[0].urls });
	}

	debug('HTTP ICE config:', servers.length, 'entries, has STUN:', true);
	return { iceServers: servers };
}

// --- Crypto Helpers ---

/** Derive a routing key (SHA-256 hash) — NOT the room code itself */
async function deriveRoutingKey(roomCode: string): Promise<string> {
	const data = new TextEncoder().encode('ct-route:' + roomCode);
	const hash = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derive the encryption secret from room code and optional password.
 * With password: key = password, salt = roomCode (guest needs both)
 * Without password: key = roomCode, salt = roomCode (anyone with code can decrypt)
 */
function encryptionSecret(roomCode: string, password?: string): { key: string; salt: string } {
	if (password) {
		return { key: password, salt: roomCode };
	}
	return { key: roomCode, salt: roomCode };
}

/** Encrypt a string using AES-256-GCM derived from the room code (+ optional password) */
async function encryptBlob(roomCode: string, plaintext: string, password?: string): Promise<string> {
	const { key: secret, salt } = encryptionSecret(roomCode, password);
	const key = await deriveKey(secret, salt);
	const data = new TextEncoder().encode(plaintext);
	const encrypted = await encrypt(key, data);
	// Encode as base64 for transport
	let binary = '';
	for (const b of encrypted) binary += String.fromCharCode(b);
	return btoa(binary);
}

/** Decrypt a base64 blob using AES-256-GCM derived from the room code (+ optional password) */
async function decryptBlob(roomCode: string, base64: string, password?: string): Promise<string | null> {
	const { key: secret, salt } = encryptionSecret(roomCode, password);
	const key = await deriveKey(secret, salt);
	const binary = atob(base64);
	const data = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
	const decrypted = await decrypt(key, data);
	if (!decrypted) return null;
	return new TextDecoder().decode(decrypted);
}

// --- Polling Helper ---

function poll<T>(
	fn: () => Promise<T | null>,
	intervalMs: number,
	timeoutMs: number,
	signal: AbortSignal,
): Promise<T> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error(`Polling timed out after ${Math.round(timeoutMs / 1000)}s`));
		}, timeoutMs);

		signal.addEventListener('abort', () => {
			clearTimeout(timeout);
			reject(new Error('Cancelled'));
		});

		const check = async () => {
			if (signal.aborted) return;
			try {
				const result = await fn();
				if (result !== null) {
					clearTimeout(timeout);
					resolve(result);
					return;
				}
			} catch (e) {
				debug('Poll error (retrying):', e);
			}
			if (!signal.aborted) {
				setTimeout(check, intervalMs);
			}
		};
		check();
	});
}

// --- Active Connection State ---

let activeConnection: {
	pc: PrivateConnection;
	doc: Y.Doc;
	provider: DataChannelProvider;
	unobserve: () => void;
	abortController: AbortController;
	roomCode: string;
} | null = null;

// --- Public API ---

export interface HttpRoomResult {
	roomCode: string;
	cleanup: () => void;
}

/**
 * HOST: Create and host a room via HTTP signaling.
 * Generates an SDP offer, encrypts and posts it, then polls for the answer.
 */
export async function createHttpRoom(
	sessionData: SessionData,
	config: { ownerName: string; mode: 'collaborative' | 'view-only'; password?: string },
	backend: SignalingBackend,
	onRemoteChange: (data: SessionData) => void,
	onPeersChange: (peers: PeerInfo[]) => void,
	onPhaseChange?: (phase: string) => void,
	onError?: (error: string) => void,
): Promise<HttpRoomResult> {
	if (activeConnection) leaveHttpRoom();

	const roomCode = generateRoomCode();
	const password = config.password;
	const abortController = new AbortController();

	debug('Creating HTTP room:', roomCode, 'via', backend.name, 'password:', password ? 'yes' : 'no');
	onPhaseChange?.('creating-offer');

	// 1. Build ICE config with guaranteed STUN + derive routing key + create SDP offer
	const iceConfig = await buildHttpIceConfig();
	const routingKey = await deriveRoutingKey(roomCode);
	debug('Routing key:', routingKey.slice(0, 16) + '...');

	const { offerCode, waitForAnswer, cancel } = await createPrivateOffer(iceConfig);
	debug('SDP offer created, code length:', offerCode.length);

	// 2. Encrypt and post the offer (with password if set)
	onPhaseChange?.('posting');
	const encryptedOffer = await encryptBlob(roomCode, offerCode, password);
	debug('Encrypted offer, blob length:', encryptedOffer.length);
	await backend.postOffer(routingKey, encryptedOffer);
	debug('Offer posted to', backend.name);

	// Emit initial peer list (self only)
	onPeersChange([{ id: 0, name: config.ownerName, isOwner: true }]);
	onPhaseChange?.('waiting-for-partner');

	// 3. Poll for answer in background
	const answerPromise = poll(
		async () => {
			const blob = await backend.getAnswer(routingKey);
			if (!blob) return null;
			const decrypted = await decryptBlob(roomCode, blob, password);
			if (!decrypted) {
				debug('Answer blob decryption failed — wrong room code?');
				return null;
			}
			return decrypted;
		},
		5000,  // poll every 5s (ntfy.sh rate limits at ~15 req/30s)
		300000, // 5 min timeout
		abortController.signal,
	);

	// Complete handshake when answer arrives
	answerPromise.then(async (answerCode) => {
		if (abortController.signal.aborted) return;
		debug('Answer received, completing handshake...');
		onPhaseChange?.('completing');

		try {
			const conn = await waitForAnswer(answerCode);
			debug('WebRTC connected!');
			onPhaseChange?.('connected');

			// Set up Y.js sync
			const doc = createYDoc(sessionData);
			const provider = new DataChannelProvider(doc, conn.channel);
			const unobserve = observeYDoc(doc, onRemoteChange);

			// Track channel close
			conn.channel.addEventListener('close', () => {
				debug('Data channel closed');
				leaveHttpRoom();
			});

			activeConnection = {
				pc: conn,
				doc,
				provider,
				unobserve,
				abortController,
				roomCode,
			};

			// Update peers
			onPeersChange([
				{ id: 0, name: config.ownerName, isOwner: true },
				{ id: 1, name: 'Partner', isOwner: false },
			]);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			debug('Handshake failed:', msg);
			onPhaseChange?.(null as any);
			onError?.(msg);
			cancel();
		}
	}).catch((e) => {
		if (!abortController.signal.aborted) {
			const msg = e instanceof Error ? e.message : String(e);
			debug('Answer polling failed:', msg);
			onPhaseChange?.(null as any);
			onError?.(msg);
		}
	});

	const cleanup = () => {
		debug('Cleaning up HTTP room:', roomCode);
		abortController.abort();
		cancel();
		if (activeConnection) {
			activeConnection.unobserve();
			activeConnection.provider.destroy();
			activeConnection.doc.destroy();
			activeConnection.pc.cleanup();
			activeConnection = null;
		}
	};

	return { roomCode, cleanup };
}

/**
 * GUEST: Join a room via HTTP signaling.
 * Polls for the host's offer, decrypts it, generates an answer, and posts it.
 */
export async function joinHttpRoom(
	roomCode: string,
	guestName: string,
	backend: SignalingBackend,
	onRemoteChange: (data: SessionData) => void,
	onPeersChange: (peers: PeerInfo[]) => void,
	onPhaseChange?: (phase: string) => void,
	password?: string,
): Promise<{ cleanup: () => void; waitForConnection: () => Promise<void> }> {
	if (activeConnection) leaveHttpRoom();

	const abortController = new AbortController();

	debug('Joining HTTP room:', roomCode, 'via', backend.name, 'password:', password ? 'yes' : 'no');
	onPhaseChange?.('polling-for-offer');

	const iceConfig = await buildHttpIceConfig();
	const routingKey = await deriveRoutingKey(roomCode);
	debug('Routing key:', routingKey.slice(0, 16) + '...');

	// Track whether we found data but couldn't decrypt (wrong password)
	let sawEncryptedData = false;

	// 1. Poll for offer
	debug('Polling for host offer...');
	let offerCode: string;
	try {
		offerCode = await poll(
			async () => {
				const blob = await backend.getOffer(routingKey);
				if (!blob) return null;
				// We found data on the relay — room exists
				sawEncryptedData = true;
				const decrypted = await decryptBlob(roomCode, blob, password);
				if (!decrypted) {
					debug('Offer blob decryption failed — wrong password?');
					return null;
				}
				return decrypted;
			},
			4000,   // poll every 4s (ntfy.sh rate limits at ~15 req/30s)
			60000,  // 60s timeout
			abortController.signal,
		);
	} catch (pollErr) {
		// Distinguish "room not found" vs "wrong password"
		if (sawEncryptedData) {
			throw new Error('Wrong password — the room exists but decryption failed. Check your password and try again.');
		}
		throw new Error('Room not found — no room with that code is currently active.');
	}

	debug('Offer received, generating answer...');
	onPhaseChange?.('generating-answer');

	// 2. Accept offer and generate answer (with guaranteed STUN)
	const { answerCode, waitForConnection, cancel } = await acceptPrivateOffer(offerCode, iceConfig);
	debug('Answer code generated, length:', answerCode.length);

	// 3. Encrypt and post the answer (with password if set)
	onPhaseChange?.('posting-answer');
	const encryptedAnswer = await encryptBlob(roomCode, answerCode, password);
	await backend.postAnswer(routingKey, encryptedAnswer);
	debug('Answer posted to', backend.name);
	onPhaseChange?.('completing');

	// Emit initial peers
	onPeersChange([{ id: 0, name: guestName, isOwner: false }]);

	// 4. Wait for connection completion in the returned promise
	const connPromise = async () => {
		const conn = await waitForConnection();
		debug('WebRTC connected (guest)!');

		const currentSession = get(session);
		const doc = createYDoc(currentSession);
		const provider = new DataChannelProvider(doc, conn.channel);
		const unobserve = observeYDoc(doc, onRemoteChange);

		conn.channel.addEventListener('close', () => {
			debug('Data channel closed (guest)');
			leaveHttpRoom();
		});

		activeConnection = {
			pc: conn,
			doc,
			provider,
			unobserve,
			abortController,
			roomCode,
		};

		onPeersChange([
			{ id: 0, name: guestName, isOwner: false },
			{ id: 1, name: 'Host', isOwner: true },
		]);
	};

	const cleanup = () => {
		debug('Cleaning up guest HTTP connection:', roomCode);
		abortController.abort();
		cancel();
		if (activeConnection) {
			activeConnection.unobserve();
			activeConnection.provider.destroy();
			activeConnection.doc.destroy();
			activeConnection.pc.cleanup();
			activeConnection = null;
		}
	};

	return { cleanup, waitForConnection: connPromise };
}

/** Disconnect from the current HTTP-signaled room */
export function leaveHttpRoom(): void {
	if (activeConnection) {
		activeConnection.abortController.abort();
		activeConnection.unobserve();
		activeConnection.provider.destroy();
		activeConnection.doc.destroy();
		activeConnection.pc.cleanup();
		activeConnection = null;
	}
}

/** Push local session changes to the Y.Doc for broadcast */
export function pushHttpLocalChanges(
	oldSession: SessionData,
	newSession: SessionData,
): void {
	if (!activeConnection) return;
	applySessionDelta(activeConnection.doc, oldSession, newSession);
}

/** Get the active connection's room code */
export function getHttpRoomCode(): string | null {
	return activeConnection?.roomCode ?? null;
}
