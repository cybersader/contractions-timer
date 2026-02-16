import { writable } from 'svelte/store';
import type { SessionData, ContractionTimerSettings } from './labor-logic/types';
import { DEFAULT_SETTINGS } from './labor-logic/types';
import { deepMerge } from './labor-logic/deepMerge';
import { dlog } from './debug-log';

const SESSION_KEY = 'contractions-timer-data';
const SETTINGS_KEY = 'contractions-timer-settings';
const ARCHIVES_KEY = 'contractions-timer-archives';

/** Reactive store for storage errors. Components can subscribe to show warnings. */
export const storageError = writable<string | null>(null);

let errorTimeout: ReturnType<typeof setTimeout> | undefined;

function setStorageError(msg: string) {
	dlog('storage', 'Storage error', { error: msg }, { level: 'error', src: 'storage' });
	storageError.set(msg);
	clearTimeout(errorTimeout);
	errorTimeout = setTimeout(() => storageError.set(null), 5000);
}

export function loadSession(): SessionData | null {
	try {
		const raw = localStorage.getItem(SESSION_KEY);
		if (!raw) {
			dlog('storage', 'No session in localStorage', undefined, { src: 'storage' });
			return null;
		}
		const data = JSON.parse(raw) as SessionData;
		dlog('storage', 'Session loaded', { contractions: data.contractions?.length ?? 0, events: data.events?.length ?? 0 }, { src: 'storage' });
		return data;
	} catch (e) {
		dlog('storage', 'Failed to load session', { error: String(e) }, { level: 'error', src: 'storage' });
		return null;
	}
}

export function saveSession(data: SessionData): void {
	try {
		localStorage.setItem(SESSION_KEY, JSON.stringify(data));
	} catch (e) {
		setStorageError('Could not save session — storage may be full');
	}
}

export function loadSettings(): Partial<ContractionTimerSettings> | null {
	try {
		const raw = localStorage.getItem(SETTINGS_KEY);
		if (!raw) return null;
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export function saveSettings(s: ContractionTimerSettings): void {
	try {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
	} catch (e) {
		setStorageError('Could not save settings — storage may be full');
	}
}

export interface ArchivedSession {
	id: string;
	archivedAt: string;
	session: SessionData;
	label?: string;
}

/** Archive the current session to localStorage. Returns the archive entry. */
export function archiveSession(session: SessionData, label?: string): ArchivedSession {
	const entry: ArchivedSession = {
		id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
		archivedAt: new Date().toISOString(),
		session,
		label,
	};
	try {
		const existing = loadArchives();
		existing.push(entry);
		localStorage.setItem(ARCHIVES_KEY, JSON.stringify(existing));
		dlog('storage', 'Session archived', { archiveId: entry.id, label, totalArchives: existing.length, contractions: session.contractions?.length ?? 0 }, { src: 'storage' });
	} catch (e) {
		setStorageError('Could not archive session — storage may be full');
	}
	return entry;
}

/** Load all archived sessions. */
export function loadArchives(): ArchivedSession[] {
	try {
		const raw = localStorage.getItem(ARCHIVES_KEY);
		if (!raw) return [];
		return JSON.parse(raw) as ArchivedSession[];
	} catch {
		return [];
	}
}

export function clearAllData(): void {
	dlog('storage', 'Clearing all data', undefined, { level: 'warn', src: 'storage' });
	localStorage.removeItem(SESSION_KEY);
	localStorage.removeItem(SETTINGS_KEY);
	localStorage.removeItem('ct-dismissed-tips');
}

export function clearSessionOnly(): void {
	dlog('storage', 'Clearing session only (preserving settings)', undefined, { level: 'warn', src: 'storage' });
	localStorage.removeItem(SESSION_KEY);
	localStorage.removeItem('ct-dismissed-tips');
}

export function exportData(): string {
	const session = loadSession();
	const settings = loadSettings();
	const json = JSON.stringify({ session, settings }, null, 2);
	dlog('storage', 'Data exported', { bytes: json.length, hasSession: !!session, hasSettings: !!settings }, { src: 'storage' });
	return json;
}

export function importData(json: string): { session: SessionData; settings?: Partial<ContractionTimerSettings> } {
	dlog('storage', 'Import started', { bytes: json.length }, { src: 'storage' });
	const parsed = JSON.parse(json);
	if (!parsed.session || typeof parsed.session !== 'object') {
		throw new Error('Invalid data: missing session object');
	}
	if (!Array.isArray(parsed.session.contractions)) {
		throw new Error('Invalid data: session.contractions must be an array');
	}
	if (!Array.isArray(parsed.session.events)) {
		throw new Error('Invalid data: session.events must be an array');
	}
	saveSession(parsed.session);

	// Restore settings if present — deep merge with existing to preserve unset fields
	let importedSettings: Partial<ContractionTimerSettings> | undefined;
	if (parsed.settings && typeof parsed.settings === 'object') {
		const existing = loadSettings() ?? {};
		const merged = deepMerge(
			deepMerge(DEFAULT_SETTINGS as Record<string, unknown>, existing as Record<string, unknown>),
			parsed.settings as Record<string, unknown>,
		) as ContractionTimerSettings;
		saveSettings(merged);
		importedSettings = parsed.settings;
		dlog('storage', 'Settings restored from import', {
			keys: Object.keys(parsed.settings).length,
		}, { src: 'storage' });
	}

	dlog('storage', 'Import completed', {
		contractions: parsed.session.contractions.length,
		events: parsed.session.events.length,
		hasSettings: !!importedSettings,
	}, { src: 'storage' });
	return { session: parsed.session, settings: importedSettings };
}
