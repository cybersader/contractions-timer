import type { Contraction, LaborEvent, LaborStage } from './types';

export type TipCategory = 'comfort' | 'timing' | 'safety' | 'education' | 'action';

export type TipTrigger =
	| { type: 'stage'; stage: LaborStage }
	| { type: 'stage-entered'; stage: LaborStage }
	| { type: 'event'; event: string }
	| { type: 'time-of-day'; period: 'night' | 'day' }
	| { type: 'contraction-count'; min: number; max?: number }
	| { type: 'pattern'; condition: string };

export interface ClinicalTip {
	id: string;
	textKey: string;
	category: TipCategory;
	trigger: TipTrigger;
}

export const CLINICAL_TIPS: ClinicalTip[] = [
	{ id: 'first-contraction', textKey: 'clinical.tips.firstContraction', category: 'education', trigger: { type: 'contraction-count', min: 1, max: 2 } },
	{ id: 'prelabor-normal', textKey: 'clinical.tips.prelaborNormal', category: 'education', trigger: { type: 'stage', stage: 'pre-labor' } },
	{ id: 'early-rest', textKey: 'clinical.tips.earlyRest', category: 'comfort', trigger: { type: 'stage', stage: 'early' } },
	{ id: 'early-hydrate', textKey: 'clinical.tips.earlyHydrate', category: 'comfort', trigger: { type: 'stage', stage: 'early' } },
	{ id: 'early-activity', textKey: 'clinical.tips.earlyActivity', category: 'comfort', trigger: { type: 'stage', stage: 'early' } },
	{ id: 'early-timing', textKey: 'clinical.tips.earlyTiming', category: 'timing', trigger: { type: 'stage', stage: 'early' } },
	{ id: 'active-entered', textKey: 'clinical.tips.activeEntered', category: 'action', trigger: { type: 'stage-entered', stage: 'active' } },
	{ id: 'active-breathing', textKey: 'clinical.tips.activeBreathing', category: 'comfort', trigger: { type: 'stage', stage: 'active' } },
	{ id: 'active-duration', textKey: 'clinical.tips.activeDuration', category: 'education', trigger: { type: 'stage', stage: 'active' } },
	{ id: 'transition-entered', textKey: 'clinical.tips.transitionEntered', category: 'education', trigger: { type: 'stage-entered', stage: 'transition' } },
	{ id: 'transition-normal', textKey: 'clinical.tips.transitionNormal', category: 'comfort', trigger: { type: 'stage', stage: 'transition' } },
	{ id: 'water-note-color', textKey: 'clinical.tips.waterNoteColor', category: 'safety', trigger: { type: 'event', event: 'water-break' } },
	{ id: 'water-call-provider', textKey: 'clinical.tips.waterCallProvider', category: 'action', trigger: { type: 'event', event: 'water-break' } },
	{ id: 'water-stats', textKey: 'clinical.tips.waterStats', category: 'education', trigger: { type: 'event', event: 'water-break' } },
	{ id: 'night-sleep', textKey: 'clinical.tips.nightSleep', category: 'comfort', trigger: { type: 'time-of-day', period: 'night' } },
	{ id: 'back-labor', textKey: 'clinical.tips.backLabor', category: 'comfort', trigger: { type: 'pattern', condition: 'back-labor' } },
	{ id: 'safety-call', textKey: 'clinical.tips.safetyCall', category: 'safety', trigger: { type: 'contraction-count', min: 1 } },
	{ id: 'pattern-regular', textKey: 'clinical.tips.patternRegular', category: 'education', trigger: { type: 'pattern', condition: 'regular' } },
];

export const STAGE_REFERENCE: Record<string, { descriptionKey: string; cervixKey: string; patternKey: string; locationKey: string }> = {
	'pre-labor': {
		descriptionKey: 'hospital.clinicalReference.stages.preLabor.description',
		cervixKey: 'hospital.clinicalReference.stages.preLabor.cervix',
		patternKey: 'hospital.clinicalReference.stages.preLabor.pattern',
		locationKey: 'hospital.clinicalReference.stages.preLabor.location',
	},
	early: {
		descriptionKey: 'hospital.clinicalReference.stages.early.description',
		cervixKey: 'hospital.clinicalReference.stages.early.cervix',
		patternKey: 'hospital.clinicalReference.stages.early.pattern',
		locationKey: 'hospital.clinicalReference.stages.early.location',
	},
	active: {
		descriptionKey: 'hospital.clinicalReference.stages.active.description',
		cervixKey: 'hospital.clinicalReference.stages.active.cervix',
		patternKey: 'hospital.clinicalReference.stages.active.pattern',
		locationKey: 'hospital.clinicalReference.stages.active.location',
	},
	transition: {
		descriptionKey: 'hospital.clinicalReference.stages.transition.description',
		cervixKey: 'hospital.clinicalReference.stages.transition.cervix',
		patternKey: 'hospital.clinicalReference.stages.transition.pattern',
		locationKey: 'hospital.clinicalReference.stages.transition.location',
	},
};

export const WATER_BREAK_STATS = {
	beforeContractions: '8-15%',
	duringLabor: '~90%',
	laborWithin12Hours: '45%',
	laborWithin24Hours: '77-95%',
};

export const CLINICAL_SOURCES: Record<string, { label: string; url: string }> = {
	'zhang-2010': { label: 'Zhang et al. 2010 \u2014 Consortium on Safe Labor (62,415 births)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3660040/' },
	'acog-2024': { label: 'ACOG Clinical Practice Guideline No. 8 (2024)', url: 'https://www.acog.org/clinical/clinical-guidance/clinical-practice-guideline/articles/2024/01/first-and-second-stage-labor-management' },
	'statpearls-prom': { label: 'StatPearls \u2014 Premature Rupture of Membranes (NCBI)', url: 'https://www.ncbi.nlm.nih.gov/books/NBK532888/' },
	'statpearls-bh': { label: 'StatPearls \u2014 Braxton Hicks Contractions (NCBI)', url: 'https://www.ncbi.nlm.nih.gov/books/NBK470546/' },
	'cleveland-clinic': { label: 'Cleveland Clinic \u2014 Water Breaking', url: 'https://my.clevelandclinic.org/health/symptoms/water-breaking' },
};

export const BH_VS_REAL = {
	braxtonHicks: [
		'clinical.bhVsReal.bh.irregularTiming',
		'clinical.bhVsReal.bh.notCloser',
		'clinical.bhVsReal.bh.stopWithMovement',
		'clinical.bhVsReal.bh.frontOnly',
		'clinical.bhVsReal.bh.notStronger',
	],
	realLabor: [
		'clinical.bhVsReal.real.regularCloser',
		'clinical.bhVsReal.real.keepComing',
		'clinical.bhVsReal.real.noStop',
		'clinical.bhVsReal.real.radiateBack',
		'clinical.bhVsReal.real.progressive',
	],
};

export function getRelevantTips(
	contractions: Contraction[],
	events: LaborEvent[],
	currentStage: LaborStage | null,
	previousStage: LaborStage | null
): ClinicalTip[] {
	const completed = contractions.filter(c => c.end !== null);
	const hasWaterBreak = events.some(e => e.type === 'water-break');
	const hour = new Date().getHours();
	const isNight = hour >= 22 || hour < 6;
	const stageJustChanged = currentStage !== null && currentStage !== previousStage;

	const locationsWithData = completed.filter(c => c.location !== null);
	const backCount = locationsWithData.filter(c => c.location === 'back' || c.location === 'wrapping').length;
	const isBackLabor = locationsWithData.length >= 3 && backCount / locationsWithData.length > 0.5;

	let isRegular = false;
	if (completed.length >= 4) {
		const intervals: number[] = [];
		for (let i = 1; i < completed.length; i++) {
			const diff = (new Date(completed[i].start).getTime() - new Date(completed[i - 1].start).getTime()) / 60000;
			intervals.push(diff);
		}
		const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
		const variance = intervals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / intervals.length;
		const cv = mean > 0 ? Math.sqrt(variance) / mean : Infinity;
		isRegular = cv < 0.3;
	}

	const dismissedKey = 'ct-dismissed-tips';
	let dismissed: string[] = [];
	try {
		const stored = localStorage.getItem(dismissedKey);
		if (stored) dismissed = JSON.parse(stored);
	} catch { /* ignore */ }

	const candidates = CLINICAL_TIPS.filter(tip => {
		if (dismissed.includes(tip.id)) return false;
		const trigger = tip.trigger;
		switch (trigger.type) {
			case 'stage': return currentStage === trigger.stage;
			case 'stage-entered': return stageJustChanged && currentStage === trigger.stage;
			case 'event': return trigger.event === 'water-break' && hasWaterBreak;
			case 'time-of-day': return trigger.period === 'night' ? isNight : !isNight;
			case 'contraction-count': {
				const count = completed.length;
				if (count < trigger.min) return false;
				if (trigger.max !== undefined && count > trigger.max) return false;
				return true;
			}
			case 'pattern':
				if (trigger.condition === 'back-labor') return isBackLabor;
				if (trigger.condition === 'regular') return isRegular;
				return false;
			default: return false;
		}
	});

	const priority: Record<TipCategory, number> = { safety: 0, action: 1, timing: 2, comfort: 3, education: 4 };
	candidates.sort((a, b) => priority[a.category] - priority[b.category]);

	return candidates.slice(0, 2);
}

export function getRelevantTipCount(
	contractions: Contraction[],
	events: LaborEvent[],
	currentStage: LaborStage | null
): number {
	return getRelevantTips(contractions, events, currentStage, null).length;
}

export function dismissTip(tipId: string): void {
	const key = 'ct-dismissed-tips';
	let dismissed: string[] = [];
	try {
		const stored = localStorage.getItem(key);
		if (stored) dismissed = JSON.parse(stored);
	} catch { /* ignore */ }
	if (!dismissed.includes(tipId)) {
		dismissed.push(tipId);
		localStorage.setItem(key, JSON.stringify(dismissed));
	}
}
