/**
 * Debug logger — "wide event" style for diagnosing issues on mobile devices.
 * Inspired by loggingsucks.com: one rich structured entry per operation,
 * with session context, wall clock times, source tags, and correlation IDs.
 *
 * Backward compatible: existing dlog(cat, msg, data?) calls keep working.
 */
import { writable, get } from 'svelte/store';
import { APP_VERSION } from './version';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
	t: number;         // ms since page load
	ts: string;        // ISO 8601 wall clock
	level: LogLevel;   // severity
	cat: string;       // category (e.g. 'session', 'timer', 'qr-scan')
	msg: string;       // human-readable message
	src?: string;      // source component/file
	op?: string;       // operation/correlation ID
	data?: unknown;    // structured payload
}

export interface DlogOpts {
	level?: LogLevel;
	src?: string;
	op?: string;
}

const STORAGE_KEY = 'ct-debug-enabled';
const SESSION_ID = Math.random().toString(36).slice(2, 10);
const PAGE_LOAD_TIME = Date.now();
const PAGE_LOAD_ISO = new Date(PAGE_LOAD_TIME).toISOString();

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

const entries: LogEntry[] = [];
const MAX_ENTRIES = 2000;

/** Log a debug entry (no-op if disabled). Backward compatible with old dlog(cat, msg, data?). */
export function dlog(cat: string, msg: string, data?: unknown, opts?: DlogOpts) {
	if (!get(debugEnabled)) return;
	const now = Date.now();
	const entry: LogEntry = {
		t: now - PAGE_LOAD_TIME,
		ts: new Date(now).toISOString(),
		level: opts?.level ?? 'info',
		cat,
		msg,
	};
	if (opts?.src) entry.src = opts.src;
	if (opts?.op) entry.op = opts.op;
	if (data !== undefined) entry.data = data;
	entries.push(entry);
	if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
}

/** Create a scoped logger for a multi-step operation with a shared correlation ID. */
export function dlogOp(cat: string, src?: string): (msg: string, data?: unknown, level?: LogLevel) => void {
	const opId = Math.random().toString(36).slice(2, 8);
	return (msg, data, level) => dlog(cat, msg, data, { op: opId, src, level });
}

/** Get the number of log entries */
export function dlogCount(): number {
	return entries.length;
}

/** Clear all log entries */
export function dlogClear() {
	entries.length = 0;
}

/** Build a session context header for the dump. */
function buildHeader(): string {
	const nav = typeof navigator !== 'undefined' ? navigator : null;
	const scr = typeof screen !== 'undefined' ? screen : null;
	const standalone = typeof window !== 'undefined'
		&& (window.matchMedia('(display-mode: standalone)').matches
			|| (window.navigator as any).standalone === true);

	let lsUsage = 'unknown';
	try {
		let total = 0;
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key) total += key.length + (localStorage.getItem(key)?.length ?? 0);
		}
		lsUsage = `${(total * 2 / 1024).toFixed(1)} KB (${localStorage.length} keys)`;
	} catch { /* ignore */ }

	let sessionSummary = 'unavailable';
	try {
		const raw = localStorage.getItem('contractions-timer-data');
		if (raw) {
			const s = JSON.parse(raw);
			const total = s.contractions?.length ?? 0;
			const completed = s.contractions?.filter((c: any) => c.end !== null).length ?? 0;
			const events = s.events?.length ?? 0;
			const paused = s.paused ?? false;
			sessionSummary = `${total} contractions (${completed} completed), ${events} events, paused=${paused}`;
		} else {
			sessionSummary = 'no session data';
		}
	} catch { /* ignore */ }

	let theme = 'unknown';
	try {
		const html = document.documentElement;
		theme = html.getAttribute('data-theme') ?? 'default';
	} catch { /* ignore */ }

	let settingsSummary = 'unavailable';
	try {
		const raw = localStorage.getItem('contractions-timer-settings');
		if (raw) {
			const st = JSON.parse(raw);
			const t = st.threshold ?? {};
			settingsSummary = [
				`threshold: ${t.intervalMinutes ?? '?'}/${t.durationSeconds ?? '?'}/${t.sustainedMinutes ?? '?'}`,
				`parity: ${st.parity ?? 'unknown'}`,
				`advisorMode: ${st.advisorMode ?? 'default'}`,
				`timeFormat: ${st.timeFormat ?? '12h'}`,
			].join(', ');
		}
	} catch { /* ignore */ }

	return [
		`=== Contractions Timer Debug Log ===`,
		`Version: ${APP_VERSION}`,
		`Session ID: ${SESSION_ID}`,
		`Exported: ${new Date().toISOString()}`,
		`Page loaded: ${PAGE_LOAD_ISO}`,
		`Uptime: ${((Date.now() - PAGE_LOAD_TIME) / 1000).toFixed(1)}s`,
		`UA: ${nav?.userAgent ?? 'unknown'}`,
		`Platform: ${nav?.platform ?? 'unknown'}`,
		`Screen: ${scr ? `${scr.width}x${scr.height} @${devicePixelRatio ?? '?'}x` : 'unknown'}`,
		`Standalone: ${standalone}`,
		`Theme: ${theme}`,
		`Settings: ${settingsSummary}`,
		`Session: ${sessionSummary}`,
		`localStorage: ${lsUsage}`,
		`Entries: ${entries.length}`,
		`---`,
	].join('\n');
}

const LEVEL_LABEL: Record<LogLevel, string> = {
	debug: 'DBG',
	info: 'INF',
	warn: 'WRN',
	error: 'ERR',
};

/** Dump all entries as a formatted string for sharing */
export function dlogDump(): string {
	const header = buildHeader();

	const lines = entries.map((e) => {
		const elapsed = `+${(e.t / 1000).toFixed(2)}s`;
		const lvl = LEVEL_LABEL[e.level];
		const src = e.src ? ` <${e.src}>` : '';
		const op = e.op ? ` [op:${e.op}]` : '';
		const base = `[${elapsed}] ${lvl} [${e.cat}]${src}${op} ${e.msg}`;
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
