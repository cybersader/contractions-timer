/** Per-phase intensity ratings captured live during a contraction */
export interface ContractionPhases {
	building: number | null; // (legacy) 1-5 intensity rating
	peak: number | null;     // (legacy) 1-5 intensity rating
	easing: number | null;   // (legacy) 1-5 intensity rating
	/** Seconds from contraction start to when user marked it as decreasing */
	peakOffsetSec?: number;
}

/** A single contraction event */
export interface Contraction {
	id: string;
	start: string; // ISO8601
	end: string | null; // ISO8601, null if currently active
	intensity: number | null; // 1-5 scale, null if not yet rated
	location: ContractionLocation | null;
	notes: string;
	phases?: ContractionPhases; // live 3-phase rating (opt-in)
	untimed?: boolean; // true when logged retroactively without timing
	ratingDismissed?: boolean; // true when user skipped post-contraction rating
}

export type ContractionLocation = 'front' | 'back' | 'wrapping';

/** Discrete labor events (water break, etc.) */
export interface LaborEvent {
	id: string;
	type: LaborEventType;
	timestamp: string; // ISO8601
	notes: string;
}

export type LaborEventType = 'water-break' | 'mucus-plug' | 'bloody-show' | 'custom';

/** Section IDs for reorderable collapsible panels */
export type SectionId = 'hospital-advisor' | 'summary' | 'pattern-assessment' | 'trend-analysis' | 'wave-chart' | 'timeline' | 'labor-guide';

/** Default section order */
export const DEFAULT_LAYOUT: SectionId[] = [
	'hospital-advisor',
	'summary',
	'pattern-assessment',
	'trend-analysis',
	'wave-chart',
	'timeline',
	'labor-guide',
];

/** Data stored in session */
export interface SessionData {
	contractions: Contraction[];
	events: LaborEvent[];
	sessionStartedAt: string | null;
	layout: SectionId[];
	paused: boolean;
	settingsOverrides?: Partial<ContractionTimerSettings>;
}

/** Estimated labor stage based on contraction patterns */
export type LaborStage = 'pre-labor' | 'early' | 'active' | 'transition';

/** Derived statistics for a set of contractions */
export interface SessionStats {
	totalContractions: number;
	avgDurationSec: number;
	avgIntervalMin: number;
	lastDurationSec: number;
	lastIntervalMin: number;
	rule511Met: boolean;
	rule511MetAt: string | null; // ISO8601
	rule511Progress: {
		intervalOk: boolean;
		intervalValue: number; // actual avg interval in minutes
		durationOk: boolean;
		durationValue: number; // actual avg duration in seconds
		sustainedOk: boolean;
		sustainedValue: number; // actual span in minutes
	};
	laborStage: LaborStage | null;
}

/** Clinical threshold configuration */
export interface ThresholdConfig {
	intervalMinutes: number; // Default 5
	durationSeconds: number; // Default 60
	sustainedMinutes: number; // Default 60
}

/** Configurable thresholds for Braxton Hicks assessment */
export interface BHThresholdConfig {
	regularityCVLow: number;        // 0.3 — below = "regular"
	regularityCVHigh: number;       // 0.6 — above = "irregular"
	locationRatioHigh: number;      // 0.5 — above = back/wrapping dominant
	locationRatioLow: number;       // 0.2 — below = mostly front
	sustainedMinMinutes: number;    // 120 — minimum span for "sustained"
	sustainedMaxGapMinutes: number; // 30 — max gap within sustained session
	verdictRealThreshold: number;   // 60 — score above = likely real labor
	verdictBHThreshold: number;     // 30 — score below = likely BH
}

export const DEFAULT_BH_THRESHOLDS: BHThresholdConfig = {
	regularityCVLow: 0.3,
	regularityCVHigh: 0.6,
	locationRatioHigh: 0.5,
	locationRatioLow: 0.2,
	sustainedMinMinutes: 120,
	sustainedMaxGapMinutes: 30,
	verdictRealThreshold: 60,
	verdictBHThreshold: 30,
};

/** Timer phase for UI state */
export type TimerPhase = 'idle' | 'contracting' | 'resting';

/** Linear regression trend result */
export interface TrendResult {
	slope: number;
	firstValue: number;
	lastValue: number;
	direction: 'increasing' | 'decreasing' | 'stable';
}

/** Configurable thresholds for each labor stage */
export interface StageThresholdConfig {
	maxIntervalMin: number;
	minDurationSec: number;
	/** Evidence-based duration range in minutes [lower, upper] — first-time mother (nulliparous) */
	typicalDurationFirstMin: [number, number];
	/** Evidence-based duration range in minutes [lower, upper] — subsequent pregnancy (multiparous) */
	typicalDurationSubsequentMin: [number, number];
	location: string; // 'Home' or 'Hospital'
	/** Stage description shown in labor guide reference table */
	description: string;
	/** Cervix dilation range shown in labor guide reference table */
	cervix: string;
	/** Expected contraction pattern description */
	contractionPattern: string;
}

/** Water break population statistics (editable) */
export interface WaterBreakStats {
	beforeContractions: string;
	duringLabor: string;
	laborWithin12Hours: string;
	laborWithin24Hours: string;
}

/** Pregnancy parity — affects duration expectations */
export type Parity = 'first-baby' | 'subsequent';

/** Hospital departure advisor configuration */
export interface HospitalAdvisorConfig {
	travelTimeMinutes: number;
	travelTimeUncertain: boolean;
	riskAppetite: 'conservative' | 'moderate' | 'relaxed';
	providerPhone: string;
}

/** Hero display mode */
export type HeroMode = 'stage-badge' | 'action-card' | 'compact-timer';

/** Hospital advisor display mode */
export type AdvisorMode = 'range' | 'urgency' | 'minimal';

/** Progression rate assumption */
export type ProgressionRate = 'slower' | 'average' | 'faster';

/** Plugin settings */
export interface ContractionTimerSettings {
	threshold: ThresholdConfig;
	heroMode: HeroMode;
	intensityScale: 3 | 5;
	showWaveChart: boolean;
	showTimeline: boolean;
	showSummaryCards: boolean;
	showProgressionInsight: boolean;
	showPostRating: boolean;
	showIntensityPicker: boolean;
	showLocationPicker: boolean;
	timeFormat: '12h' | '24h';
	showRestSeconds: boolean;
	waveChartHeight: number;
	theme: 'auto' | 'calming' | 'clinical';
	hapticFeedback: boolean;
	enableDebugLog: boolean;
	// Pregnancy parity (affects duration expectations)
	parity: Parity;
	// Stage estimation thresholds
	stageThresholds: Record<string, StageThresholdConfig>;
	// Hospital advisor
	hospitalAdvisor: HospitalAdvisorConfig;
	showHospitalAdvisor: boolean;
	advisorMode: AdvisorMode;
	advisorProgressionRate: ProgressionRate;
	// New feature toggles
	showContextualTips: boolean;
	showBraxtonHicksAssessment: boolean;
	showClinicalReference: boolean;
	showWaterBreakButton: boolean;
	showThresholdRule: boolean;
	// Clinical reference data (editable)
	waterBreakStats: WaterBreakStats;
	// Advanced
	showLiveRating: boolean;
	// Behavior
	persistPause: boolean;
	/** Whether stage duration uses last recorded contraction or current clock time */
	stageTimeBasis: 'last-recorded' | 'current-time';
	// Chart
	chartGapThresholdMin: number;
	showChartOverlay: boolean;
	// Pattern assessment thresholds
	bhThresholds: BHThresholdConfig;
}

/** Evidence-based defaults: Zhang et al. 2010, ACOG 2024 */
export const DEFAULT_STAGE_THRESHOLDS: Record<string, StageThresholdConfig> = {
	transition: {
		maxIntervalMin: 3,
		minDurationSec: 60,
		typicalDurationFirstMin: [30, 120],
		typicalDurationSubsequentMin: [15, 90],
		location: 'Hospital',
		description: 'Most intense phase, approaching full dilation',
		cervix: '8\u201310 cm dilated',
		contractionPattern: '60-90s long, 1-3 min apart',
	},
	active: {
		maxIntervalMin: 5,
		minDurationSec: 45,
		typicalDurationFirstMin: [60, 360],
		typicalDurationSubsequentMin: [30, 240],
		location: 'Hospital',
		description: 'Strong, regular contractions with steady progress',
		cervix: '6\u201310 cm dilated',
		contractionPattern: '45-60s long, 3-5 min apart',
	},
	early: {
		maxIntervalMin: 30,
		minDurationSec: 30,
		typicalDurationFirstMin: [600, 1260],
		typicalDurationSubsequentMin: [360, 840],
		location: 'Home',
		description: 'Regular contractions establishing a pattern',
		cervix: '0\u20136 cm dilated',
		contractionPattern: '30-45s long, 5-30 min apart',
	},
	'pre-labor': {
		maxIntervalMin: Infinity,
		minDurationSec: 0,
		typicalDurationFirstMin: [0, 0],
		typicalDurationSubsequentMin: [0, 0],
		location: 'Home',
		description: 'Irregular contractions that may start and stop',
		cervix: 'Minimal change',
		contractionPattern: 'Irregular, may stop with rest or movement',
	},
};

export const DEFAULT_SETTINGS: ContractionTimerSettings = {
	threshold: {
		intervalMinutes: 5,
		durationSeconds: 60,
		sustainedMinutes: 60,
	},
	parity: 'first-baby',
	heroMode: 'stage-badge',
	intensityScale: 5,
	showWaveChart: true,
	showTimeline: true,
	showSummaryCards: true,
	showProgressionInsight: true,
	showPostRating: true,
	showIntensityPicker: true,
	showLocationPicker: true,
	timeFormat: '12h',
	showRestSeconds: false,
	waveChartHeight: 150,
	theme: 'auto',
	hapticFeedback: true,
	enableDebugLog: false,
	stageThresholds: { ...DEFAULT_STAGE_THRESHOLDS },
	hospitalAdvisor: {
		travelTimeMinutes: 30,
		travelTimeUncertain: false,
		riskAppetite: 'moderate',
		providerPhone: '',
	},
	showHospitalAdvisor: true,
	advisorMode: 'range',
	advisorProgressionRate: 'slower',
	showContextualTips: true,
	showBraxtonHicksAssessment: true,
	showClinicalReference: true,
	showWaterBreakButton: true,
	showThresholdRule: true,
	waterBreakStats: {
		beforeContractions: '8-15%',
		duringLabor: '~90%',
		laborWithin12Hours: '45%',
		laborWithin24Hours: '77-95%',
	},
	showLiveRating: false,
	persistPause: true,
	stageTimeBasis: 'last-recorded',
	chartGapThresholdMin: 30,
	showChartOverlay: false,
	bhThresholds: { ...DEFAULT_BH_THRESHOLDS },
};

/** Empty session data */
export const EMPTY_SESSION: SessionData = {
	contractions: [],
	events: [],
	sessionStartedAt: null,
	layout: [...DEFAULT_LAYOUT],
	paused: false,
};
