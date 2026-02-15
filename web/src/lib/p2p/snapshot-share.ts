/**
 * Snapshot Share — compress session data into shareable links, codes, and text.
 *
 * Four sharing methods:
 * 1. URL hash fragment: contractions.app/#snapshot=COMPRESSED
 * 2. Copy-paste text: raw compressed string
 * 3. Relay short code: POST to ntfy.sh/CF Worker → "blue-tiger-42"
 * 4. QR code: encode URL into QR (small sessions only)
 *
 * Compression: JSON → deflate (browser CompressionStream) → base64url
 * Hash fragments never leave the browser — privacy preserved.
 */

import type { SessionData, ContractionTimerSettings, SharingCategory } from '../labor-logic/types';
import { generateRoomCode, isValidRoomCode } from './room-codes';
import { encodeSessionV2, decodeSessionV2, detectIncludedCategories } from './compact-codec';

function debug(...args: unknown[]) { console.debug('[snapshot]', ...args); }

const SNAPSHOT_ORIGIN = 'https://contractions.app';

// --- Base64url helpers (same pattern as sdp-compress.ts) ---

function toBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64url: string): Uint8Array {
	let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
	while (b64.length % 4) b64 += '=';
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

// --- Core compression ---

/**
 * Compress a session into a base64url string.
 * Uses v2 compact encoding + browser-native CompressionStream (deflate).
 */
export async function compressSession(
	session: SessionData,
	sharedSettings?: Partial<ContractionTimerSettings>,
): Promise<string> {
	const compact = encodeSessionV2(session, sharedSettings);
	const json = JSON.stringify(compact);
	const raw = new TextEncoder().encode(json);

	const cs = new CompressionStream('deflate');
	const writer = cs.writable.getWriter();
	const reader = cs.readable.getReader();

	writer.write(raw);
	writer.close();

	const chunks: Uint8Array[] = [];
	let totalLength = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		totalLength += value.length;
	}

	const compressed = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		compressed.set(chunk, offset);
		offset += chunk.length;
	}

	const encoded = toBase64Url(compressed);
	debug('Compressed:', raw.length, 'bytes →', compressed.length, 'bytes →', encoded.length, 'chars');
	return encoded;
}

/** Result of decompressing a snapshot — may include shared settings (v2) */
export interface DecompressedSnapshot {
	session: SessionData;
	sharedSettings?: Partial<ContractionTimerSettings>;
	version: 1 | 2;
}

/**
 * Decompress a base64url string back into session data.
 * Handles both v1 (raw SessionData JSON) and v2 (compact format).
 */
export async function decompressSession(code: string): Promise<DecompressedSnapshot> {
	const compressed = fromBase64Url(code);

	const ds = new DecompressionStream('deflate');
	const writer = ds.writable.getWriter();
	const reader = ds.readable.getReader();

	writer.write(compressed);
	writer.close();

	const chunks: Uint8Array[] = [];
	let totalLength = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		totalLength += value.length;
	}

	const raw = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		raw.set(chunk, offset);
		offset += chunk.length;
	}

	const json = new TextDecoder().decode(raw);
	debug('Decompressed:', code.length, 'chars →', raw.length, 'bytes');
	const parsed = JSON.parse(json);

	// v2 compact format
	if (parsed.v === 2) {
		const decoded = decodeSessionV2(parsed);
		return { session: decoded.session, sharedSettings: decoded.sharedSettings, version: 2 };
	}

	// v1 fallback: raw SessionData
	return { session: parsed as SessionData, version: 1 };
}

// --- URL generation ---

/** Generate a shareable snapshot URL */
export function generateSnapshotUrl(code: string): string {
	return `${SNAPSHOT_ORIGIN}/#snapshot=${code}`;
}

/** Extract snapshot code from a URL, short code, or raw compressed string */
export function extractSnapshotCode(input: string): { type: 'url' | 'shortcode' | 'raw'; code: string } | null {
	const trimmed = input.trim();

	// Check for URL with #snapshot=
	const hashMatch = trimmed.match(/#snapshot=([A-Za-z0-9_-]+)/);
	if (hashMatch) {
		return { type: 'url', code: hashMatch[1] };
	}

	// Check for short code (adjective-noun-number)
	if (isValidRoomCode(trimmed)) {
		return { type: 'shortcode', code: trimmed };
	}

	// Check for raw base64url data (only alphanumeric + _ -)
	if (/^[A-Za-z0-9_-]{20,}$/.test(trimmed)) {
		return { type: 'raw', code: trimmed };
	}

	return null;
}

// --- Relay-based short code ---

/** Derive a routing key from a short code (same pattern as http-signaling.ts) */
async function shortCodeToRoutingKey(shortCode: string): Promise<string> {
	const data = new TextEncoder().encode(`snapshot:${shortCode}`);
	const hash = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * POST snapshot data to a relay server.
 * Returns a human-readable short code like "blue-tiger-42".
 * Code expires on the relay in 5 minutes.
 */
export async function postSnapshotToRelay(
	compressedData: string,
	relayUrl: string,
): Promise<string> {
	const shortCode = generateRoomCode();
	const routingKey = await shortCodeToRoutingKey(shortCode);

	const url = `${relayUrl}/room/${routingKey}/snapshot`;
	const res = await fetch(url, {
		method: 'PUT',
		body: compressedData,
		headers: { 'Content-Type': 'text/plain' },
	});

	if (!res.ok) {
		throw new Error(`Relay POST failed: ${res.status} ${res.statusText}`);
	}

	debug('Posted snapshot to relay:', shortCode, '→', routingKey.slice(0, 8) + '...');
	return shortCode;
}

/**
 * GET snapshot data from a relay server using a short code.
 * Returns the compressed data string.
 */
export async function getSnapshotFromRelay(
	shortCode: string,
	relayUrl: string,
): Promise<string> {
	const routingKey = await shortCodeToRoutingKey(shortCode);

	const url = `${relayUrl}/room/${routingKey}/snapshot`;
	const res = await fetch(url);

	if (res.status === 404) {
		throw new Error('Snapshot not found — it may have expired (5 minute limit)');
	}
	if (!res.ok) {
		throw new Error(`Relay GET failed: ${res.status} ${res.statusText}`);
	}

	const data = await res.text();
	debug('Got snapshot from relay:', shortCode, '→', data.length, 'chars');
	return data;
}

// --- QR support ---

/** Check if compressed data is small enough for a QR code (~2KB limit) */
export function isQRCompatible(code: string): boolean {
	// QR version 40, Low ECC: ~2953 alphanumeric chars
	// Full URL adds ~40 chars for "https://contractions.app/#snapshot="
	return (code.length + 40) < 2900;
}

// --- Preview ---

export interface SnapshotPreview {
	contractionCount: number;
	completedCount: number;
	eventCount: number;
	timeRange: string | null; // "2:30 PM - 5:15 PM" or null if empty
	sessionStarted: string | null;
	/** Settings categories included in the snapshot (v2 only) */
	includedCategories: SharingCategory[];
}

/** Generate a human-readable preview of a session snapshot */
export function previewSnapshot(
	session: SessionData,
	sharedSettings?: Partial<ContractionTimerSettings>,
): SnapshotPreview {
	const completed = session.contractions.filter(c => c.end !== null);
	const allTimes = session.contractions.map(c => new Date(c.start).getTime()).filter(t => !isNaN(t));

	let timeRange: string | null = null;
	if (allTimes.length >= 2) {
		const earliest = new Date(Math.min(...allTimes));
		const latest = new Date(Math.max(...allTimes));
		const fmt = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
		timeRange = `${fmt(earliest)} — ${fmt(latest)}`;
	}

	return {
		contractionCount: session.contractions.length,
		completedCount: completed.length,
		eventCount: session.events.length,
		timeRange,
		sessionStarted: session.sessionStartedAt,
		includedCategories: sharedSettings ? detectIncludedCategories(sharedSettings) : [],
	};
}
