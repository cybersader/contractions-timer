import { writable } from 'svelte/store';
import type { ContractionTimerSettings } from '../labor-logic/types';
import { DEFAULT_SETTINGS } from '../labor-logic/types';
import { deepMerge } from '../labor-logic/deepMerge';
import { loadSettings, saveSettings } from '../storage';

export const settings = writable<ContractionTimerSettings>(
	deepMerge(DEFAULT_SETTINGS, (loadSettings() ?? {}) as Record<string, unknown>)
);

settings.subscribe((s) => saveSettings(s));
