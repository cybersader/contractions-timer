import { writable } from 'svelte/store';
import type { SessionData } from '../labor-logic/types';
import { EMPTY_SESSION } from '../labor-logic/types';
import { loadSession, saveSession } from '../storage';

export const session = writable<SessionData>(loadSession() ?? { ...EMPTY_SESSION, layout: [...EMPTY_SESSION.layout] });

let timeout: ReturnType<typeof setTimeout>;
session.subscribe((data) => {
	clearTimeout(timeout);
	timeout = setTimeout(() => saveSession(data), 100);
});
