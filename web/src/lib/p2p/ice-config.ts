/**
 * Shared ICE configuration for both Quick Connect and Private Connect.
 *
 * Single source of truth for STUN/TURN server presets, credential generation,
 * and localStorage persistence. Both connection modes import from here.
 */

function debug(...args: unknown[]) { console.debug('[ice-config]', ...args); }

// --- STUN Presets (moved from quick-connect.ts) ---

export interface StunPreset {
	label: string;
	urls: string[];
	description: string;
}

export const STUN_PRESETS: StunPreset[] = [
	{ label: 'Google (default)', urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'], description: 'Google STUN — reliable, Google sees your IP only' },
	{ label: 'Cloudflare', urls: ['stun:stun.cloudflare.com:3478'], description: 'Cloudflare STUN — privacy-focused alternative' },
	{ label: 'None (LAN only)', urls: [], description: 'No STUN — only works on same WiFi network' },
	{ label: 'Custom', urls: [], description: 'Enter your own STUN server URL' },
];

// --- TURN Presets ---

export interface TurnPreset {
	label: string;
	description: string;
}

export const TURN_PRESETS: TurnPreset[] = [
	{ label: 'Open Relay (default)', description: 'Free TURN relay, no account needed. Relays encrypted data only.' },
	{ label: 'Cloudflare TURN', description: 'Your own Cloudflare Calls TURN relay. Reliable, fast, pay-as-you-go.' },
	{ label: 'None', description: 'STUN only — may fail on restrictive networks or different carriers.' },
	{ label: 'Custom', description: 'Enter your own TURN server URL and credentials.' },
];

// --- localStorage Keys ---

const STUN_KEY = 'ct-stun-preset';
const TURN_KEY = 'ct-turn-preset';
const CUSTOM_STUN_KEY = 'ct-custom-stun-url';
const CUSTOM_TURN_KEY = 'ct-custom-turn-config';

// --- STUN Persistence ---

export function getStoredStunPreset(): string {
	if (typeof localStorage === 'undefined') return 'Google (default)';
	return localStorage.getItem(STUN_KEY) || 'Google (default)';
}

export function setStoredStunPreset(label: string): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(STUN_KEY, label);
}

export function getStoredCustomStunUrl(): string {
	if (typeof localStorage === 'undefined') return '';
	return localStorage.getItem(CUSTOM_STUN_KEY) || '';
}

export function setStoredCustomStunUrl(url: string): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(CUSTOM_STUN_KEY, url);
}

// --- TURN Persistence ---

export function getStoredTurnPreset(): string {
	if (typeof localStorage === 'undefined') return 'Open Relay (default)';
	return localStorage.getItem(TURN_KEY) || 'Open Relay (default)';
}

export function setStoredTurnPreset(label: string): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(TURN_KEY, label);
}

export interface CustomTurnConfig {
	url: string;
	username: string;
	credential: string;
}

export function getStoredCustomTurnConfig(): CustomTurnConfig {
	if (typeof localStorage === 'undefined') return { url: '', username: '', credential: '' };
	try {
		const raw = localStorage.getItem(CUSTOM_TURN_KEY);
		if (!raw) return { url: '', username: '', credential: '' };
		return JSON.parse(raw);
	} catch {
		return { url: '', username: '', credential: '' };
	}
}

export function setStoredCustomTurnConfig(config: CustomTurnConfig): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(CUSTOM_TURN_KEY, JSON.stringify(config));
}

// --- Open Relay HMAC Credential Generation ---

/**
 * Generate time-limited TURN credentials for Open Relay (staticauth.openrelay.metered.ca).
 * Uses coturn's REST API auth with HMAC-SHA1 via WebCrypto.
 * The secret is public (this is by design for the open relay project).
 */
async function generateOpenRelayCredentials(): Promise<{ username: string; credential: string }> {
	const secret = 'openrelayprojectsecret';
	const ttl = 24 * 60 * 60; // 24 hours
	const timestamp = Math.floor(Date.now() / 1000) + ttl;
	const username = `${timestamp}:openrelayproject`;

	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-1' },
		false,
		['sign'],
	);
	const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(username));
	const credential = btoa(String.fromCharCode(...new Uint8Array(sig)));

	return { username, credential };
}

// --- Build ICE Servers ---

/**
 * Build the full RTCIceServer[] array from stored preferences.
 * Called at connection time (async because HMAC generation is async).
 */
export async function buildIceServers(): Promise<RTCIceServer[]> {
	const servers: RTCIceServer[] = [];

	// 1. STUN servers
	const stunLabel = getStoredStunPreset();
	if (stunLabel === 'Custom') {
		const customUrl = getStoredCustomStunUrl();
		if (customUrl) {
			servers.push({ urls: [customUrl] });
		}
	} else {
		const preset = STUN_PRESETS.find(p => p.label === stunLabel);
		if (preset && preset.urls.length > 0) {
			servers.push({ urls: preset.urls });
		}
	}

	// 2. TURN servers
	const turnLabel = getStoredTurnPreset();

	if (turnLabel === 'Open Relay (default)') {
		// metered.ca Open Relay — free 20GB/month, no signup needed.
		// Uses separate entries per URL (better browser compatibility).
		// Docs: https://www.metered.ca/tools/openrelay/
		servers.push(
			{
				urls: 'turn:openrelay.metered.ca:80',
				username: 'openrelayproject',
				credential: 'openrelayproject',
			},
			{
				urls: 'turn:openrelay.metered.ca:443',
				username: 'openrelayproject',
				credential: 'openrelayproject',
			},
			{
				urls: 'turn:openrelay.metered.ca:443?transport=tcp',
				username: 'openrelayproject',
				credential: 'openrelayproject',
			},
		);
		// Fallback: freestun.net
		servers.push({
			urls: 'turn:freestun.net:3478',
			username: 'free',
			credential: 'free',
		});
		debug('Open Relay TURN servers added (4 entries)');
	} else if (turnLabel === 'Cloudflare TURN' || turnLabel === 'Custom') {
		const custom = getStoredCustomTurnConfig();
		if (custom.url) {
			servers.push({
				urls: [custom.url],
				username: custom.username || undefined,
				credential: custom.credential || undefined,
			});
		}
	}
	// turnLabel === 'None' → no TURN servers added

	return servers;
}

/**
 * Build RTCConfiguration for Private Connect (raw RTCPeerConnection).
 */
export async function buildRtcConfig(): Promise<RTCConfiguration> {
	const iceServers = await buildIceServers();
	debug('RTCConfiguration iceServers:', iceServers.length, 'entries');
	return { iceServers };
}

/**
 * Build peerOpts for Quick Connect (y-webrtc / simple-peer).
 * simple-peer accepts { config: { iceServers: [...] } }.
 */
export async function buildPeerOpts(): Promise<Record<string, unknown>> {
	const iceServers = await buildIceServers();
	debug('peerOpts iceServers:', iceServers.length, 'entries');
	return {
		config: { iceServers },
	};
}
