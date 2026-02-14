/**
 * Debug logger for diagnosing issues on mobile devices.
 * Toggle on via devtools, then copy the log package to share.
 */
import { writable, get } from 'svelte/store';

export interface LogEntry {
	t: number;      // timestamp (ms since page load)
	cat: string;    // category (e.g. 'qr-scan', 'barcode-detect')
	msg: string;    // human-readable message
	data?: unknown; // optional structured data
}

const STORAGE_KEY = 'ct-debug-enabled';

/** Whether debug logging is enabled (persisted) */
export const debugEnabled = writable<boolean>(
	typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1'
);

// Persist changes
debugEnabled.subscribe((v) => {
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(STORAGE_KEY, v ? '1' : '0');
	}
});

const pageLoadTime = Date.now();
const entries: LogEntry[] = [];
const MAX_ENTRIES = 2000;

/** Log a debug entry (no-op if disabled) */
export function dlog(cat: string, msg: string, data?: unknown) {
	if (!get(debugEnabled)) return;
	const entry: LogEntry = { t: Date.now() - pageLoadTime, cat, msg };
	if (data !== undefined) entry.data = data;
	entries.push(entry);
	if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
}

/** Get the number of log entries */
export function dlogCount(): number {
	return entries.length;
}

/** Clear all log entries */
export function dlogClear() {
	entries.length = 0;
}

/** Dump all entries as a formatted string for sharing */
export function dlogDump(): string {
	const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
	const now = new Date().toISOString();
	const header = [
		`=== Debug Log ===`,
		`Exported: ${now}`,
		`UA: ${ua}`,
		`Entries: ${entries.length}`,
		`---`,
	].join('\n');

	const lines = entries.map((e) => {
		const ts = `+${(e.t / 1000).toFixed(2)}s`;
		const base = `[${ts}] [${e.cat}] ${e.msg}`;
		if (e.data !== undefined) {
			try {
				return base + ' | ' + JSON.stringify(e.data);
			} catch {
				return base + ' | [unserializable]';
			}
		}
		return base;
	});

	return header + '\n' + lines.join('\n');
}
