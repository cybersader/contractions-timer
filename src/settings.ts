import { App, PluginSettingTab, Setting } from 'obsidian';
import type ContractionTimerPlugin from './main';
import type { HeroMode, AdvisorMode, ProgressionRate, Parity } from './types';
import { DEFAULT_STAGE_THRESHOLDS, DEFAULT_BH_THRESHOLDS } from './types';
import { CLINICAL_SOURCES } from './data/clinicalData';
import { formatDurationRange } from './utils/formatters';

export class ContractionTimerSettingsTab extends PluginSettingTab {
	plugin: ContractionTimerPlugin;

	constructor(app: App, plugin: ContractionTimerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// --- Your situation ---
		new Setting(containerEl).setName('Your situation').setHeading();

		containerEl.createDiv({
			cls: 'setting-item-description',
			text: 'These settings personalize all estimates and recommendations to your specific pregnancy.',
		});

		new Setting(containerEl)
			.setName('Pregnancy type')
			.setDesc('First-time mothers typically experience longer labor at every stage (10\u201321 hours early labor vs 6\u201314 hours for subsequent). This changes all duration estimates and timeline expectations shown in the widget.')
			.addDropdown(dropdown => dropdown
				.addOptions({
					'first-baby': 'First baby',
					'subsequent': 'Subsequent pregnancy',
				})
				.setValue(this.plugin.settings.parity)
				.onChange(async (value) => {
					this.plugin.settings.parity = value as Parity;
					await this.plugin.saveSettings();
				}));

		// --- Hospital advisor ---
		new Setting(containerEl).setName('Hospital advisor').setHeading();

		containerEl.createDiv({
			cls: 'setting-item-description',
			text: 'Controls when the plugin suggests heading to the hospital. The three factors that matter most: how far away the hospital is, your comfort with risk, and how fast your labor is likely to progress.',
		});

		new Setting(containerEl)
			.setName('Travel time to hospital')
			.setDesc('Door to door. The advisor subtracts this from the estimated time to give you a realistic departure window.')
			.addDropdown(dropdown => {
				for (let m = 5; m <= 120; m += 5) {
					dropdown.addOption(String(m), `${m} min`);
				}
				dropdown
					.setValue(String(this.plugin.settings.hospitalAdvisor.travelTimeMinutes))
					.onChange(async (value) => {
						this.plugin.settings.hospitalAdvisor.travelTimeMinutes = parseInt(value);
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Risk comfort level')
			.setDesc('Your personal risk tolerance. Conservative recommends leaving earlier with extra buffer time. Relaxed waits until patterns are more established. This affects every departure recommendation \u2014 from water breaking to 5-1-1 pattern detection.')
			.addDropdown(dropdown => dropdown
				.addOptions({
					conservative: 'Conservative — leave early, extra buffer',
					moderate: 'Moderate — balanced timing',
					relaxed: 'Relaxed — wait longer before leaving',
				})
				.setValue(this.plugin.settings.hospitalAdvisor.riskAppetite)
				.onChange(async (value) => {
					this.plugin.settings.hospitalAdvisor.riskAppetite = value as 'conservative' | 'moderate' | 'relaxed';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Provider phone')
			.setDesc('Optional. Shown in urgent situations for quick access.')
			.addText(text => text
				.setPlaceholder('(555) 123-4567')
				.setValue(this.plugin.settings.hospitalAdvisor.providerPhone)
				.onChange(async (value) => {
					this.plugin.settings.hospitalAdvisor.providerPhone = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Advisor display mode')
			.setDesc('How the hospital advisor panel presents its information.')
			.addDropdown(dropdown => dropdown
				.addOptions({
					range: 'Range estimate — earliest/likely/latest timing',
					urgency: 'Urgency — color-coded departure advice',
					minimal: 'Minimal — pattern summary only',
				})
				.setValue(this.plugin.settings.advisorMode)
				.onChange(async (value) => {
					this.plugin.settings.advisorMode = value as AdvisorMode;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Progression rate assumption')
			.setDesc('Affects the hospital advisor\u2019s time range estimates. Slower widens the window (more buffer time). Faster narrows it. If you have a history of fast labors, choose faster.')
			.addDropdown(dropdown => dropdown
				.addOptions({
					slower: 'Slower — first baby or uncertain',
					average: 'Average — typical progression',
					faster: 'Faster — experienced or rapid history',
				})
				.setValue(this.plugin.settings.advisorProgressionRate)
				.onChange(async (value) => {
					this.plugin.settings.advisorProgressionRate = value as ProgressionRate;
					await this.plugin.saveSettings();
				}));

		// --- Threshold (5-1-1 rule) ---
		new Setting(containerEl).setName('Threshold rule').setHeading();

		new Setting(containerEl)
			.setName('Interval (minutes)')
			.setDesc('Contractions this many minutes apart or less trigger the threshold.')
			.addDropdown(dropdown => {
				for (let i = 1; i <= 10; i++) {
					dropdown.addOption(String(i), `${i} min`);
				}
				dropdown
					.setValue(String(this.plugin.settings.threshold.intervalMinutes))
					.onChange(async (value) => {
						this.plugin.settings.threshold.intervalMinutes = parseInt(value);
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Duration (seconds)')
			.setDesc('Contractions this long or longer trigger the threshold.')
			.addDropdown(dropdown => {
				for (let s = 30; s <= 120; s += 5) {
					dropdown.addOption(String(s), `${s} sec`);
				}
				dropdown
					.setValue(String(this.plugin.settings.threshold.durationSeconds))
					.onChange(async (value) => {
						this.plugin.settings.threshold.durationSeconds = parseInt(value);
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Sustained period (minutes)')
			.setDesc('How long the pattern must hold before the threshold is met.')
			.addDropdown(dropdown => {
				for (let m = 30; m <= 120; m += 5) {
					dropdown.addOption(String(m), `${m} min`);
				}
				dropdown
					.setValue(String(this.plugin.settings.threshold.sustainedMinutes))
					.onChange(async (value) => {
						this.plugin.settings.threshold.sustainedMinutes = parseInt(value);
						await this.plugin.saveSettings();
					});
			});

		// --- Stage boundaries ---
		new Setting(containerEl).setName('Stage boundaries').setHeading();
		containerEl.createDiv({
			cls: 'setting-item-description',
			text: 'These thresholds determine how the plugin classifies your current labor stage. The defaults match ACOG guidelines, but your provider may use slightly different criteria \u2014 ask them if you are unsure.',
		});

		this.buildStageSettings(containerEl, 'Transition stage', 'transition');
		this.buildStageSettings(containerEl, 'Active stage', 'active');
		this.buildStageSettings(containerEl, 'Early stage', 'early');

		// --- Features ---
		new Setting(containerEl).setName('Features').setHeading();

		new Setting(containerEl)
			.setName('Show hospital advisor')
			.setDesc('Display departure urgency based on contraction patterns.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showHospitalAdvisor)
				.onChange(async (value) => {
					this.plugin.settings.showHospitalAdvisor = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show contextual tips')
			.setDesc('Display educational tips based on your current labor stage.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showContextualTips)
				.onChange(async (value) => {
					this.plugin.settings.showContextualTips = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show pattern assessment')
			.setDesc('Estimate whether contractions are practice or real labor.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showBraxtonHicksAssessment)
				.onChange(async (value) => {
					this.plugin.settings.showBraxtonHicksAssessment = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show labor guide')
			.setDesc('Collapsible reference panel with stage info and when-to-call list.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showClinicalReference)
				.onChange(async (value) => {
					this.plugin.settings.showClinicalReference = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show water break button')
			.setDesc('Quick button to record when your water breaks.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showWaterBreakButton)
				.onChange(async (value) => {
					this.plugin.settings.showWaterBreakButton = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Live contraction rating')
			.setDesc('Shows a "past the peak" button during contractions to shape the wave chart curve.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showLiveRating)
				.onChange(async (value) => {
					this.plugin.settings.showLiveRating = value;
					await this.plugin.saveSettings();
				}));

		// --- Display ---
		new Setting(containerEl).setName('Display').setHeading();

		new Setting(containerEl)
			.setName('Hero display')
			.setDesc('What to show at the top of the widget above the timer button.')
			.addDropdown(dropdown => dropdown
				.addOptions({
					'stage-badge': 'Stage badge — current labor stage',
					'action-card': 'Action card — what to do now',
					'compact-timer': 'Compact timer — minimal time display',
				})
				.setValue(this.plugin.settings.heroMode)
				.onChange(async (value) => {
					this.plugin.settings.heroMode = value as HeroMode;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show wave chart')
			.setDesc('Display the wave visualization.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showWaveChart)
				.onChange(async (value) => {
					this.plugin.settings.showWaveChart = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show timeline')
			.setDesc('Display the contraction history table.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showTimeline)
				.onChange(async (value) => {
					this.plugin.settings.showTimeline = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show summary cards')
			.setDesc('Display average duration, interval, and threshold status.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showSummaryCards)
				.onChange(async (value) => {
					this.plugin.settings.showSummaryCards = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show trend analysis')
			.setDesc('Display contraction progression trends and estimated time to threshold.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showProgressionInsight)
				.onChange(async (value) => {
					this.plugin.settings.showProgressionInsight = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show post-contraction rating')
			.setDesc('Show intensity and location pickers after stopping a contraction or logging a missed one.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showPostRating)
				.onChange(async (value) => {
					this.plugin.settings.showPostRating = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show intensity picker')
			.setDesc('Show intensity rating buttons after each contraction.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showIntensityPicker)
				.onChange(async (value) => {
					this.plugin.settings.showIntensityPicker = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show location picker')
			.setDesc('Show location buttons (front/back/wrapping) after each contraction.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showLocationPicker)
				.onChange(async (value) => {
					this.plugin.settings.showLocationPicker = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Intensity scale')
			.setDesc('Number of intensity levels to show after each contraction.')
			.addDropdown(dropdown => dropdown
				.addOptions({ '3': '3 levels', '5': '5 levels' })
				.setValue(String(this.plugin.settings.intensityScale))
				.onChange(async (value) => {
					this.plugin.settings.intensityScale = parseInt(value) as 3 | 5;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Time format')
			.setDesc('Clock time format for wave chart labels.')
			.addDropdown(dropdown => dropdown
				.addOptions({ '12h': '12-hour (2:30p)', '24h': '24-hour (14:30)' })
				.setValue(this.plugin.settings.timeFormat)
				.onChange(async (value) => {
					this.plugin.settings.timeFormat = value as '12h' | '24h';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show seconds on rest timer')
			.setDesc('Show seconds in the rest timer when over 1 hour (e.g., "2h 15m 8s" instead of "2h 15m").')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showRestSeconds)
				.onChange(async (value) => {
					this.plugin.settings.showRestSeconds = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Wave chart height')
			.setDesc('Height of the wave chart in pixels.')
			.addDropdown(dropdown => {
				const sizes: Record<string, string> = {
					'100': 'Small (100px)',
					'150': 'Medium (150px)',
					'200': 'Large (200px)',
					'250': 'Extra large (250px)',
					'300': 'Full (300px)',
				};
				dropdown
					.addOptions(sizes)
					.setValue(String(this.plugin.settings.waveChartHeight))
					.onChange(async (value) => {
						this.plugin.settings.waveChartHeight = parseInt(value);
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Chart gap compression')
			.setDesc('Compress gaps longer than this in the wave chart. Useful when old false alarms stretch the chart.')
			.addDropdown(dropdown => dropdown
				.addOptions({
					'0': 'Off (show full timeline)',
					'15': '15 min',
					'30': '30 min (recommended)',
					'60': '1 hour',
					'120': '2 hours',
				})
				.setValue(String(this.plugin.settings.chartGapThresholdMin))
				.onChange(async (value) => {
					this.plugin.settings.chartGapThresholdMin = parseInt(value);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Wave chart threshold overlay')
			.setDesc('Experimental: color baseline segments green/amber based on how close intervals are to the threshold.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showChartOverlay)
				.onChange(async (value) => {
					this.plugin.settings.showChartOverlay = value;
					await this.plugin.saveSettings();
				}));

		// --- Behavior ---
		new Setting(containerEl).setName('Behavior').setHeading();

		new Setting(containerEl)
			.setName('Haptic feedback')
			.setDesc('Vibrate on button press (mobile only).')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.hapticFeedback)
				.onChange(async (value) => {
					this.plugin.settings.hapticFeedback = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Persist pause')
			.setDesc('Keep the timer paused when you navigate away and come back.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.persistPause)
				.onChange(async (value) => {
					this.plugin.settings.persistPause = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Stage time basis')
			.setDesc(
				'How stage duration is measured. The default uses your most recent contraction as the endpoint, which is more accurate when there are gaps. The clock option keeps counting in real time, which can overstate duration if you stop tracking.'
			)
			.addDropdown(dd => dd
				.addOption('last-recorded', 'Last recorded')
				.addOption('current-time', 'Current time')
				.setValue(this.plugin.settings.stageTimeBasis)
				.onChange(async (value) => {
					this.plugin.settings.stageTimeBasis = value as 'last-recorded' | 'current-time';
					await this.plugin.saveSettings();
				}));

		// --- Pattern assessment thresholds (advanced) ---
		new Setting(containerEl).setName('Pattern assessment thresholds').setHeading();

		containerEl.createDiv({
			cls: 'setting-item-description',
			text: 'Advanced: tune the thresholds used by the pattern assessment panel to classify contractions as practice or real labor. The defaults match clinical literature.',
		});

		const bh = this.plugin.settings.bhThresholds;
		const bhDefaults = DEFAULT_BH_THRESHOLDS;

		new Setting(containerEl)
			.setName('Regularity threshold (regular)')
			.setDesc(`Coefficient of variation below this = "regular". Default: ${bhDefaults.regularityCVLow}`)
			.addText(text => text
				.setPlaceholder(String(bhDefaults.regularityCVLow))
				.setValue(String(bh.regularityCVLow))
				.onChange(async (value) => {
					const n = parseFloat(value);
					if (!isNaN(n) && n > 0 && n < 2) {
						this.plugin.settings.bhThresholds.regularityCVLow = n;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Regularity threshold (irregular)')
			.setDesc(`Coefficient of variation above this = "irregular". Default: ${bhDefaults.regularityCVHigh}`)
			.addText(text => text
				.setPlaceholder(String(bhDefaults.regularityCVHigh))
				.setValue(String(bh.regularityCVHigh))
				.onChange(async (value) => {
					const n = parseFloat(value);
					if (!isNaN(n) && n > 0 && n < 2) {
						this.plugin.settings.bhThresholds.regularityCVHigh = n;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Location ratio (back/wrapping)')
			.setDesc(`Above this ratio = suggests real labor. Default: ${bhDefaults.locationRatioHigh}`)
			.addText(text => text
				.setPlaceholder(String(bhDefaults.locationRatioHigh))
				.setValue(String(bh.locationRatioHigh))
				.onChange(async (value) => {
					const n = parseFloat(value);
					if (!isNaN(n) && n > 0 && n <= 1) {
						this.plugin.settings.bhThresholds.locationRatioHigh = n;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Location ratio (front)')
			.setDesc(`Below this ratio = suggests practice. Default: ${bhDefaults.locationRatioLow}`)
			.addText(text => text
				.setPlaceholder(String(bhDefaults.locationRatioLow))
				.setValue(String(bh.locationRatioLow))
				.onChange(async (value) => {
					const n = parseFloat(value);
					if (!isNaN(n) && n >= 0 && n <= 1) {
						this.plugin.settings.bhThresholds.locationRatioLow = n;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Sustained minimum (minutes)')
			.setDesc(`Total span needed for "sustained" pattern. Default: ${bhDefaults.sustainedMinMinutes}`)
			.addText(text => text
				.setPlaceholder(String(bhDefaults.sustainedMinMinutes))
				.setValue(String(bh.sustainedMinMinutes))
				.onChange(async (value) => {
					const n = parseInt(value);
					if (!isNaN(n) && n > 0) {
						this.plugin.settings.bhThresholds.sustainedMinMinutes = n;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Sustained max gap (minutes)')
			.setDesc(`Max gap between contractions in a sustained session. Default: ${bhDefaults.sustainedMaxGapMinutes}`)
			.addText(text => text
				.setPlaceholder(String(bhDefaults.sustainedMaxGapMinutes))
				.setValue(String(bh.sustainedMaxGapMinutes))
				.onChange(async (value) => {
					const n = parseInt(value);
					if (!isNaN(n) && n > 0) {
						this.plugin.settings.bhThresholds.sustainedMaxGapMinutes = n;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Verdict: real labor threshold')
			.setDesc(`Score at or above this = "likely real labor". Default: ${bhDefaults.verdictRealThreshold}`)
			.addText(text => text
				.setPlaceholder(String(bhDefaults.verdictRealThreshold))
				.setValue(String(bh.verdictRealThreshold))
				.onChange(async (value) => {
					const n = parseInt(value);
					if (!isNaN(n) && n > 0 && n <= 100) {
						this.plugin.settings.bhThresholds.verdictRealThreshold = n;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Verdict: practice threshold')
			.setDesc(`Score at or below this = "likely practice". Default: ${bhDefaults.verdictBHThreshold}`)
			.addText(text => text
				.setPlaceholder(String(bhDefaults.verdictBHThreshold))
				.setValue(String(bh.verdictBHThreshold))
				.onChange(async (value) => {
					const n = parseInt(value);
					if (!isNaN(n) && n >= 0 && n <= 100) {
						this.plugin.settings.bhThresholds.verdictBHThreshold = n;
						await this.plugin.saveSettings();
					}
				}));

		// --- Clinical references ---
		this.buildClinicalReferences(containerEl);
	}

	private buildClinicalReferences(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Clinical references').setHeading();

		containerEl.createDiv({
			cls: 'setting-item-description',
			text: 'Evidence-based defaults from large population studies. Your provider may use different values based on your health history \u2014 edit these to match their guidance. Tap source links for original research.',
		});

		// --- Stage reference data (cervix, patterns, durations) ---
		const stages: { key: string; label: string }[] = [
			{ key: 'early', label: 'Early labor' },
			{ key: 'active', label: 'Active labor' },
			{ key: 'transition', label: 'Transition' },
		];

		for (const { key, label } of stages) {
			const config = this.plugin.settings.stageThresholds[key];
			const defaults = DEFAULT_STAGE_THRESHOLDS[key];
			if (!config || !defaults) continue;

			new Setting(containerEl)
				.setName(label)
				.setDesc(this.sourceFragment('zhang-2010', 'acog-2024'))
				.setHeading();

			new Setting(containerEl)
				.setName('Cervix dilation')
				.setDesc(`Range in cm, e.g. "${defaults.cervix}"`)
				.addText(text => text
					.setPlaceholder(defaults.cervix)
					.setValue(config.cervix)
					.onChange(async (value) => {
						this.plugin.settings.stageThresholds[key].cervix = value;
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('Contraction pattern')
				.setDesc(`Duration and spacing, e.g. "${defaults.contractionPattern}"`)
				.addText(text => text
					.setPlaceholder(defaults.contractionPattern)
					.setValue(config.contractionPattern)
					.onChange(async (value) => {
						this.plugin.settings.stageThresholds[key].contractionPattern = value;
						await this.plugin.saveSettings();
					}));

			this.buildDurationRangeSetting(
				containerEl, 'Typical duration (first baby)',
				config.typicalDurationFirstMin,
				defaults.typicalDurationFirstMin,
				async (range) => {
					this.plugin.settings.stageThresholds[key].typicalDurationFirstMin = range;
					await this.plugin.saveSettings();
				}
			);

			this.buildDurationRangeSetting(
				containerEl, 'Typical duration (subsequent)',
				config.typicalDurationSubsequentMin,
				defaults.typicalDurationSubsequentMin,
				async (range) => {
					this.plugin.settings.stageThresholds[key].typicalDurationSubsequentMin = range;
					await this.plugin.saveSettings();
				}
			);
		}

		// --- Water break statistics (editable) ---
		new Setting(containerEl)
			.setName('Water break statistics')
			.setDesc(this.sourceFragment('statpearls-prom', 'cleveland-clinic'))
			.setHeading();

		containerEl.createDiv({
			cls: 'setting-item-description',
			text: 'Population statistics shown after water breaks. Edit if your provider cites different numbers.',
		});

		type WaterField = 'beforeContractions' | 'duringLabor' | 'laborWithin12Hours' | 'laborWithin24Hours';
		const waterFields: { field: WaterField; label: string; placeholder: string; desc: string }[] = [
			{ field: 'beforeContractions', label: 'Water breaks before contractions', placeholder: '8-15%', desc: 'Percentage or range, e.g. "8-15%"' },
			{ field: 'duringLabor', label: 'Water breaks during labor', placeholder: '~90%', desc: 'Approximate percentage, e.g. "~90%"' },
			{ field: 'laborWithin12Hours', label: 'Active labor within 12 hours', placeholder: '45%', desc: 'Percentage, e.g. "45%"' },
			{ field: 'laborWithin24Hours', label: 'Active labor within 24 hours', placeholder: '77-95%', desc: 'Percentage or range, e.g. "77-95%"' },
		];

		for (const { field, label, placeholder, desc } of waterFields) {
			new Setting(containerEl)
				.setName(label)
				.setDesc(desc)
				.addText(text => text
					.setPlaceholder(placeholder)
					.setValue(this.plugin.settings.waterBreakStats[field])
					.onChange(async (value) => {
						this.plugin.settings.waterBreakStats[field] = value;
						await this.plugin.saveSettings();
					}));
		}

		// --- Sources ---
		new Setting(containerEl)
			.setName('Sources')
			.setHeading();

		new Setting(containerEl)
			.setName('Practice contraction criteria')
			.setDesc(this.sourceFragment('statpearls-bh'));

		new Setting(containerEl)
			.setName('Stage classification')
			.setDesc(this.sourceFragment('acog-2024'));

		new Setting(containerEl)
			.setName('Stage duration data')
			.setDesc(this.sourceFragment('zhang-2010'));
	}

	/** Build a pair of min/max dropdowns for a stage duration range. */
	private buildDurationRangeSetting(
		containerEl: HTMLElement,
		name: string,
		current: [number, number],
		defaults: [number, number],
		onSave: (range: [number, number]) => Promise<void>
	): void {
		const options: Record<string, string> = {};
		// Generate options: 15 min up to 1440 min (24h), with sensible steps
		for (let m = 15; m <= 120; m += 15) {
			options[String(m)] = this.formatMinutes(m);
		}
		for (let m = 180; m <= 720; m += 60) {
			options[String(m)] = this.formatMinutes(m);
		}
		for (let m = 840; m <= 1440; m += 60) {
			options[String(m)] = this.formatMinutes(m);
		}

		const defaultStr = `Default: ${this.formatMinutes(defaults[0])} \u2013 ${this.formatMinutes(defaults[1])}`;

		new Setting(containerEl)
			.setName(name)
			.setDesc(defaultStr)
			.addDropdown(dropdown => {
				dropdown.addOptions(options)
					.setValue(String(current[0]))
					.onChange(async (value) => {
						const newMin = parseInt(value);
						await onSave([newMin, current[1]]);
						current[0] = newMin;
					});
			})
			.addDropdown(dropdown => {
				dropdown.addOptions(options)
					.setValue(String(current[1]))
					.onChange(async (value) => {
						const newMax = parseInt(value);
						await onSave([current[0], newMax]);
						current[1] = newMax;
					});
			});
	}

	/** Format minutes as a human-readable string. */
	private formatMinutes(m: number): string {
		if (m < 60) return `${m} min`;
		const hours = m / 60;
		if (Number.isInteger(hours)) return `${hours}h`;
		return `${hours.toFixed(1)}h`;
	}

	/** Create a DocumentFragment with a clickable source link. */
	private sourceFragment(...sourceKeys: string[]): DocumentFragment {
		const frag = document.createDocumentFragment();
		for (let i = 0; i < sourceKeys.length; i++) {
			const src = CLINICAL_SOURCES[sourceKeys[i]];
			if (!src) continue;
			if (i > 0) frag.appendText('  \u2022  ');
			const a = document.createElement('a');
			a.href = src.url;
			a.textContent = src.label;
			a.style.cursor = 'pointer';
			a.addEventListener('click', (e) => {
				e.preventDefault();
				window.open(src.url, '_blank');
			});
			frag.appendChild(a);
		}
		return frag;
	}

	private buildStageSettings(containerEl: HTMLElement, title: string, stageKey: string): void {
		const defaults = DEFAULT_STAGE_THRESHOLDS[stageKey];
		const config = this.plugin.settings.stageThresholds[stageKey];
		if (!config || !defaults) return;

		new Setting(containerEl)
			.setName(`${title} - max interval`)
			.setDesc(`Contractions must be this close apart to qualify. Default: ${defaults.maxIntervalMin} min.`)
			.addDropdown(dropdown => {
				for (let m = 1; m <= 60; m++) {
					dropdown.addOption(String(m), `${m} min`);
				}
				dropdown
					.setValue(String(config.maxIntervalMin))
					.onChange(async (value) => {
						this.plugin.settings.stageThresholds[stageKey].maxIntervalMin = parseInt(value);
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(`${title} - min duration`)
			.setDesc(`Contractions must last at least this long. Default: ${defaults.minDurationSec} sec.`)
			.addDropdown(dropdown => {
				for (let s = 0; s <= 120; s += 5) {
					dropdown.addOption(String(s), `${s} sec`);
				}
				dropdown
					.setValue(String(config.minDurationSec))
					.onChange(async (value) => {
						this.plugin.settings.stageThresholds[stageKey].minDurationSec = parseInt(value);
						await this.plugin.saveSettings();
					});
			});
	}
}
