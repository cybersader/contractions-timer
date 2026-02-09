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
	text: string;
	category: TipCategory;
	trigger: TipTrigger;
}

export const CLINICAL_TIPS: ClinicalTip[] = [
	{ id: 'first-contraction', text: 'Great start! Keep timing contractions to see if a pattern develops. Most first labors start slowly.', category: 'education', trigger: { type: 'contraction-count', min: 1, max: 2 } },
	{ id: 'prelabor-normal', text: 'Irregular contractions are normal and can come and go for days. If they stop when you move or rest, it may be Braxton Hicks.', category: 'education', trigger: { type: 'stage', stage: 'pre-labor' } },
	{ id: 'early-rest', text: 'Early labor can last 6-12+ hours for first-time parents. Try to rest, especially if it is nighttime.', category: 'comfort', trigger: { type: 'stage', stage: 'early' } },
	{ id: 'early-hydrate', text: 'Stay hydrated and eat light snacks. You will need the energy for active labor.', category: 'comfort', trigger: { type: 'stage', stage: 'early' } },
	{ id: 'early-activity', text: 'Light activity like walking can help labor progress during the day.', category: 'comfort', trigger: { type: 'stage', stage: 'early' } },
	{ id: 'early-timing', text: 'You are likely still at home during early labor. Head to the hospital when contractions reach the 5-1-1 pattern.', category: 'timing', trigger: { type: 'stage', stage: 'early' } },
	{ id: 'active-entered', text: 'Active labor means steady progress. If you are not at the hospital yet, it is time to go.', category: 'action', trigger: { type: 'stage-entered', stage: 'active' } },
	{ id: 'active-breathing', text: 'Focus on slow, deep breathing through each contraction. In through the nose, out through the mouth.', category: 'comfort', trigger: { type: 'stage', stage: 'active' } },
	{ id: 'active-duration', text: 'Active labor typically lasts 3-5 hours for first-time parents. You are making real progress.', category: 'education', trigger: { type: 'stage', stage: 'active' } },
	{ id: 'transition-entered', text: 'Transition is the shortest but most intense phase. You are almost there.', category: 'education', trigger: { type: 'stage-entered', stage: 'transition' } },
	{ id: 'transition-normal', text: 'Feeling overwhelmed, nauseous, or shaky is normal during transition. It typically lasts 30 minutes to 2 hours.', category: 'comfort', trigger: { type: 'stage', stage: 'transition' } },
	{ id: 'water-note-color', text: 'Note the color of the fluid. Clear or pale yellow is normal. Green or brown means call your provider immediately.', category: 'safety', trigger: { type: 'event', event: 'water-break' } },
	{ id: 'water-call-provider', text: 'Contact your provider to let them know your water broke. They will advise on next steps.', category: 'action', trigger: { type: 'event', event: 'water-break' } },
	{ id: 'water-stats', text: '77-95% of people go into active labor within 24 hours of their water breaking.', category: 'education', trigger: { type: 'event', event: 'water-break' } },
	{ id: 'night-sleep', text: 'Try to sleep between contractions if possible. Rest now will help you through active labor later.', category: 'comfort', trigger: { type: 'time-of-day', period: 'night' } },
	{ id: 'back-labor', text: 'Back labor can be eased by hands-and-knees position, hip squeezes, or a warm compress on your lower back.', category: 'comfort', trigger: { type: 'pattern', condition: 'back-labor' } },
	{ id: 'safety-call', text: 'Call your provider immediately if: heavy bleeding, baby stops moving, severe headache with vision changes, or fever above 100.4\u00B0F.', category: 'safety', trigger: { type: 'contraction-count', min: 1 } },
	{ id: 'pattern-regular', text: 'Your contractions are becoming more regular. This is a good sign that labor is progressing.', category: 'education', trigger: { type: 'pattern', condition: 'regular' } },
];

export const STAGE_REFERENCE: Record<string, { description: string; cervix: string; contractionPattern: string; location: string }> = {
	'pre-labor': { description: 'Irregular contractions that may start and stop', cervix: 'Minimal change', contractionPattern: 'Irregular, may stop with rest or movement', location: 'Home' },
	early: { description: 'Regular contractions establishing a pattern', cervix: '0\u20136 cm dilated', contractionPattern: '30-45s long, 5-30 min apart', location: 'Home' },
	active: { description: 'Strong, regular contractions with steady progress', cervix: '6\u201310 cm dilated', contractionPattern: '45-60s long, 3-5 min apart', location: 'Hospital' },
	transition: { description: 'Most intense phase, approaching full dilation', cervix: '8\u201310 cm dilated', contractionPattern: '60-90s long, 1-3 min apart', location: 'Hospital' },
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
	braxtonHicks: ['Irregular timing', 'Do not get closer together', 'Stop with movement or position change', 'Felt mainly in front', 'Do not get stronger over time'],
	realLabor: ['Regular timing, getting closer', 'Keep coming regardless of activity', 'Do not stop with rest or movement', 'Radiate from back or wrap around', 'Get progressively stronger'],
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
