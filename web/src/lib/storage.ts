import type { SessionData, ContractionTimerSettings } from './labor-logic/types';

const SESSION_KEY = 'contractions-timer-data';
const SETTINGS_KEY = 'contractions-timer-settings';

export function loadSession(): SessionData | null {
	try {
		const raw = localStorage.getItem(SESSION_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as SessionData;
	} catch {
		return null;
	}
}

export function saveSession(data: SessionData): void {
	try {
		localStorage.setItem(SESSION_KEY, JSON.stringify(data));
	} catch { /* quota exceeded, etc. */ }
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
	} catch { /* quota exceeded */ }
}

export function clearAllData(): void {
	localStorage.removeItem(SESSION_KEY);
	localStorage.removeItem(SETTINGS_KEY);
	localStorage.removeItem('ct-dismissed-tips');
}

export function exportData(): string {
	const session = loadSession();
	const settings = loadSettings();
	return JSON.stringify({ session, settings }, null, 2);
}

export function importData(json: string): SessionData {
	const parsed = JSON.parse(json);
	if (parsed.session) {
		saveSession(parsed.session);
		return parsed.session;
	}
	throw new Error('Invalid data format');
}
