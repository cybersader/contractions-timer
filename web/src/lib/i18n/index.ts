import { register, init, locale, addMessages } from 'svelte-i18n';
import type { SupportedLanguage } from '../labor-logic/types';

// English bundled inline for instant load (no flash of untranslated content)
import en from './locales/en.json';
addMessages('en', en);

// Other locales lazy-loaded on demand
register('es', () => import('./locales/es.json'));
register('fr', () => import('./locales/fr.json'));
register('de', () => import('./locales/de.json'));
register('pt', () => import('./locales/pt.json'));
register('zh', () => import('./locales/zh.json'));
register('it', () => import('./locales/it.json'));
register('nl', () => import('./locales/nl.json'));

export const SUPPORTED_LANGUAGES: { code: SupportedLanguage; name: string; nativeName: string }[] = [
	{ code: 'en', name: 'English', nativeName: 'English' },
	{ code: 'es', name: 'Spanish', nativeName: 'Espanol' },
	{ code: 'fr', name: 'French', nativeName: 'Francais' },
	{ code: 'de', name: 'German', nativeName: 'Deutsch' },
	{ code: 'pt', name: 'Portuguese', nativeName: 'Portugues' },
	{ code: 'zh', name: 'Chinese', nativeName: '中文' },
	{ code: 'it', name: 'Italian', nativeName: 'Italiano' },
	{ code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
];

export function initI18n(lang: SupportedLanguage) {
	init({
		fallbackLocale: 'en',
		initialLocale: lang,
	});
}

export { locale };
