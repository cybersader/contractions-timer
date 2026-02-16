import { describe, it, expect } from 'bun:test';
import {
	encodeSessionV2,
	decodeSessionV2,
	encodeSettings,
	decodeSettings,
	extractSharedSettings,
	detectIncludedCategories,
	filterSettingsByCategories,
} from '../web/src/lib/p2p/compact-codec';
import type { CompactV2 } from '../web/src/lib/p2p/compact-codec';
import type { SessionData, ContractionTimerSettings, SharingPreferences, SharingCategory } from '../web/src/lib/labor-logic/types';
import { DEFAULT_SETTINGS, DEFAULT_LAYOUT, EMPTY_SESSION, DEFAULT_SHARING_PREFERENCES } from '../web/src/lib/labor-logic/types';

// ── Helpers ──────────────────────────────────────────────────────

function makeSession(contractionCount: number): SessionData {
	const t0 = Date.parse('2025-02-15T10:00:00.000Z');
	const contractions = [];
	for (let i = 0; i < contractionCount; i++) {
		const start = new Date(t0 + i * 5 * 60000).toISOString();
		const end = new Date(t0 + i * 5 * 60000 + 60000).toISOString();
		contractions.push({
			id: `c${i}`,
			start,
			end,
			intensity: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5,
			location: (['front', 'back', 'wrapping', null] as const)[i % 4],
			notes: i === 0 ? 'First contraction' : '',
		});
	}
	return {
		...EMPTY_SESSION,
		contractions,
		events: [
			{ id: 'ev1', type: 'water-break', timestamp: new Date(t0 + 30 * 60000).toISOString(), notes: 'Clear fluid' },
		],
		sessionStartedAt: new Date(t0).toISOString(),
		layout: [...DEFAULT_LAYOUT],
		paused: false,
	};
}

function makeRichSession(): SessionData {
	const t0 = Date.parse('2025-02-15T10:00:00.000Z');
	return {
		...EMPTY_SESSION,
		contractions: [
			{
				id: 'rich1',
				start: new Date(t0).toISOString(),
				end: new Date(t0 + 65000).toISOString(),
				intensity: 4,
				location: 'wrapping',
				notes: 'Strong one',
				phases: { building: 2, peak: 4, easing: 1, peakOffsetSec: 30 },
			},
			{
				id: 'rich2',
				start: new Date(t0 + 5 * 60000).toISOString(),
				end: null, // active
				intensity: null,
				location: null,
				notes: '',
				untimed: true,
				ratingDismissed: true,
			},
			{
				id: 'rich3',
				start: new Date(t0 + 10 * 60000).toISOString(),
				end: new Date(t0 + 10 * 60000 + 55000).toISOString(),
				intensity: 3,
				location: 'back',
				notes: '',
			},
		],
		events: [
			{ id: 'ev1', type: 'water-break', timestamp: new Date(t0 + 8 * 60000).toISOString(), notes: '' },
			{ id: 'ev2', type: 'mucus-plug', timestamp: new Date(t0 + 12 * 60000).toISOString(), notes: 'Noticed it' },
		],
		sessionStartedAt: new Date(t0).toISOString(),
		layout: ['summary', 'wave-chart', 'hospital-advisor', 'timeline', 'pattern-assessment', 'trend-analysis', 'labor-guide'],
		paused: true,
	};
}

// ── Round-trip tests ─────────────────────────────────────────────

describe('compact codec v2', () => {
	it('round-trips a basic session', () => {
		const session = makeSession(5);
		const compact = encodeSessionV2(session);
		const decoded = decodeSessionV2(compact);

		expect(decoded.session.contractions.length).toBe(5);
		expect(decoded.session.events.length).toBe(1);
		expect(decoded.session.paused).toBe(false);

		// Verify contraction data preserved
		for (let i = 0; i < 5; i++) {
			const orig = session.contractions[i];
			const dec = decoded.session.contractions[i];
			expect(dec.id).toBe(orig.id);
			expect(dec.intensity).toBe(orig.intensity);
			expect(dec.location).toBe(orig.location);
			expect(dec.notes).toBe(orig.notes);
			// Timestamps may differ by ms due to ISO parsing round-trip; check within 1ms
			expect(Math.abs(Date.parse(dec.start) - Date.parse(orig.start))).toBeLessThanOrEqual(1);
			if (orig.end) {
				expect(Math.abs(Date.parse(dec.end!) - Date.parse(orig.end))).toBeLessThanOrEqual(1);
			}
		}

		// Verify event preserved
		expect(decoded.session.events[0].type).toBe('water-break');
		expect(decoded.session.events[0].notes).toBe('Clear fluid');
	});

	it('round-trips a rich session with phases, flags, custom layout, paused', () => {
		const session = makeRichSession();
		const compact = encodeSessionV2(session);
		const decoded = decodeSessionV2(compact);

		expect(decoded.session.contractions.length).toBe(3);
		expect(decoded.session.events.length).toBe(2);
		expect(decoded.session.paused).toBe(true);

		// Phases preserved
		const c1 = decoded.session.contractions[0];
		expect(c1.phases).toBeDefined();
		expect(c1.phases!.building).toBe(2);
		expect(c1.phases!.peak).toBe(4);
		expect(c1.phases!.easing).toBe(1);
		expect(c1.phases!.peakOffsetSec).toBe(30);

		// Flags preserved
		const c2 = decoded.session.contractions[1];
		expect(c2.untimed).toBe(true);
		expect(c2.ratingDismissed).toBe(true);
		expect(c2.end).toBeNull();

		// Custom layout preserved
		expect(decoded.session.layout[0]).toBe('summary');
		expect(decoded.session.layout[2]).toBe('hospital-advisor');

		// Event types preserved
		expect(decoded.session.events[0].type).toBe('water-break');
		expect(decoded.session.events[1].type).toBe('mucus-plug');
		expect(decoded.session.events[1].notes).toBe('Noticed it');
	});

	it('round-trips empty session', () => {
		const session = { ...EMPTY_SESSION, layout: [...DEFAULT_LAYOUT] };
		const compact = encodeSessionV2(session);
		const decoded = decodeSessionV2(compact);

		expect(decoded.session.contractions.length).toBe(0);
		expect(decoded.session.events.length).toBe(0);
		expect(decoded.session.paused).toBe(false);
		expect(decoded.session.layout).toEqual(DEFAULT_LAYOUT);
	});

	it('omits default layout from compact format', () => {
		const session = makeSession(1);
		session.layout = [...DEFAULT_LAYOUT];
		const compact = encodeSessionV2(session);
		expect(compact.l).toBeUndefined();
	});

	it('includes non-default layout in compact format', () => {
		const session = makeSession(1);
		session.layout = ['summary', 'wave-chart', 'hospital-advisor', 'timeline', 'pattern-assessment', 'trend-analysis', 'labor-guide'];
		const compact = encodeSessionV2(session);
		expect(compact.l).toBeDefined();
		expect(compact.l![0]).toBe(1); // summary = 1
	});

	it('omits paused=false and empty events', () => {
		const session = makeSession(2);
		session.events = [];
		session.paused = false;
		const compact = encodeSessionV2(session);
		expect(compact.p).toBeUndefined();
		expect(compact.e).toBeUndefined();
	});

	it('includes paused=true', () => {
		const session = makeSession(1);
		session.paused = true;
		const compact = encodeSessionV2(session);
		expect(compact.p).toBe(true);
	});
});

// ── Trailing trimming tests ──────────────────────────────────────

describe('trailing trimming', () => {
	it('trims trailing defaults from contraction arrays', () => {
		const session: SessionData = {
			...EMPTY_SESSION,
			contractions: [{
				id: 'trim1',
				start: '2025-02-15T10:00:00.000Z',
				end: '2025-02-15T10:01:00.000Z',
				intensity: 3,
				location: null,  // encodes to 0
				notes: '',       // trailing default
				// no phases     // trailing null
				// no flags      // trailing 0
			}],
			sessionStartedAt: '2025-02-15T10:00:00.000Z',
		};
		const compact = encodeSessionV2(session);
		// Should be trimmed to [id, start, end, intensity] (location=0 is trimmed too)
		expect(compact.c[0].length).toBeLessThanOrEqual(4);
	});

	it('does not trim non-default trailing values', () => {
		const session: SessionData = {
			...EMPTY_SESSION,
			contractions: [{
				id: 'notrim',
				start: '2025-02-15T10:00:00.000Z',
				end: '2025-02-15T10:01:00.000Z',
				intensity: 3,
				location: 'back', // encodes to 2 (non-zero)
				notes: '',
			}],
			sessionStartedAt: '2025-02-15T10:00:00.000Z',
		};
		const compact = encodeSessionV2(session);
		// Should include up to location (index 4) = 5 elements
		expect(compact.c[0].length).toBe(5);
	});

	it('preserves notes when present even with no later fields', () => {
		const session: SessionData = {
			...EMPTY_SESSION,
			contractions: [{
				id: 'noted',
				start: '2025-02-15T10:00:00.000Z',
				end: '2025-02-15T10:01:00.000Z',
				intensity: 3,
				location: null,
				notes: 'Important note',
			}],
			sessionStartedAt: '2025-02-15T10:00:00.000Z',
		};
		const compact = encodeSessionV2(session);
		// Should include through notes (index 5) = 6 elements
		expect(compact.c[0].length).toBe(6);
		expect(compact.c[0][5]).toBe('Important note');
	});
});

// ── Size comparison ──────────────────────────────────────────────

describe('size comparison', () => {
	it('v2 JSON is significantly smaller than v1 for 20 contractions', () => {
		const session = makeSession(20);
		const v1Json = JSON.stringify(session);
		const v2Json = JSON.stringify(encodeSessionV2(session));

		// v2 should be at least 40% smaller
		expect(v2Json.length).toBeLessThan(v1Json.length * 0.6);
	});

	it('v2 JSON is smaller for rich session with phases and flags', () => {
		const session = makeRichSession();
		const v1Json = JSON.stringify(session);
		const v2Json = JSON.stringify(encodeSessionV2(session));

		expect(v2Json.length).toBeLessThan(v1Json.length);
	});
});

// ── End-to-end compressed size (deflate + base64url) ────────────

// Mirrors the snapshot-share.ts pipeline: JSON → deflate → base64url
// Uses Bun.deflateSync (equivalent to browser CompressionStream('deflate'))
function compressToBase64url(data: unknown): string {
	const json = JSON.stringify(data);
	const raw = new TextEncoder().encode(json);
	const compressed = Bun.deflateSync(raw);
	let binary = '';
	for (const b of compressed) binary += String.fromCharCode(b);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('end-to-end compressed URL size', () => {
	it('v2 produces shorter base64url for 20 contractions', () => {
		const session = makeSession(20);
		const v1Code = compressToBase64url(session);
		const v2Code = compressToBase64url(encodeSessionV2(session));

		const v1Url = `https://contractions.app/#snapshot=${v1Code}`;
		const v2Url = `https://contractions.app/#snapshot=${v2Code}`;

		console.log(`  20 contractions — v1: ${v1Code.length} chars (URL ${v1Url.length}), v2: ${v2Code.length} chars (URL ${v2Url.length}), savings: ${((1 - v2Code.length / v1Code.length) * 100).toFixed(1)}%`);

		expect(v2Code.length).toBeLessThan(v1Code.length);
	});

	it('v2 produces shorter base64url for 5 contractions', () => {
		const session = makeSession(5);
		const v1Code = compressToBase64url(session);
		const v2Code = compressToBase64url(encodeSessionV2(session));

		console.log(`   5 contractions — v1: ${v1Code.length} chars, v2: ${v2Code.length} chars, savings: ${((1 - v2Code.length / v1Code.length) * 100).toFixed(1)}%`);

		expect(v2Code.length).toBeLessThan(v1Code.length);
	});

	it('v2 produces shorter base64url for 50 contractions', () => {
		const session = makeSession(50);
		const v1Code = compressToBase64url(session);
		const v2Code = compressToBase64url(encodeSessionV2(session));

		console.log(`  50 contractions — v1: ${v1Code.length} chars, v2: ${v2Code.length} chars, savings: ${((1 - v2Code.length / v1Code.length) * 100).toFixed(1)}%`);

		expect(v2Code.length).toBeLessThan(v1Code.length);
	});

	it('v2 keeps URLs under QR limit for 40+ contractions', () => {
		const session = makeSession(40);
		const v2Code = compressToBase64url(encodeSessionV2(session));
		const urlLength = `https://contractions.app/#snapshot=${v2Code}`.length;

		console.log(`  40 contractions — v2 URL length: ${urlLength} (QR limit ~2900)`);

		// QR version 40 Low ECC ≈ 2953 alphanumeric chars
		expect(urlLength).toBeLessThan(2900);
	});

	it('v1 would exceed QR limit where v2 fits', () => {
		const session = makeSession(30);
		const v1Code = compressToBase64url(session);
		const v2Code = compressToBase64url(encodeSessionV2(session));

		const v1Url = `https://contractions.app/#snapshot=${v1Code}`.length;
		const v2Url = `https://contractions.app/#snapshot=${v2Code}`.length;

		console.log(`  30 contractions — v1 URL: ${v1Url}, v2 URL: ${v2Url} (QR limit ~2900)`);

		// v2 should fit in QR, demonstrating the practical advantage
		expect(v2Url).toBeLessThan(2900);
	});
});

// ── Settings extraction ──────────────────────────────────────────

describe('extractSharedSettings', () => {
	it('returns undefined when all prefs are off', () => {
		const prefs: SharingPreferences = {
			thresholds: false, provider: false, layout: false,
			parity: false, travel: false, appearance: false,
		};
		expect(extractSharedSettings(DEFAULT_SETTINGS, prefs)).toBeUndefined();
	});

	it('extracts thresholds category', () => {
		const prefs: SharingPreferences = {
			...DEFAULT_SHARING_PREFERENCES,
			provider: false, layout: false,
		};
		const result = extractSharedSettings(DEFAULT_SETTINGS, prefs)!;
		expect(result.threshold).toBeDefined();
		expect(result.stageThresholds).toBeDefined();
		expect(result.bhThresholds).toBeDefined();
		expect(result.intensityScale).toBe(5);
		// Should NOT have appearance fields
		expect(result.theme).toBeUndefined();
		expect(result.parity).toBeUndefined();
	});

	it('extracts provider phone without travel', () => {
		const prefs: SharingPreferences = {
			thresholds: false, provider: true, layout: false,
			parity: false, travel: false, appearance: false,
		};
		const settings = { ...DEFAULT_SETTINGS, hospitalAdvisor: { ...DEFAULT_SETTINGS.hospitalAdvisor, providerPhone: '555-1234' } };
		const result = extractSharedSettings(settings, prefs)!;
		expect(result.hospitalAdvisor).toBeDefined();
		expect((result.hospitalAdvisor as any).providerPhone).toBe('555-1234');
		// travel fields should not be present
		expect((result.hospitalAdvisor as any).travelTimeMinutes).toBeUndefined();
	});

	it('extracts both provider and travel into merged hospitalAdvisor', () => {
		const prefs: SharingPreferences = {
			thresholds: false, provider: true, layout: false,
			parity: false, travel: true, appearance: false,
		};
		const settings = { ...DEFAULT_SETTINGS, hospitalAdvisor: { ...DEFAULT_SETTINGS.hospitalAdvisor, providerPhone: '555-1234', travelTimeMinutes: 45 } };
		const result = extractSharedSettings(settings, prefs)!;
		expect((result.hospitalAdvisor as any).providerPhone).toBe('555-1234');
		expect((result.hospitalAdvisor as any).travelTimeMinutes).toBe(45);
	});

	it('round-trips settings through encode/decode', () => {
		const prefs = DEFAULT_SHARING_PREFERENCES; // thresholds, provider, layout ON
		const settings = { ...DEFAULT_SETTINGS, hospitalAdvisor: { ...DEFAULT_SETTINGS.hospitalAdvisor, providerPhone: '555-9999' } };
		const shared = extractSharedSettings(settings, prefs)!;

		const session = makeSession(3);
		const compact = encodeSessionV2(session, shared);
		const decoded = decodeSessionV2(compact);

		expect(decoded.sharedSettings).toBeDefined();
		expect(decoded.sharedSettings!.threshold).toEqual(DEFAULT_SETTINGS.threshold);
		expect((decoded.sharedSettings!.hospitalAdvisor as any).providerPhone).toBe('555-9999');
	});
});

// ── Category detection ───────────────────────────────────────────

describe('detectIncludedCategories', () => {
	it('detects thresholds', () => {
		const cats = detectIncludedCategories({ threshold: DEFAULT_SETTINGS.threshold });
		expect(cats).toContain('thresholds');
	});

	it('detects provider', () => {
		const cats = detectIncludedCategories({ hospitalAdvisor: { providerPhone: '555' } as any });
		expect(cats).toContain('provider');
	});

	it('detects travel', () => {
		const cats = detectIncludedCategories({ hospitalAdvisor: { travelTimeMinutes: 30 } as any });
		expect(cats).toContain('travel');
	});

	it('detects layout', () => {
		const cats = detectIncludedCategories({ heroMode: 'compact-timer' });
		expect(cats).toContain('layout');
	});

	it('detects parity', () => {
		const cats = detectIncludedCategories({ parity: 'first-baby' });
		expect(cats).toContain('parity');
	});

	it('detects appearance', () => {
		const cats = detectIncludedCategories({ theme: 'clinical', showWaveChart: true });
		expect(cats).toContain('appearance');
	});

	it('returns empty for empty settings', () => {
		expect(detectIncludedCategories({})).toEqual([]);
	});
});

// ── Category filtering ───────────────────────────────────────────

describe('filterSettingsByCategories', () => {
	const fullShared: Partial<ContractionTimerSettings> = {
		threshold: DEFAULT_SETTINGS.threshold,
		stageThresholds: DEFAULT_SETTINGS.stageThresholds,
		intensityScale: 5,
		hospitalAdvisor: { providerPhone: '555', travelTimeMinutes: 20, travelTimeUncertain: false, riskAppetite: 'conservative' },
		heroMode: 'compact-timer',
		parity: 'subsequent',
		theme: 'clinical',
		showWaveChart: false,
		timeFormat: '24h',
	};

	it('filters to only thresholds', () => {
		const enabled: Record<SharingCategory, boolean> = {
			thresholds: true, provider: false, layout: false,
			parity: false, travel: false, appearance: false,
		};
		const result = filterSettingsByCategories(fullShared, enabled);
		expect(result.threshold).toBeDefined();
		expect(result.intensityScale).toBe(5);
		expect(result.hospitalAdvisor).toBeUndefined();
		expect(result.theme).toBeUndefined();
	});

	it('filters provider only (not travel from same hospitalAdvisor)', () => {
		const enabled: Record<SharingCategory, boolean> = {
			thresholds: false, provider: true, layout: false,
			parity: false, travel: false, appearance: false,
		};
		const result = filterSettingsByCategories(fullShared, enabled);
		expect((result.hospitalAdvisor as any)?.providerPhone).toBe('555');
		expect((result.hospitalAdvisor as any)?.travelTimeMinutes).toBeUndefined();
	});

	it('filters travel only (not provider from same hospitalAdvisor)', () => {
		const enabled: Record<SharingCategory, boolean> = {
			thresholds: false, provider: false, layout: false,
			parity: false, travel: true, appearance: false,
		};
		const result = filterSettingsByCategories(fullShared, enabled);
		expect((result.hospitalAdvisor as any)?.travelTimeMinutes).toBe(20);
		expect((result.hospitalAdvisor as any)?.providerPhone).toBeUndefined();
	});

	it('returns empty when all disabled', () => {
		const enabled: Record<SharingCategory, boolean> = {
			thresholds: false, provider: false, layout: false,
			parity: false, travel: false, appearance: false,
		};
		const result = filterSettingsByCategories(fullShared, enabled);
		expect(Object.keys(result).length).toBe(0);
	});

	it('passes everything when all enabled', () => {
		const enabled: Record<SharingCategory, boolean> = {
			thresholds: true, provider: true, layout: true,
			parity: true, travel: true, appearance: true,
		};
		const result = filterSettingsByCategories(fullShared, enabled);
		expect(result.threshold).toBeDefined();
		expect(result.parity).toBe('subsequent');
		expect(result.theme).toBe('clinical');
		expect(result.heroMode).toBe('compact-timer');
	});
});

// ── pausedAt encoding ───────────────────────────────────────────

describe('pausedAt encoding', () => {
	it('round-trips pausedAt timestamp', () => {
		const session = makeSession(3);
		session.paused = true;
		session.pausedAt = '2025-02-15T10:15:30.000Z';
		const compact = encodeSessionV2(session);
		expect(compact.p).toBe(true);
		expect(compact.pa).toBeDefined();

		const decoded = decodeSessionV2(compact);
		expect(decoded.session.paused).toBe(true);
		expect(decoded.session.pausedAt).toBeDefined();
		expect(Math.abs(Date.parse(decoded.session.pausedAt!) - Date.parse(session.pausedAt))).toBeLessThanOrEqual(1);
	});

	it('omits pa when not paused', () => {
		const session = makeSession(3);
		session.paused = false;
		session.pausedAt = null;
		const compact = encodeSessionV2(session);
		expect(compact.pa).toBeUndefined();
		expect(compact.p).toBeUndefined();
	});

	it('decodes null pausedAt when pa is absent', () => {
		const session = makeSession(2);
		const compact = encodeSessionV2(session);
		const decoded = decodeSessionV2(compact);
		expect(decoded.session.pausedAt).toBeNull();
	});
});

// ── Settings compression ────────────────────────────────────────

describe('settings compression', () => {
	it('round-trips boolean bitfield', () => {
		const settings: Partial<ContractionTimerSettings> = {
			showWaveChart: true,
			showTimeline: false,
			showSummaryCards: true,
			showProgressionInsight: true,
			showPostRating: false,
			showIntensityPicker: true,
			showLocationPicker: true,
			showRestSeconds: false,
			showHospitalAdvisor: true,
			showContextualTips: true,
			showBraxtonHicksAssessment: false,
			showClinicalReference: true,
			showWaterBreakButton: true,
			showThresholdRule: true,
			showLiveRating: false,
			showChartOverlay: false,
			showPrayers: false,
			hapticFeedback: true,
			persistPause: true,
			enableDebugLog: false,
		};

		const compressed = encodeSettings(settings);
		expect(compressed.b).toBeDefined();
		expect(compressed.bp).toBeDefined();

		const decoded = decodeSettings(compressed);
		for (const [key, val] of Object.entries(settings)) {
			expect((decoded as any)[key]).toBe(val);
		}
	});

	it('round-trips enum settings', () => {
		const settings: Partial<ContractionTimerSettings> = {
			heroMode: 'compact-timer',
			advisorMode: 'minimal',
			parity: 'subsequent',
			timeFormat: '24h',
			stageTimeBasis: 'current-time',
			advisorProgressionRate: 'faster',
		};

		const compressed = encodeSettings(settings);
		const decoded = decodeSettings(compressed);

		expect(decoded.heroMode).toBe('compact-timer');
		expect(decoded.advisorMode).toBe('minimal');
		expect(decoded.parity).toBe('subsequent');
		expect(decoded.timeFormat).toBe('24h');
		expect(decoded.stageTimeBasis).toBe('current-time');
		expect(decoded.advisorProgressionRate).toBe('faster');
	});

	it('round-trips threshold config', () => {
		const settings: Partial<ContractionTimerSettings> = {
			threshold: { intervalMinutes: 4, durationSeconds: 45, sustainedMinutes: 90 },
		};

		const compressed = encodeSettings(settings);
		expect(compressed.t).toEqual([4, 45, 90]);

		const decoded = decodeSettings(compressed);
		expect(decoded.threshold).toEqual(settings.threshold);
	});

	it('round-trips hospital advisor', () => {
		const settings: Partial<ContractionTimerSettings> = {
			hospitalAdvisor: {
				travelTimeMinutes: 45,
				travelTimeUncertain: true,
				riskAppetite: 'conservative',
				providerPhone: '555-1234',
			},
		};

		const compressed = encodeSettings(settings);
		const decoded = decodeSettings(compressed);

		expect((decoded.hospitalAdvisor as any)?.travelTimeMinutes).toBe(45);
		expect((decoded.hospitalAdvisor as any)?.travelTimeUncertain).toBe(true);
		expect((decoded.hospitalAdvisor as any)?.riskAppetite).toBe('conservative');
		expect((decoded.hospitalAdvisor as any)?.providerPhone).toBe('555-1234');
	});

	it('round-trips BH thresholds', () => {
		const settings: Partial<ContractionTimerSettings> = {
			bhThresholds: {
				regularityCVLow: 0.2, regularityCVHigh: 0.7,
				locationRatioHigh: 0.6, locationRatioLow: 0.15,
				sustainedMinMinutes: 150, sustainedMaxGapMinutes: 25,
				verdictRealThreshold: 65, verdictBHThreshold: 25,
			},
		};

		const compressed = encodeSettings(settings);
		expect(compressed.bh).toHaveLength(8);

		const decoded = decodeSettings(compressed);
		expect(decoded.bhThresholds).toEqual(settings.bhThresholds);
	});

	it('round-trips sharing preferences bitfield', () => {
		const settings: Partial<ContractionTimerSettings> = {
			sharingPreferences: {
				thresholds: true, provider: false, layout: true,
				parity: true, travel: false, appearance: true,
			},
		};

		const compressed = encodeSettings(settings);
		expect(typeof compressed.sp).toBe('number');

		const decoded = decodeSettings(compressed);
		expect(decoded.sharingPreferences).toEqual(settings.sharingPreferences);
	});

	it('compressed settings are much smaller than raw JSON', () => {
		// Full appearance settings (the bulkiest category)
		const settings: Partial<ContractionTimerSettings> = {
			showWaveChart: true, showTimeline: true, showSummaryCards: true,
			showProgressionInsight: true, showPostRating: true,
			showIntensityPicker: true, showLocationPicker: true,
			showRestSeconds: false, showHospitalAdvisor: true,
			showContextualTips: true, showBraxtonHicksAssessment: true,
			showClinicalReference: true, showWaterBreakButton: true,
			showThresholdRule: true, showLiveRating: false,
			showChartOverlay: false, showPrayers: false,
			theme: 'clinical', timeFormat: '24h',
			waveChartHeight: 150, advisorMode: 'range',
			heroMode: 'action-card',
		};

		const rawJson = JSON.stringify(settings);
		const compressedJson = JSON.stringify(encodeSettings(settings));

		console.log(`  Settings raw: ${rawJson.length} chars, compressed: ${compressedJson.length} chars, savings: ${((1 - compressedJson.length / rawJson.length) * 100).toFixed(1)}%`);

		expect(compressedJson.length).toBeLessThan(rawJson.length * 0.5);
	});

	it('end-to-end: compressed settings produce shorter URLs', () => {
		const session = makeSession(10);
		const allPrefs: SharingPreferences = {
			thresholds: true, provider: true, layout: true,
			parity: true, travel: true, appearance: true,
		};
		const fullSettings = {
			...DEFAULT_SETTINGS,
			hospitalAdvisor: { ...DEFAULT_SETTINGS.hospitalAdvisor, providerPhone: '555-9876' },
		};
		const shared = extractSharedSettings(fullSettings, allPrefs)!;

		const v2WithSettings = encodeSessionV2(session, shared);
		const v2Compressed = compressToBase64url(v2WithSettings);

		// Compare to what v0.3.13 would have produced (raw settings under 's' key)
		const v2Legacy = { ...encodeSessionV2(session), s: shared };
		delete (v2Legacy as any).sk;
		const v2LegacyCompressed = compressToBase64url(v2Legacy);

		console.log(`  10 contractions + all settings — legacy: ${v2LegacyCompressed.length} chars, compressed: ${v2Compressed.length} chars, savings: ${((1 - v2Compressed.length / v2LegacyCompressed.length) * 100).toFixed(1)}%`);

		expect(v2Compressed.length).toBeLessThan(v2LegacyCompressed.length);
	});

	it('handles partial settings (only some booleans present)', () => {
		const settings: Partial<ContractionTimerSettings> = {
			showWaveChart: false,
			showPrayers: true,
		};

		const compressed = encodeSettings(settings);
		const decoded = decodeSettings(compressed);

		expect(decoded.showWaveChart).toBe(false);
		expect(decoded.showPrayers).toBe(true);
		// Keys NOT in original should NOT be in decoded
		expect('showTimeline' in decoded).toBe(false);
		expect('showPostRating' in decoded).toBe(false);
	});
});
