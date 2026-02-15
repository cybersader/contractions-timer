/**
 * Compact v2 encoding for snapshot sharing.
 *
 * Instead of raw JSON, contractions are stored as positional arrays with
 * delta timestamps, enum-coded locations, and trailing-null trimming.
 * This typically yields 50-80% smaller payloads before deflate.
 */

import type {
	Contraction,
	ContractionLocation,
	ContractionPhases,
	ContractionTimerSettings,
	HospitalAdvisorConfig,
	LaborEvent,
	LaborEventType,
	SectionId,
	SessionData,
	SharingCategory,
	SharingPreferences,
} from '../labor-logic/types';
import { DEFAULT_LAYOUT, EMPTY_SESSION } from '../labor-logic/types';

// ── Enum lookup tables ─────────────────────────────────────────────

const LOCATION_TO_NUM: Record<string, number> = { front: 1, back: 2, wrapping: 3 };
const NUM_TO_LOCATION: Record<number, ContractionLocation> = { 1: 'front', 2: 'back', 3: 'wrapping' };

const EVENT_TYPE_TO_NUM: Record<string, number> = { 'water-break': 0, 'mucus-plug': 1, 'bloody-show': 2, 'custom': 3 };
const NUM_TO_EVENT_TYPE: Record<number, LaborEventType> = { 0: 'water-break', 1: 'mucus-plug', 2: 'bloody-show', 3: 'custom' };

const SECTION_TO_NUM: Record<string, number> = {
	'hospital-advisor': 0, 'summary': 1, 'pattern-assessment': 2,
	'trend-analysis': 3, 'wave-chart': 4, 'timeline': 5, 'labor-guide': 6,
};
const NUM_TO_SECTION: Record<number, SectionId> = {
	0: 'hospital-advisor', 1: 'summary', 2: 'pattern-assessment',
	3: 'trend-analysis', 4: 'wave-chart', 5: 'timeline', 6: 'labor-guide',
};

// ── Compact wire types ─────────────────────────────────────────────

/**
 * Positional array for a contraction:
 * [id, startDelta, endDelta|null, intensity|null, locationEnum, notes, phasesCompact, flags]
 *
 * - startDelta/endDelta: ms offset from t0 (integer)
 * - locationEnum: 0=null, 1=front, 2=back, 3=wrapping
 * - phasesCompact: null or [building, peak, easing, peakOffsetSec]
 * - flags: bitmask (bit 0=untimed, bit 1=ratingDismissed)
 * - Trailing defaults are trimmed
 */
type CompactContraction = (string | number | null | (number | null)[])[];

/**
 * Positional array for an event:
 * [id, timestampDelta, typeEnum, notes?]
 */
type CompactEvent = (string | number | null)[];

/** v2 wire format */
export interface CompactV2 {
	v: 2;
	t0: number;                                  // base epoch ms
	c: CompactContraction[];                     // contractions
	e?: CompactEvent[];                          // events (omit if empty)
	p?: true;                                    // paused (omit if false)
	l?: number[];                                // layout as indices (omit if default)
	s?: Partial<ContractionTimerSettings>;       // shared settings
}

// ── Encoder ────────────────────────────────────────────────────────

/** Trim trailing null/0/"" values from a positional array.
 *  Stops at `minLength` to protect required positional fields. */
function trimTrailing(arr: unknown[], minLength = 0): unknown[] {
	let end = arr.length;
	while (end > minLength) {
		const v = arr[end - 1];
		if (v === null || v === 0 || v === '' || v === undefined) {
			end--;
		} else {
			break;
		}
	}
	return arr.slice(0, end);
}

function encodeContraction(c: Contraction, t0: number): CompactContraction {
	const startDelta = Date.parse(c.start) - t0;
	const endDelta = c.end ? Date.parse(c.end) - t0 : null;
	const locEnum = c.location ? (LOCATION_TO_NUM[c.location] ?? 0) : 0;

	let phasesCompact: (number | null)[] | null = null;
	if (c.phases) {
		phasesCompact = [
			c.phases.building,
			c.phases.peak,
			c.phases.easing,
			c.phases.peakOffsetSec ?? null,
		];
	}

	let flags = 0;
	if (c.untimed) flags |= 1;
	if (c.ratingDismissed) flags |= 2;

	const raw: unknown[] = [
		c.id,
		startDelta,
		endDelta,
		c.intensity,
		locEnum,
		c.notes || '',
		phasesCompact,
		flags,
	];

	// minLength=2: always keep id and startDelta
	return trimTrailing(raw, 2) as CompactContraction;
}

function encodeEvent(e: LaborEvent, t0: number): CompactEvent {
	const tsDelta = Date.parse(e.timestamp) - t0;
	const typeNum = EVENT_TYPE_TO_NUM[e.type] ?? 3;
	const raw: (string | number | null)[] = [e.id, tsDelta, typeNum, e.notes || ''];
	// minLength=3: always keep id, timestamp, type
	return trimTrailing(raw, 3) as CompactEvent;
}

function layoutMatchesDefault(layout: SectionId[]): boolean {
	if (layout.length !== DEFAULT_LAYOUT.length) return false;
	return layout.every((s, i) => s === DEFAULT_LAYOUT[i]);
}

/**
 * Encode session data + optional shared settings into compact v2 format.
 */
export function encodeSessionV2(
	session: SessionData,
	sharedSettings?: Partial<ContractionTimerSettings>,
): CompactV2 {
	// Determine base timestamp
	let t0: number;
	if (session.sessionStartedAt) {
		t0 = Date.parse(session.sessionStartedAt);
	} else if (session.contractions.length > 0) {
		t0 = Date.parse(session.contractions[0].start);
	} else {
		t0 = Date.now();
	}

	const result: CompactV2 = {
		v: 2,
		t0,
		c: session.contractions.map(c => encodeContraction(c, t0)),
	};

	if (session.events.length > 0) {
		result.e = session.events.map(e => encodeEvent(e, t0));
	}

	if (session.paused) {
		result.p = true;
	}

	if (!layoutMatchesDefault(session.layout)) {
		result.l = session.layout.map(s => SECTION_TO_NUM[s] ?? 0);
	}

	if (sharedSettings && Object.keys(sharedSettings).length > 0) {
		result.s = sharedSettings;
	}

	return result;
}

// ── Decoder ────────────────────────────────────────────────────────

function decodeContraction(arr: CompactContraction, t0: number): Contraction {
	const id = (arr[0] as string) ?? '';
	const startDelta = (arr[1] as number) ?? 0;
	const endDelta = arr.length > 2 ? (arr[2] as number | null) : null;
	const intensity = arr.length > 3 ? (arr[3] as number | null) : null;
	const locEnum = arr.length > 4 ? (arr[4] as number) : 0;
	const notes = arr.length > 5 ? (arr[5] as string) ?? '' : '';
	const phasesCompact = arr.length > 6 ? (arr[6] as (number | null)[] | null) : null;
	const flags = arr.length > 7 ? (arr[7] as number) : 0;

	const c: Contraction = {
		id,
		start: new Date(t0 + startDelta).toISOString(),
		end: endDelta !== null ? new Date(t0 + endDelta).toISOString() : null,
		intensity,
		location: NUM_TO_LOCATION[locEnum] ?? null,
		notes,
	};

	if (phasesCompact) {
		c.phases = {
			building: phasesCompact[0] ?? null,
			peak: phasesCompact[1] ?? null,
			easing: phasesCompact[2] ?? null,
			peakOffsetSec: phasesCompact[3] ?? undefined,
		} as ContractionPhases;
	}

	if (flags & 1) c.untimed = true;
	if (flags & 2) c.ratingDismissed = true;

	return c;
}

function decodeEvent(arr: CompactEvent, t0: number): LaborEvent {
	const id = (arr[0] as string) ?? '';
	const tsDelta = (arr[1] as number) ?? 0;
	const typeNum = (arr[2] as number) ?? 3;
	const notes = arr.length > 3 ? (arr[3] as string) ?? '' : '';

	return {
		id,
		type: NUM_TO_EVENT_TYPE[typeNum] ?? 'custom',
		timestamp: new Date(t0 + tsDelta).toISOString(),
		notes,
	};
}

/**
 * Decode compact v2 format back to session data + optional shared settings.
 */
export function decodeSessionV2(compact: CompactV2): {
	session: SessionData;
	sharedSettings?: Partial<ContractionTimerSettings>;
} {
	const t0 = compact.t0;

	const session: SessionData = {
		...EMPTY_SESSION,
		contractions: compact.c.map(c => decodeContraction(c, t0)),
		events: (compact.e ?? []).map(e => decodeEvent(e, t0)),
		sessionStartedAt: new Date(t0).toISOString(),
		layout: compact.l
			? compact.l.map(n => NUM_TO_SECTION[n] ?? 'summary')
			: [...DEFAULT_LAYOUT],
		paused: compact.p === true,
	};

	return {
		session,
		sharedSettings: compact.s,
	};
}

// ── Settings extraction / filtering ────────────────────────────────

/**
 * Extract a partial settings object containing only fields for enabled categories.
 * Used on the sender side before compression.
 */
export function extractSharedSettings(
	settings: ContractionTimerSettings,
	prefs: SharingPreferences,
): Partial<ContractionTimerSettings> | undefined {
	const result: Partial<ContractionTimerSettings> = {};
	let hasAny = false;

	if (prefs.thresholds) {
		result.threshold = settings.threshold;
		result.stageThresholds = settings.stageThresholds;
		result.bhThresholds = settings.bhThresholds;
		result.intensityScale = settings.intensityScale;
		hasAny = true;
	}

	if (prefs.provider || prefs.travel) {
		// Build hospitalAdvisor with only the enabled fields
		const ha: Partial<HospitalAdvisorConfig> = {};
		if (prefs.provider) {
			ha.providerPhone = settings.hospitalAdvisor.providerPhone;
		}
		if (prefs.travel) {
			ha.travelTimeMinutes = settings.hospitalAdvisor.travelTimeMinutes;
			ha.travelTimeUncertain = settings.hospitalAdvisor.travelTimeUncertain;
			ha.riskAppetite = settings.hospitalAdvisor.riskAppetite;
		}
		result.hospitalAdvisor = ha as HospitalAdvisorConfig;
		hasAny = true;
	}

	if (prefs.layout) {
		result.heroMode = settings.heroMode;
		hasAny = true;
	}

	if (prefs.parity) {
		result.parity = settings.parity;
		hasAny = true;
	}

	if (prefs.appearance) {
		result.theme = settings.theme;
		result.showWaveChart = settings.showWaveChart;
		result.showTimeline = settings.showTimeline;
		result.showSummaryCards = settings.showSummaryCards;
		result.showProgressionInsight = settings.showProgressionInsight;
		result.showPostRating = settings.showPostRating;
		result.showIntensityPicker = settings.showIntensityPicker;
		result.showLocationPicker = settings.showLocationPicker;
		result.timeFormat = settings.timeFormat;
		result.waveChartHeight = settings.waveChartHeight;
		result.showRestSeconds = settings.showRestSeconds;
		result.showHospitalAdvisor = settings.showHospitalAdvisor;
		result.advisorMode = settings.advisorMode;
		result.showContextualTips = settings.showContextualTips;
		result.showBraxtonHicksAssessment = settings.showBraxtonHicksAssessment;
		result.showClinicalReference = settings.showClinicalReference;
		result.showWaterBreakButton = settings.showWaterBreakButton;
		result.showThresholdRule = settings.showThresholdRule;
		result.showLiveRating = settings.showLiveRating;
		result.showChartOverlay = settings.showChartOverlay;
		result.showPrayers = settings.showPrayers;
		hasAny = true;
	}

	return hasAny ? result : undefined;
}

/**
 * Detect which sharing categories are present in a partial settings object.
 * Used on the receiver side for preview display.
 */
export function detectIncludedCategories(
	settings: Partial<ContractionTimerSettings>,
): SharingCategory[] {
	const cats: SharingCategory[] = [];

	if (settings.threshold || settings.stageThresholds || settings.bhThresholds || settings.intensityScale !== undefined) {
		cats.push('thresholds');
	}

	const ha = settings.hospitalAdvisor as Partial<HospitalAdvisorConfig> | undefined;
	if (ha?.providerPhone !== undefined) {
		cats.push('provider');
	}

	if (settings.heroMode !== undefined) {
		cats.push('layout');
	}

	if (settings.parity !== undefined) {
		cats.push('parity');
	}

	if (ha?.travelTimeMinutes !== undefined || ha?.riskAppetite !== undefined) {
		cats.push('travel');
	}

	if (settings.theme !== undefined || settings.showWaveChart !== undefined || settings.timeFormat !== undefined) {
		cats.push('appearance');
	}

	return cats;
}

/**
 * Filter a partial settings object to only include fields from checked categories.
 * Used on the receiver side to selectively apply imported settings.
 */
export function filterSettingsByCategories(
	settings: Partial<ContractionTimerSettings>,
	enabled: Record<SharingCategory, boolean>,
): Partial<ContractionTimerSettings> {
	const result: Partial<ContractionTimerSettings> = {};

	if (enabled.thresholds) {
		if (settings.threshold) result.threshold = settings.threshold;
		if (settings.stageThresholds) result.stageThresholds = settings.stageThresholds;
		if (settings.bhThresholds) result.bhThresholds = settings.bhThresholds;
		if (settings.intensityScale !== undefined) result.intensityScale = settings.intensityScale;
	}

	const ha = settings.hospitalAdvisor as Partial<HospitalAdvisorConfig> | undefined;
	if (ha && (enabled.provider || enabled.travel)) {
		const mergedHa: Partial<HospitalAdvisorConfig> = {};
		if (enabled.provider && ha.providerPhone !== undefined) {
			mergedHa.providerPhone = ha.providerPhone;
		}
		if (enabled.travel) {
			if (ha.travelTimeMinutes !== undefined) mergedHa.travelTimeMinutes = ha.travelTimeMinutes;
			if (ha.travelTimeUncertain !== undefined) mergedHa.travelTimeUncertain = ha.travelTimeUncertain;
			if (ha.riskAppetite !== undefined) mergedHa.riskAppetite = ha.riskAppetite;
		}
		if (Object.keys(mergedHa).length > 0) {
			result.hospitalAdvisor = mergedHa as HospitalAdvisorConfig;
		}
	}

	if (enabled.layout) {
		if (settings.heroMode !== undefined) result.heroMode = settings.heroMode;
	}

	if (enabled.parity) {
		if (settings.parity !== undefined) result.parity = settings.parity;
	}

	if (enabled.appearance) {
		if (settings.theme !== undefined) result.theme = settings.theme;
		if (settings.showWaveChart !== undefined) result.showWaveChart = settings.showWaveChart;
		if (settings.showTimeline !== undefined) result.showTimeline = settings.showTimeline;
		if (settings.showSummaryCards !== undefined) result.showSummaryCards = settings.showSummaryCards;
		if (settings.showProgressionInsight !== undefined) result.showProgressionInsight = settings.showProgressionInsight;
		if (settings.showPostRating !== undefined) result.showPostRating = settings.showPostRating;
		if (settings.showIntensityPicker !== undefined) result.showIntensityPicker = settings.showIntensityPicker;
		if (settings.showLocationPicker !== undefined) result.showLocationPicker = settings.showLocationPicker;
		if (settings.timeFormat !== undefined) result.timeFormat = settings.timeFormat;
		if (settings.waveChartHeight !== undefined) result.waveChartHeight = settings.waveChartHeight;
		if (settings.showRestSeconds !== undefined) result.showRestSeconds = settings.showRestSeconds;
		if (settings.showHospitalAdvisor !== undefined) result.showHospitalAdvisor = settings.showHospitalAdvisor;
		if (settings.advisorMode !== undefined) result.advisorMode = settings.advisorMode;
		if (settings.showContextualTips !== undefined) result.showContextualTips = settings.showContextualTips;
		if (settings.showBraxtonHicksAssessment !== undefined) result.showBraxtonHicksAssessment = settings.showBraxtonHicksAssessment;
		if (settings.showClinicalReference !== undefined) result.showClinicalReference = settings.showClinicalReference;
		if (settings.showWaterBreakButton !== undefined) result.showWaterBreakButton = settings.showWaterBreakButton;
		if (settings.showThresholdRule !== undefined) result.showThresholdRule = settings.showThresholdRule;
		if (settings.showLiveRating !== undefined) result.showLiveRating = settings.showLiveRating;
		if (settings.showChartOverlay !== undefined) result.showChartOverlay = settings.showChartOverlay;
		if (settings.showPrayers !== undefined) result.showPrayers = settings.showPrayers;
	}

	return result;
}
