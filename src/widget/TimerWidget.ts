import { MarkdownRenderChild, MarkdownPostProcessorContext } from 'obsidian';
import type { Contraction, ContractionLocation, LaborEvent, LaborEventType, LaborStage, SessionData, TimerPhase, ContractionTimerSettings, SectionId } from '../types';
import { CodeBlockStore } from '../data/CodeBlockStore';
import { isContractionActive, getElapsedSeconds, getDurationSeconds, getRestSeconds, getSessionStats, getTimeInCurrentStage, estimateTimeTo511 } from '../data/calculations';
import { generateId } from '../utils/formatters';
import { BigButton } from './BigButton';
import { TimerDisplay } from './TimerDisplay';
import { HeroStage } from './HeroStage';
import { HeroAction } from './HeroAction';
import { HeroCompactTimer } from './HeroCompactTimer';
import { IntensityPicker } from './IntensityPicker';
import { LocationPicker } from './LocationPicker';
import { SessionControls } from './SessionControls';
import { CollapsibleSection } from './CollapsibleSection';
import { EventButtons } from './EventButtons';
import { UntimedPicker } from './UntimedPicker';
import { ContextualTips } from './ContextualTips';
import { LiveRatingOverlay } from './LiveRatingOverlay';
import { WaveChart } from '../visualization/WaveChart';
import { SummaryCards } from '../visualization/SummaryCards';
import { TimelineTable } from '../visualization/TimelineTable';
import { ProgressionInsight } from '../visualization/ProgressionInsight';
import { HospitalAdvisorPanel } from '../visualization/HospitalAdvisorPanel';
import { StageDurationBar } from '../visualization/StageDurationBar';
import { BraxtonHicksPanel } from '../visualization/BraxtonHicksPanel';
import { ClinicalReference } from '../visualization/ClinicalReference';
import { WaterBreakInfo } from '../visualization/WaterBreakInfo';
import { getDepartureAdvice, getRangeEstimate } from '../data/hospitalAdvisor';
import { assessBraxtonHicks } from '../data/braxtonHicksAssessment';
import { getRelevantTips } from '../data/clinicalData';
import { deepMerge } from '../utils/deepMerge';
import type ContractionTimerPlugin from '../main';

/** Maps section IDs to their display names and default-expanded state */
const SECTION_META: Record<SectionId, { title: string; defaultExpanded: boolean }> = {
	'hospital-advisor':    { title: 'Hospital advisor',    defaultExpanded: true },
	'summary':             { title: 'Summary',             defaultExpanded: true },
	'pattern-assessment':  { title: 'Pattern assessment',  defaultExpanded: true },
	'trend-analysis':      { title: 'Trend analysis',      defaultExpanded: false },
	'wave-chart':          { title: 'Wave chart',          defaultExpanded: true },
	'timeline':            { title: 'History',             defaultExpanded: false },
	'labor-guide':         { title: 'Labor guide',         defaultExpanded: false },
};

/** Maps section IDs to the settings toggle that controls visibility */
const SECTION_TOGGLE: Record<SectionId, keyof ContractionTimerSettings> = {
	'hospital-advisor':   'showHospitalAdvisor',
	'summary':            'showSummaryCards',
	'pattern-assessment': 'showBraxtonHicksAssessment',
	'trend-analysis':     'showProgressionInsight',
	'wave-chart':         'showWaveChart',
	'timeline':           'showTimeline',
	'labor-guide':        'showClinicalReference',
};

/**
 * The main inline timer widget rendered inside a contraction-timer code block.
 * Extends MarkdownRenderChild for proper lifecycle management.
 */
export class TimerWidget extends MarkdownRenderChild {
	private plugin: ContractionTimerPlugin;
	private data: SessionData;
	private ctx: MarkdownPostProcessorContext;
	private store: CodeBlockStore;
	private settings: ContractionTimerSettings;

	// UI components
	private timerDisplay!: TimerDisplay;
	private bigButton!: BigButton;
	private intensityPicker!: IntensityPicker;
	private locationPicker!: LocationPicker;
	private sessionControls!: SessionControls;
	private waveChart!: WaveChart;
	private summaryCards!: SummaryCards;
	private timelineTable!: TimelineTable;
	private progressionInsight!: ProgressionInsight;

	// Hero component (one of 3 modes)
	private hero: HeroStage | HeroAction | HeroCompactTimer | null = null;

	// New components
	private eventButtons: EventButtons | null = null;
	private untimedPicker: UntimedPicker | null = null;
	private contextualTips: ContextualTips | null = null;
	private hospitalAdvisorPanel: HospitalAdvisorPanel | null = null;
	private hospitalCollapsible: CollapsibleSection | null = null;
	private stageDurationBar: StageDurationBar | null = null;
	private braxtonHicksPanel: BraxtonHicksPanel | null = null;
	private clinicalReference: ClinicalReference | null = null;
	private waterBreakInfo: WaterBreakInfo | null = null;
	private liveRating: LiveRatingOverlay | null = null;

	// Pending picker state (buffered until Save)
	private pendingIntensity: number | null = null;
	private pendingLocation: ContractionLocation | null = null;
	private skipBtn: HTMLButtonElement | null = null;
	private saveCancelWrap: HTMLElement | null = null;

	// Layout
	private sectionsContainer!: HTMLElement;
	private sectionCollapsibles: Map<SectionId, CollapsibleSection> = new Map();

	// State
	private phase: TimerPhase = 'idle';
	private paused = false;
	private saving = false;
	private previousStage: LaborStage | null = null;

	constructor(
		containerEl: HTMLElement,
		plugin: ContractionTimerPlugin,
		data: SessionData,
		ctx: MarkdownPostProcessorContext
	) {
		super(containerEl);
		this.plugin = plugin;
		this.data = data;
		this.ctx = ctx;
		this.store = new CodeBlockStore(plugin.app);
		// Code block overrides win over plugin settings (deep merge for nested objects)
		this.settings = data.settingsOverrides
			? deepMerge(plugin.settings, data.settingsOverrides as Record<string, unknown>)
			: plugin.settings;
	}

	onload(): void {
		const root = this.containerEl;
		root.empty();
		root.addClass('ct-widget');

		// Determine initial phase
		this.phase = this.determinePhase();

		// Build the UI
		this.buildUI(root);

		// Restore persisted pause state
		if (this.settings.persistPause && this.data.paused && this.phase === 'resting') {
			this.handlePause(true);
		}

		// Restore scroll position after a section move triggered re-render
		const scrollTarget = localStorage.getItem('ct-scroll-after-move') as SectionId | null;
		if (scrollTarget) {
			localStorage.removeItem('ct-scroll-after-move');
			requestAnimationFrame(() => this.scrollToSection(scrollTarget));
		}

		// Start the update loop
		this.registerInterval(
			window.setInterval(() => this.tick(), 200)
		);
	}

	private determinePhase(): TimerPhase {
		const active = this.data.contractions.find(isContractionActive);
		if (active) return 'contracting';
		if (this.data.contractions.length > 0) return 'resting';
		return 'idle';
	}

	private buildUI(root: HTMLElement): void {
		// === Fixed top: Hero, Timer, Button, Events, Pickers, Tips ===

		// 0. Hero element (based on heroMode setting)
		switch (this.settings.heroMode) {
			case 'stage-badge':
				this.hero = new HeroStage(root, this.settings.stageThresholds, this.settings.parity);
				break;
			case 'action-card': {
				const actionHero = new HeroAction(root);
				actionHero.setHospitalClickCallback(() => this.scrollToSection('hospital-advisor'));
				this.hero = actionHero;
				break;
			}
			case 'compact-timer': {
				const compactHero = new HeroCompactTimer(root);
				compactHero.showRestSeconds = this.settings.showRestSeconds;
				this.hero = compactHero;
				break;
			}
		}
		this.updateHero();

		// 1. Timer display (with hover-to-pause)
		this.timerDisplay = new TimerDisplay(root);
		this.timerDisplay.showRestSeconds = this.settings.showRestSeconds;
		this.timerDisplay.setPauseCallback((paused) => this.handlePause(paused));

		// 2. Untimed confirmation area (appears above button row when a missed contraction is logged)
		const untimedConfirmArea = root.createDiv();

		// 3. Big button row: [Had one] [Start contraction] [Peak ▲]
		const buttonRow = root.createDiv({ cls: 'ct-button-row' });

		// "Had one" picker (left of BigButton)
		this.untimedPicker = new UntimedPicker(
			buttonRow, untimedConfirmArea,
			{
				onLog: (minutesAgo) => this.logUntimedContraction(minutesAgo),
				onUndo: () => this.undoLastUntimed(),
				onIntensity: (level) => this.setUntimedIntensity(level),
				onStateChange: (state) => {
					if (state === 'picking') {
						this.bigButton.getEl().addClass('ct-hidden');
						if (this.liveRating) (this.liveRating as any).el?.addClass?.('ct-hidden');
					} else {
						this.bigButton.getEl().removeClass('ct-hidden');
					}
				},
			},
			this.settings.hapticFeedback
		);
		// Hide "Had one" during contracting
		if (this.phase === 'contracting') {
			this.untimedPicker.setVisible(false);
		}

		this.bigButton = new BigButton(
			buttonRow,
			() => this.startContraction(),
			() => this.stopContraction(),
			this.settings.hapticFeedback
		);
		this.bigButton.setPhase(this.phase);
		this.bigButton.setNextNumber(this.data.contractions.length + 1);

		// 3b. Live rating (inline to the right of Stop button during contractions)
		if (this.settings.showLiveRating) {
			this.liveRating = new LiveRatingOverlay(buttonRow, this.settings.hapticFeedback);
			this.liveRating.setCallback((phases) => this.handleLiveRating(phases));
			if (this.phase === 'contracting') {
				const active = this.data.contractions.find(isContractionActive);
				if (active?.phases?.peakOffsetSec != null) {
					// Peak already marked before re-render — stay hidden
				} else {
					this.liveRating.begin();
				}
			}
		}

		// 4. Event buttons (water break only)
		if (this.settings.showWaterBreakButton) {
			this.eventButtons = new EventButtons(
				root,
				(type) => this.recordEventByType(type)
			);
			this.eventButtons.setUndoCallback((type) => this.undoEvent(type));
			this.eventButtons.setEditTimeCallback((type, minutesAgo) => this.editWaterBreakTime(type, minutesAgo));
			this.eventButtons.updateFromEvents(this.data.events);

			// Water break info (shown if water already broke)
			const waterEvent = this.data.events.find(e => e.type === 'water-break');
			if (waterEvent) {
				this.waterBreakInfo = new WaterBreakInfo(root, this.settings.hospitalAdvisor.providerPhone, this.settings.waterBreakStats);
				this.wireWaterBreakPhoneSave();
				this.waterBreakInfo.update(this.data.events, this.data.contractions);
			}
		}

		// 4. Post-contraction pickers (guarded by showPostRating master toggle)
		if (this.settings.showPostRating) {
			const pickerArea = root.createDiv({ cls: 'ct-picker-area ct-hidden' });
			const rateHeader = pickerArea.createDiv({ cls: 'ct-rate-header' });
			rateHeader.createSpan({ cls: 'ct-rate-prompt-text', text: 'Rate this contraction' });

			// Skip button (shown when nothing selected)
			this.skipBtn = rateHeader.createEl('button', { cls: 'ct-rate-skip', text: 'Skip' });
			this.skipBtn.addEventListener('click', () => this.skipRating());

			// Save / Cancel buttons (shown when something selected)
			this.saveCancelWrap = rateHeader.createDiv({ cls: 'ct-rate-actions ct-hidden' });
			const saveBtn = this.saveCancelWrap.createEl('button', { cls: 'ct-rate-save', text: 'Save' });
			const cancelBtn = this.saveCancelWrap.createEl('button', { cls: 'ct-rate-cancel', text: 'Cancel' });
			saveBtn.addEventListener('click', () => this.saveRating());
			cancelBtn.addEventListener('click', () => this.cancelRating());

			if (this.settings.showIntensityPicker) {
				this.intensityPicker = new IntensityPicker(
					pickerArea,
					(level) => this.bufferIntensity(level),
					this.settings.intensityScale,
					this.settings.hapticFeedback
				);
			}

			if (this.settings.showLocationPicker) {
				this.locationPicker = new LocationPicker(
					pickerArea,
					(loc) => this.bufferLocation(loc),
					this.settings.hapticFeedback
				);
			}

			// Show pickers if resting and last contraction still needs rating
			// (visible until both are set OR user clicks Skip)
			if (this.phase === 'resting') {
				const last = this.getLastCompletedContraction();
				if (last && !last.ratingDismissed && (last.intensity === null || last.location === null)) {
					pickerArea.removeClass('ct-hidden');
					if (this.intensityPicker) this.intensityPicker.show(last.intensity);
					if (this.locationPicker) this.locationPicker.show(last.location);
					// If already partially rated, show as pending
					if (last.intensity !== null || last.location !== null) {
						this.pendingIntensity = last.intensity;
						this.pendingLocation = last.location;
						this.showSaveCancelButtons();
					}
				}
			}
		}

		// 5. Contextual tips
		if (this.settings.showContextualTips) {
			this.contextualTips = new ContextualTips(root);
			this.updateContextualTips();
		}

		// === Reorderable sections container ===
		this.sectionsContainer = root.createDiv({ cls: 'ct-sections' });
		this.buildSections();

		// === Fixed bottom: Session controls ===
		this.sessionControls = new SessionControls(
			root,
			() => this.clearAll(),
			() => this.deleteLast(),
			(paused) => this.handlePause(paused)
		);
		this.sessionControls.setVisible(this.data.contractions.length > 0);
		this.sessionControls.setPauseEnabled(this.phase !== 'contracting');
	}

	/** Build collapsible sections in layout order with move controls. */
	private buildSections(): void {
		this.sectionCollapsibles.clear();
		this.sectionsContainer.empty();

		// Only include sections that are enabled in settings
		const activeLayout = this.data.layout.filter(id => this.settings[SECTION_TOGGLE[id]]);

		for (const sectionId of activeLayout) {
			const meta = SECTION_META[sectionId];
			const collapsible = new CollapsibleSection(
				this.sectionsContainer,
				meta.title,
				sectionId,
				meta.defaultExpanded
			);

			// Wire move controls (buttons + drag)
			collapsible.enableMove(
				() => this.moveSection(sectionId, -1),
				() => this.moveSection(sectionId, 1)
			);
			collapsible.enableDrag((direction) => this.moveSection(sectionId, direction));

			this.sectionCollapsibles.set(sectionId, collapsible);

			// Build section content
			this.buildSectionContent(sectionId, collapsible);
		}

		// Update move button enabled states
		this.updateMoveButtons();
	}

	/** Build the inner content of a single section. */
	private buildSectionContent(id: SectionId, collapsible: CollapsibleSection): void {
		const body = collapsible.getBodyEl();

		switch (id) {
			case 'hospital-advisor':
				this.hospitalCollapsible = collapsible;
				this.hospitalAdvisorPanel = new HospitalAdvisorPanel(body, this.settings.advisorMode, collapsible);
				this.updateHospitalAdvisor();
				break;

			case 'summary':
				this.summaryCards = new SummaryCards(body, this.settings.threshold);
				this.summaryCards.update(this.data.contractions);
				this.stageDurationBar = new StageDurationBar(body);
				this.updateStageDuration();
				break;

			case 'pattern-assessment':
				this.braxtonHicksPanel = new BraxtonHicksPanel(
					body,
					() => {
						(this.plugin.app as any).setting.open();
						(this.plugin.app as any).setting.openTabById(this.plugin.manifest.id);
					},
					this.settings.bhThresholds
				);
				this.updateBHAssessment();
				break;

			case 'trend-analysis': {
				this.progressionInsight = new ProgressionInsight(body, this.settings.threshold, this.settings.chartGapThresholdMin);
				this.progressionInsight.update(this.data.contractions);
				break;
			}

			case 'wave-chart':
				this.waveChart = new WaveChart(body, this.settings.threshold, this.settings.waveChartHeight, this.settings.chartGapThresholdMin, this.settings.showChartOverlay);
				this.waveChart.update(this.data.contractions, this.data.events);
				break;

			case 'timeline':
				this.timelineTable = new TimelineTable(body);
				this.timelineTable.setEditCallbacks(
					(updated) => this.handleContractionEdit(updated),
					(id) => this.handleContractionDelete(id)
				);
				this.timelineTable.update(this.data.contractions, this.data.events);
				break;

			case 'labor-guide':
				this.clinicalReference = new ClinicalReference(body);
				this.updateClinicalReference();
				break;
		}
	}

	/** Move a section up or down in the layout. */
	private async moveSection(sectionId: SectionId, direction: -1 | 1): Promise<void> {
		const layout = this.data.layout;
		const idx = layout.indexOf(sectionId);
		const newIdx = idx + direction;
		if (idx < 0 || newIdx < 0 || newIdx >= layout.length) return;

		// Swap in the layout array
		[layout[idx], layout[newIdx]] = [layout[newIdx], layout[idx]];

		// Swap in the DOM
		const container = this.sectionsContainer;
		const el = this.sectionCollapsibles.get(sectionId)?.getEl();
		const otherEl = this.sectionCollapsibles.get(layout[idx])?.getEl();
		if (el && otherEl) {
			if (direction === -1) {
				container.insertBefore(el, otherEl);
			} else {
				container.insertBefore(otherEl, el);
			}
		}

		this.updateMoveButtons();

		// Store scroll target so the re-rendered widget scrolls to the moved section
		localStorage.setItem('ct-scroll-after-move', sectionId);

		await this.save();
	}

	/** Update which move arrows are enabled based on position. */
	private updateMoveButtons(): void {
		const activeLayout = this.data.layout.filter(id => this.settings[SECTION_TOGGLE[id]]);
		for (let i = 0; i < activeLayout.length; i++) {
			const collapsible = this.sectionCollapsibles.get(activeLayout[i]);
			if (collapsible) {
				collapsible.setMoveEnabled(i > 0, i < activeLayout.length - 1);
			}
		}
	}

	/** Scroll to and expand a collapsible section. */
	private scrollToSection(sectionId: SectionId): void {
		const collapsible = this.sectionCollapsibles.get(sectionId);
		if (!collapsible) return;
		collapsible.expand();
		collapsible.getEl().scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	/**
	 * Called every 200ms to update the live timer display.
	 * NO file writes happen here -- purely DOM updates.
	 */
	private tick(): void {
		if (this.phase === 'contracting') {
			const active = this.data.contractions.find(isContractionActive);
			if (active) {
				const elapsed = getElapsedSeconds(active);
				this.timerDisplay.update(elapsed, 'contracting');
				if (this.liveRating) this.liveRating.tick(elapsed);
			}
			// Update wave chart live animation
			if (this.waveChart) {
				this.waveChart.update(this.data.contractions, this.data.events);
				this.waveChart.scrollToEnd();
			}
		} else if (this.phase === 'resting' && !this.paused) {
			const restSec = getRestSeconds(this.data.contractions);
			const last = this.getLastCompletedContraction();
			const lastDur = last ? getDurationSeconds(last) : 0;
			this.timerDisplay.showRest(restSec, lastDur);
		} else if (this.phase === 'idle') {
			this.timerDisplay.update(0, 'idle');
		}

		// Update compact timer hero live display
		if (this.hero instanceof HeroCompactTimer && !this.paused) {
			this.hero.tick(this.phase);
		}

		// Update water break elapsed time every ~5 seconds (every 25 ticks)
		if (this.waterBreakInfo && Math.random() < 0.04) {
			this.waterBreakInfo.update(this.data.events, this.data.contractions);
		}
	}

	private getLastCompletedContraction(): Contraction | null {
		const completed = this.data.contractions.filter(c => c.end !== null);
		return completed.length > 0 ? completed[completed.length - 1] : null;
	}

	private handlePause(paused: boolean): void {
		this.paused = paused;
		this.timerDisplay.setPaused(paused);
		this.sessionControls.setPaused(paused);
		if (this.hero) this.hero.setPaused(paused);
		if (paused) {
			this.dismissPickers();
			const last = this.getLastCompletedContraction();
			const lastDur = last ? getDurationSeconds(last) : 0;
			const restSec = getRestSeconds(this.data.contractions);
			this.timerDisplay.showPaused(restSec, lastDur);
		}

		// Persist pause state to code block JSON
		if (this.settings.persistPause) {
			this.data.paused = paused;
			this.save();
		}
	}

	private async startContraction(): Promise<void> {
		if (this.saving || this.phase === 'contracting') return;

		if (this.paused) {
			this.paused = false;
			this.data.paused = false;
			this.sessionControls.setPaused(false);
			this.timerDisplay.setPaused(false);
		}

		const contraction: Contraction = {
			id: generateId(),
			start: new Date().toISOString(),
			end: null,
			intensity: null,
			location: null,
			notes: '',
		};

		if (!this.data.sessionStartedAt) {
			this.data.sessionStartedAt = new Date().toISOString();
		}

		this.data.contractions.push(contraction);
		this.phase = 'contracting';

		this.bigButton.setPhase('contracting');
		this.dismissPickers();
		if (this.liveRating) this.liveRating.begin();
		this.sessionControls.setPauseEnabled(false);
		if (this.untimedPicker) this.untimedPicker.setVisible(false);
		this.bigButton.getEl().scrollIntoView({ behavior: 'smooth', block: 'center' });

		await this.save();

		// Scroll wave chart to the right so the new active contraction is visible
		if (this.waveChart) this.waveChart.scrollToEnd();
	}

	private async stopContraction(): Promise<void> {
		if (this.saving || this.phase !== 'contracting') return;

		const active = this.data.contractions.find(isContractionActive);
		if (!active) return;

		active.end = new Date().toISOString();

		// Assign live rating phases if available
		if (this.liveRating) {
			this.liveRating.onContractionEnd();
			const phases = this.liveRating.getPhases();
			if (phases.peakOffsetSec != null || phases.building !== null || phases.peak !== null || phases.easing !== null) {
				active.phases = phases;
			}
		}

		const completed = this.data.contractions.filter(c => c.end !== null);
		const stats = getSessionStats(completed, this.settings.threshold, this.settings.stageThresholds);
		this.previousStage = stats.laborStage;

		this.phase = 'resting';

		// Reset pause state and re-enable pause button
		if (this.paused) {
			this.paused = false;
			this.data.paused = false;
			this.timerDisplay.setPaused(false);
		}
		this.sessionControls.setPauseEnabled(true);
		if (this.untimedPicker) this.untimedPicker.setVisible(true);

		this.bigButton.setPhase('resting');
		this.bigButton.setNextNumber(this.data.contractions.length + 1);

		if (this.settings.showPostRating) {
			const pickerArea = this.containerEl.querySelector('.ct-picker-area');
			if (pickerArea) pickerArea.removeClass('ct-hidden');
			if (this.intensityPicker) this.intensityPicker.show();
			if (this.locationPicker) this.locationPicker.show();
		}

		this.updateVisualizations();
		await this.save();
	}

	private dismissPickers(): void {
		const pickerArea = this.containerEl.querySelector('.ct-picker-area');
		if (pickerArea) pickerArea.addClass('ct-hidden');
		if (this.intensityPicker) this.intensityPicker.hide();
		if (this.locationPicker) this.locationPicker.hide();
	}

	/** User clicked Skip — mark as dismissed so pickers don't reappear on re-render. */
	private async skipRating(): Promise<void> {
		const last = this.getLastCompletedContraction();
		if (last) last.ratingDismissed = true;
		this.dismissPickers();
		await this.save();
	}

	private async logUntimedContraction(minutesAgo: number): Promise<void> {
		if (this.saving) return;

		const timestamp = new Date(Date.now() - minutesAgo * 60000).toISOString();
		const contraction: Contraction = {
			id: generateId(),
			start: timestamp,
			end: timestamp,
			intensity: null,
			location: null,
			notes: '',
			untimed: true,
		};

		if (!this.data.sessionStartedAt) {
			this.data.sessionStartedAt = timestamp;
		}

		this.data.contractions.push(contraction);
		// Keep contractions sorted chronologically (untimed may be in the past)
		this.data.contractions.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

		if (this.phase === 'idle') {
			this.phase = 'resting';
			this.bigButton.setPhase('resting');
		}
		this.bigButton.setNextNumber(this.data.contractions.length + 1);

		if (this.untimedPicker) {
			this.untimedPicker.showConfirmation(timestamp);
		}

		this.updateVisualizations();
		await this.save();
	}

	private async undoLastUntimed(): Promise<void> {
		const idx = this.data.contractions.map(c => c.untimed).lastIndexOf(true);
		if (idx === -1) return;

		this.data.contractions.splice(idx, 1);

		if (this.data.contractions.length === 0) {
			this.phase = 'idle';
			this.bigButton.setPhase('idle');
			this.data.sessionStartedAt = null;
		} else {
			this.bigButton.setNextNumber(this.data.contractions.length + 1);
		}

		if (this.untimedPicker) this.untimedPicker.reset();
		this.updateVisualizations();
		await this.save();
	}

	private async setUntimedIntensity(level: number): Promise<void> {
		const last = [...this.data.contractions].reverse().find(c => c.untimed && c.intensity === null);
		if (last) {
			last.intensity = level;
			this.updateBHAssessment();
			if (this.waveChart) this.waveChart.update(this.data.contractions, this.data.events);
			await this.save();
		}
	}

	private updateVisualizations(): void {
		if (this.summaryCards) this.summaryCards.update(this.data.contractions);
		if (this.progressionInsight) {
			this.progressionInsight.update(this.data.contractions);
		}
		if (this.waveChart) this.waveChart.update(this.data.contractions, this.data.events);
		if (this.timelineTable) this.timelineTable.update(this.data.contractions, this.data.events);
		this.sessionControls.setVisible(this.data.contractions.length > 0);

		this.updateHero();
		this.updateHospitalAdvisor();
		this.updateStageDuration();
		this.updateBHAssessment();
		this.updateContextualTips();
		this.updateClinicalReference();
	}

	private updateHospitalAdvisor(): void {
		if (!this.hospitalAdvisorPanel) return;

		const stats = getSessionStats(this.data.contractions, this.settings.threshold, this.settings.stageThresholds);
		const est511 = estimateTimeTo511(this.data.contractions, this.settings.threshold, this.settings.chartGapThresholdMin);
		const advice = getDepartureAdvice(
			this.data.contractions,
			this.data.events,
			stats,
			this.settings.hospitalAdvisor,
			this.settings.stageThresholds,
			est511
		);
		const rangeEstimate = getRangeEstimate(
			this.data.contractions,
			this.data.events,
			stats,
			this.settings.hospitalAdvisor,
			this.settings.advisorProgressionRate,
			est511
		);
		this.hospitalAdvisorPanel.update(advice, rangeEstimate);
	}

	private updateStageDuration(): void {
		if (!this.stageDurationBar) return;

		const useCurrentTime = this.settings.stageTimeBasis === 'current-time';
		const stageInfo = getTimeInCurrentStage(this.data.contractions, this.settings.stageThresholds, useCurrentTime);
		if (stageInfo) {
			this.stageDurationBar.update(stageInfo.stage, stageInfo.minutesInStage, this.settings.stageThresholds, this.settings.parity);
		} else {
			this.stageDurationBar.update(null, 0, this.settings.stageThresholds, this.settings.parity);
		}
	}

	private updateBHAssessment(): void {
		if (!this.braxtonHicksPanel) return;
		const assessment = assessBraxtonHicks(this.data.contractions, this.data.events, this.settings.bhThresholds, this.settings.chartGapThresholdMin);
		this.braxtonHicksPanel.update(assessment);
	}

	private updateContextualTips(): void {
		if (!this.contextualTips) return;
		const stats = getSessionStats(this.data.contractions, this.settings.threshold, this.settings.stageThresholds);
		const tips = getRelevantTips(
			this.data.contractions,
			this.data.events,
			stats.laborStage,
			this.previousStage
		);
		this.contextualTips.update(tips);
	}

	private updateHero(): void {
		if (!this.hero) return;
		const stats = getSessionStats(this.data.contractions, this.settings.threshold, this.settings.stageThresholds);
		if (this.hero instanceof HeroAction) {
			const est511 = estimateTimeTo511(this.data.contractions, this.settings.threshold, this.settings.chartGapThresholdMin);
			const rangeEst = getRangeEstimate(
				this.data.contractions,
				this.data.events,
				stats,
				this.settings.hospitalAdvisor,
				this.settings.advisorProgressionRate,
				est511
			);
			this.hero.update(this.phase, this.data.contractions, stats, rangeEst);
		} else {
			this.hero.update(this.phase, this.data.contractions, stats);
		}

		// Notify hero of water-break state
		const hasWaterBreak = this.data.events.some(e => e.type === 'water-break');
		if (this.hero instanceof HeroAction || this.hero instanceof HeroStage) {
			this.hero.setWaterBroke(hasWaterBreak);
		}
	}

	private updateClinicalReference(): void {
		if (!this.clinicalReference) return;
		const stats = getSessionStats(this.data.contractions, this.settings.threshold, this.settings.stageThresholds);
		this.clinicalReference.update(stats.laborStage, this.settings.stageThresholds, this.settings.parity);
	}

	private async recordEventByType(type: LaborEventType): Promise<void> {
		const event: LaborEvent = {
			id: generateId(),
			type,
			timestamp: new Date().toISOString(),
			notes: '',
		};
		this.data.events.push(event);

		if (this.eventButtons) {
			this.eventButtons.showConfirmation(event);
		}

		if (type === 'water-break' && !this.waterBreakInfo) {
			this.waterBreakInfo = new WaterBreakInfo(this.containerEl, this.settings.hospitalAdvisor.providerPhone, this.settings.waterBreakStats);
			this.wireWaterBreakPhoneSave();
		}

		if (this.waterBreakInfo) {
			this.waterBreakInfo.update(this.data.events, this.data.contractions);
		}

		this.updateHospitalAdvisor();
		this.updateHero();
		this.updateBHAssessment();
		this.updateContextualTips();

		// Update chart and timeline with new events
		if (this.waveChart) this.waveChart.update(this.data.contractions, this.data.events);
		if (this.timelineTable) this.timelineTable.update(this.data.contractions, this.data.events);

		await this.save();
	}

	private async editWaterBreakTime(type: LaborEventType, minutesAgo: number): Promise<void> {
		const event = this.data.events.find(e => e.type === type);
		if (!event) return;

		event.timestamp = new Date(Date.now() - minutesAgo * 60000).toISOString();

		// Update confirmation display with new time
		if (this.eventButtons) this.eventButtons.showConfirmation(event);

		// Update water break info panel
		if (this.waterBreakInfo) {
			this.waterBreakInfo.update(this.data.events, this.data.contractions);
		}

		this.updateHospitalAdvisor();
		this.updateContextualTips();

		// Update chart marker position and timeline event row time
		if (this.waveChart) this.waveChart.update(this.data.contractions, this.data.events);
		if (this.timelineTable) this.timelineTable.update(this.data.contractions, this.data.events);

		await this.save();
	}

	private async undoEvent(type: LaborEventType): Promise<void> {
		this.data.events = this.data.events.filter(e => e.type !== type);

		if (type === 'water-break' && this.waterBreakInfo) {
			this.waterBreakInfo.update(this.data.events, this.data.contractions);
		}

		this.updateHospitalAdvisor();
		this.updateHero();
		this.updateBHAssessment();
		this.updateContextualTips();

		// Update chart and timeline without the removed event
		if (this.waveChart) this.waveChart.update(this.data.contractions, this.data.events);
		if (this.timelineTable) this.timelineTable.update(this.data.contractions, this.data.events);

		await this.save();
	}

	private wireWaterBreakPhoneSave(): void {
		if (!this.waterBreakInfo) return;
		this.waterBreakInfo.setPhoneSaveCallback(async (phone) => {
			this.settings.hospitalAdvisor.providerPhone = phone;
			await this.plugin.saveSettings();
		});
	}

	private async handleContractionEdit(updated: Contraction): Promise<void> {
		const idx = this.data.contractions.findIndex(c => c.id === updated.id);
		if (idx >= 0) {
			this.data.contractions[idx] = updated;
			this.updateVisualizations();
			await this.save();
		}
	}

	private async handleContractionDelete(id: string): Promise<void> {
		this.data.contractions = this.data.contractions.filter(c => c.id !== id);
		this.phase = this.determinePhase();
		this.updateVisualizations();
		await this.save();
	}

	private async handleLiveRating(phases: import('../types').ContractionPhases): Promise<void> {
		// Find the most recent contraction (active or just-completed) and apply phases
		const target = this.data.contractions.find(isContractionActive)
			|| this.getLastCompletedContraction();
		if (!target) return;
		target.phases = phases;
		if (this.waveChart) this.waveChart.update(this.data.contractions, this.data.events);
		await this.save();
	}

	/** Buffer intensity selection (no save yet — wait for Save/Cancel). */
	private bufferIntensity(level: number): void {
		this.pendingIntensity = level;
		this.showSaveCancelButtons();
	}

	/** Buffer location selection (no save yet — wait for Save/Cancel). */
	private bufferLocation(location: ContractionLocation): void {
		this.pendingLocation = location;
		this.showSaveCancelButtons();
	}

	private showSaveCancelButtons(): void {
		if (this.skipBtn) this.skipBtn.addClass('ct-hidden');
		if (this.saveCancelWrap) this.saveCancelWrap.removeClass('ct-hidden');
	}

	private hideSaveCancelButtons(): void {
		if (this.skipBtn) this.skipBtn.removeClass('ct-hidden');
		if (this.saveCancelWrap) this.saveCancelWrap.addClass('ct-hidden');
	}

	/** Save buffered intensity/location to the last contraction. */
	private async saveRating(): Promise<void> {
		const last = this.getLastCompletedContraction();
		if (!last) return;
		if (this.pendingIntensity !== null) last.intensity = this.pendingIntensity;
		if (this.pendingLocation !== null) last.location = this.pendingLocation;
		last.ratingDismissed = true;
		this.pendingIntensity = null;
		this.pendingLocation = null;
		this.dismissPickers();
		this.updateBHAssessment();
		this.updateContextualTips();
		await this.save();
	}

	/** Cancel buffered selections and revert picker state. */
	private cancelRating(): void {
		this.pendingIntensity = null;
		this.pendingLocation = null;
		if (this.intensityPicker) this.intensityPicker.clearSelection();
		if (this.locationPicker) this.locationPicker.clearSelection();
		this.hideSaveCancelButtons();
		// Re-show any pre-existing selections from data
		const last = this.getLastCompletedContraction();
		if (last) {
			if (this.intensityPicker && last.intensity !== null) {
				this.intensityPicker.show(last.intensity);
			}
			if (this.locationPicker && last.location !== null) {
				this.locationPicker.show(last.location);
			}
		}
	}

	private async deleteLast(): Promise<void> {
		if (this.data.contractions.length === 0) return;
		this.data.contractions.pop();
		this.phase = this.determinePhase();
		this.updateVisualizations();
		await this.save();
	}

	private async clearAll(): Promise<void> {
		if (this.data.contractions.length === 0) return;
		this.data.contractions = [];
		this.data.events = [];
		this.data.sessionStartedAt = null;
		this.data.paused = false;
		this.phase = 'idle';
		this.paused = false;
		this.sessionControls.setPaused(false);
		this.timerDisplay.setPaused(false);
		if (this.untimedPicker) this.untimedPicker.reset();
		await this.save();
	}

	private async save(): Promise<void> {
		if (this.saving) return;
		this.saving = true;
		this.bigButton.setDisabled(true);

		try {
			await this.store.save(this.ctx, this.containerEl, this.data);
		} catch (e) {
			console.error('Contraction Timer: failed to save', e);
		} finally {
			this.saving = false;
			this.bigButton.setDisabled(false);
		}
	}
}
