import { loadFont } from './font-loader';

export type ThemePalette = 'clinical' | 'soft' | 'warm' | 'ocean' | 'forest' | 'sunset' | 'lavender' | 'midnight' | 'sky' | 'blush';
export type ThemeMode = 'light' | 'mid' | 'dark';
export type ThemeId = `${ThemePalette}-${ThemeMode}`;

export interface ThemeInfo {
	id: ThemeId;
	palette: ThemePalette;
	mode: ThemeMode;
	label: string;
	metaColor: string; // for <meta name="theme-color">
}

export const THEMES: ThemeInfo[] = [
	{ id: 'clinical-dark', palette: 'clinical', mode: 'dark', label: 'Clinical', metaColor: '#0f172a' },
	{ id: 'clinical-light', palette: 'clinical', mode: 'light', label: 'Clinical', metaColor: '#f0f4f8' },
	{ id: 'soft-dark', palette: 'soft', mode: 'dark', label: 'Soft', metaColor: '#1a1625' },
	{ id: 'soft-light', palette: 'soft', mode: 'light', label: 'Soft', metaColor: '#f5f3ff' },
	{ id: 'warm-dark', palette: 'warm', mode: 'dark', label: 'Warm', metaColor: '#1c1917' },
	{ id: 'warm-light', palette: 'warm', mode: 'light', label: 'Warm', metaColor: '#fefce8' },
	{ id: 'ocean-dark', palette: 'ocean', mode: 'dark', label: 'Ocean', metaColor: '#0c1b2a' },
	{ id: 'ocean-light', palette: 'ocean', mode: 'light', label: 'Ocean', metaColor: '#e8f4f7' },
	{ id: 'forest-dark', palette: 'forest', mode: 'dark', label: 'Forest', metaColor: '#101a14' },
	{ id: 'forest-light', palette: 'forest', mode: 'light', label: 'Forest', metaColor: '#eef5e8' },
	{ id: 'sunset-dark', palette: 'sunset', mode: 'dark', label: 'Sunset', metaColor: '#1a1210' },
	{ id: 'sunset-light', palette: 'sunset', mode: 'light', label: 'Sunset', metaColor: '#fff7ed' },
	{ id: 'lavender-dark', palette: 'lavender', mode: 'dark', label: 'Lavender', metaColor: '#16101f' },
	{ id: 'lavender-light', palette: 'lavender', mode: 'light', label: 'Lavender', metaColor: '#faf5ff' },
	{ id: 'midnight-dark', palette: 'midnight', mode: 'dark', label: 'Midnight', metaColor: '#080d18' },
	{ id: 'midnight-light', palette: 'midnight', mode: 'light', label: 'Midnight', metaColor: '#eef2ff' },
	{ id: 'sky-dark', palette: 'sky', mode: 'dark', label: 'Sky', metaColor: '#0c1929' },
	{ id: 'sky-light', palette: 'sky', mode: 'light', label: 'Sky', metaColor: '#e8f4fd' },
	{ id: 'blush-dark', palette: 'blush', mode: 'dark', label: 'Blush', metaColor: '#1a0b14' },
	{ id: 'blush-light', palette: 'blush', mode: 'light', label: 'Blush', metaColor: '#fdf2f8' },
	// Mid-tone themes (frosted glass on colored paper)
	{ id: 'soft-mid', palette: 'soft', mode: 'mid', label: 'Aurora', metaColor: '#7c5eaa' },
	{ id: 'clinical-mid', palette: 'clinical', mode: 'mid', label: 'Terminal', metaColor: '#0a1a14' },
	{ id: 'warm-mid', palette: 'warm', mode: 'mid', label: 'Cathedral', metaColor: '#1a1008' },
	{ id: 'ocean-mid', palette: 'ocean', mode: 'mid', label: 'Abyss', metaColor: '#071c25' },
	{ id: 'forest-mid', palette: 'forest', mode: 'mid', label: 'Shire', metaColor: '#0e1a0e' },
	{ id: 'sunset-mid', palette: 'sunset', mode: 'mid', label: 'Retrowave', metaColor: '#1a0a2e' },
	{ id: 'lavender-mid', palette: 'lavender', mode: 'mid', label: 'Frost', metaColor: '#e2e8f4' },
	{ id: 'midnight-mid', palette: 'midnight', mode: 'mid', label: 'Galaxy', metaColor: '#0c0c1e' },
	{ id: 'sky-mid', palette: 'sky', mode: 'mid', label: 'Dreamscape', metaColor: '#72b4d8' },
	{ id: 'blush-mid', palette: 'blush', mode: 'mid', label: 'Sakura', metaColor: '#3a1028' },
];

/** All palette names in display order */
export const PALETTES: ThemePalette[] = ['soft', 'clinical', 'warm', 'ocean', 'forest', 'sunset', 'lavender', 'midnight', 'sky', 'blush'];

/** Creative display names for each palette's unique (mid) mode */
export const UNIQUE_MODE_LABELS: Record<ThemePalette, string> = {
	soft: 'Aurora',
	clinical: 'Terminal',
	warm: 'Cathedral',
	ocean: 'Abyss',
	forest: 'Shire',
	sunset: 'Retrowave',
	lavender: 'Frost',
	midnight: 'Galaxy',
	sky: 'Dreamscape',
	blush: 'Sakura',
};

/** Font assigned to each palette's "unique" (mid) mode */
export const PALETTE_FONTS: Record<ThemePalette, string> = {
	soft: 'Poppins',
	clinical: 'IBM Plex Mono',
	warm: 'Cinzel',
	ocean: 'Quicksand',
	forest: 'Playfair Display',
	sunset: 'Space Mono',
	lavender: 'DM Sans',
	midnight: 'Space Grotesk',
	sky: 'Nunito',
	blush: 'Fredoka',
};

const THEME_STORAGE_KEY = 'ct-theme';

/** Palettes that support a light/dark card style toggle in mid mode */
export const CARD_STYLE_PALETTES: ThemePalette[] = ['warm', 'forest'];
export type CardStyle = 'dark' | 'light';

export function getStoredCardStyle(palette: ThemePalette): CardStyle {
	try {
		const stored = localStorage.getItem(`ct-card-style-${palette}`);
		if (stored === 'light' || stored === 'dark') return stored;
	} catch { /* ignore */ }
	return 'dark'; // default: dark frosted cards
}

export function setCardStyle(palette: ThemePalette, style: CardStyle): void {
	localStorage.setItem(`ct-card-style-${palette}`, style);
	if (style === 'light') {
		document.documentElement.setAttribute('data-card-style', 'light');
	} else {
		document.documentElement.removeAttribute('data-card-style');
	}
}

export function getStoredTheme(): ThemeId {
	try {
		const stored = localStorage.getItem(THEME_STORAGE_KEY);
		if (stored && THEMES.some(t => t.id === stored)) return stored as ThemeId;
	} catch { /* ignore */ }

	// Default: detect system preference, use soft palette
	const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
	return prefersDark ? 'soft-dark' : 'soft-light';
}

export function setTheme(id: ThemeId): void {
	const theme = THEMES.find(t => t.id === id);
	if (!theme) return;

	document.documentElement.setAttribute('data-theme', id);
	localStorage.setItem(THEME_STORAGE_KEY, id);

	// Font loading for unique (mid) themes
	if (theme.mode === 'mid') {
		const font = PALETTE_FONTS[theme.palette];
		loadFont(font);
		document.documentElement.style.setProperty('--theme-font', `'${font}'`);
	} else {
		document.documentElement.style.removeProperty('--theme-font');
	}

	// Card style for supported mid themes (warm, forest)
	if (theme.mode === 'mid' && CARD_STYLE_PALETTES.includes(theme.palette)) {
		const style = getStoredCardStyle(theme.palette);
		if (style === 'light') {
			document.documentElement.setAttribute('data-card-style', 'light');
		} else {
			document.documentElement.removeAttribute('data-card-style');
		}
	} else {
		document.documentElement.removeAttribute('data-card-style');
	}

	// Update meta theme-color
	const meta = document.querySelector('meta[name="theme-color"]');
	if (meta) meta.setAttribute('content', theme.metaColor);
}

export function getThemeInfo(id: ThemeId): ThemeInfo | undefined {
	return THEMES.find(t => t.id === id);
}

/** Palette preview colors for the theme picker */
export const PALETTE_PREVIEWS: Record<ThemePalette, {
	primary: string; accent: string; bg: string; bgLight: string; bgMid: string;
	primaryMid?: string; accentMid?: string;
}> = {
	clinical: { primary: '#3b82f6', accent: '#0ea5e9', bg: '#0f172a', bgLight: '#f0f4f8', bgMid: '#122a1e', primaryMid: '#4ade80', accentMid: '#22c55e' },
	soft: { primary: '#818cf8', accent: '#a78bfa', bg: '#1a1625', bgLight: '#f5f3ff', bgMid: '#6b4d96', primaryMid: '#a78bfa', accentMid: '#c4b5fd' },
	warm: { primary: '#c4880e', accent: '#d4a030', bg: '#1c1917', bgLight: '#fefce8', bgMid: '#2a1a0c', primaryMid: '#e8a820', accentMid: '#c4880e' },
	ocean: { primary: '#2dd4bf', accent: '#14b8a6', bg: '#0c1b2a', bgLight: '#e8f4f7', bgMid: '#0e2e3e', primaryMid: '#2dd4bf', accentMid: '#0891b2' },
	forest: { primary: '#5d9e3e', accent: '#3d7a2e', bg: '#101a14', bgLight: '#eef5e8', bgMid: '#1a3518', primaryMid: '#5d9e3e', accentMid: '#c4961e' },
	sunset: { primary: '#fb923c', accent: '#f97316', bg: '#1a1210', bgLight: '#fff7ed', bgMid: '#22103a', primaryMid: '#ec4899', accentMid: '#fb923c' },
	lavender: { primary: '#c084fc', accent: '#a855f7', bg: '#16101f', bgLight: '#faf5ff', bgMid: '#dde4f0', primaryMid: '#94a3b8', accentMid: '#c084fc' },
	midnight: { primary: '#60a5fa', accent: '#3b82f6', bg: '#080d18', bgLight: '#eef2ff', bgMid: '#14142e', primaryMid: '#60a5fa', accentMid: '#8b5cf6' },
	sky: { primary: '#38bdf8', accent: '#0284c7', bg: '#0c1929', bgLight: '#e8f4fd', bgMid: '#5a9ec0', primaryMid: '#38bdf8', accentMid: '#06b6d4' },
	blush: { primary: '#f472b6', accent: '#db2777', bg: '#1a0b14', bgLight: '#fdf2f8', bgMid: '#4a1830', primaryMid: '#f472b6', accentMid: '#ec4899' },
};
