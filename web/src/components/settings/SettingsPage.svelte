<script lang="ts">
	import { _ } from '../../lib/i18n/index';
	import { tick } from 'svelte';
	import { settings } from '../../lib/stores/settings';
	import { DEFAULT_SETTINGS } from '../../lib/labor-logic/types';

	interface Props {
		scrollToSection?: string | null;
	}
	let { scrollToSection = null } = $props<Props>();

	let showAdvanced = $state(false);

	// Auto-expand advanced and scroll to target section
	$effect(() => {
		if (scrollToSection) {
			if (scrollToSection === 'advanced' || scrollToSection === 'stage-thresholds') {
				showAdvanced = true;
			}
			tick().then(() => {
				const el = document.getElementById(`settings-${scrollToSection}`);
				if (el) {
					el.scrollIntoView({ behavior: 'smooth', block: 'start' });
				}
			});
		}
	});

	function resetAdvanced() {
		settings.update(s => ({
			...s,
			chartGapThresholdMin: DEFAULT_SETTINGS.chartGapThresholdMin,
			stageTimeBasis: DEFAULT_SETTINGS.stageTimeBasis,
			stageThresholds: { ...DEFAULT_SETTINGS.stageThresholds },
			bhThresholds: { ...DEFAULT_SETTINGS.bhThresholds },
		}));
	}
</script>

<div class="settings-content">
	<!-- Your situation -->
	<div class="section-title" id="settings-situation">{$_('settings.situation.title')}</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<label for="setting-parity" class="setting-label">{$_('settings.situation.firstBabyLabel')}</label>
			<span class="setting-hint">{$_('settings.situation.firstBabyHint')}</span>
		</div>
		<select id="setting-parity" class="setting-select" bind:value={$settings.parity}>
			<option value="first-baby">{$_('settings.situation.yesFirstBaby')}</option>
			<option value="subsequent">{$_('settings.situation.noHadOneBefore')}</option>
		</select>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<label for="setting-situation-phone" class="setting-label">{$_('settings.situation.providerPhone')}</label>
			<span class="setting-hint">{$_('settings.situation.providerPhoneHint')}</span>
		</div>
		<input
			id="setting-situation-phone"
			type="tel"
			class="setting-input"
			placeholder={$_('settings.situation.providerPhonePlaceholder')}
			bind:value={$settings.hospitalAdvisor.providerPhone}
		/>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<label for="setting-situation-travel" class="setting-label">{$_('settings.situation.travelTime')}</label>
			<span class="setting-hint">{$_('settings.situation.travelTimeHint')}</span>
		</div>
		<select id="setting-situation-travel" class="setting-select" onchange={(e) => {
			const val = (e.target as HTMLSelectElement).value;
			if (val === 'unsure') {
				$settings.hospitalAdvisor.travelTimeUncertain = true;
			} else {
				$settings.hospitalAdvisor.travelTimeUncertain = false;
				$settings.hospitalAdvisor.travelTimeMinutes = Number(val);
			}
		}} value={$settings.hospitalAdvisor.travelTimeUncertain ? 'unsure' : $settings.hospitalAdvisor.travelTimeMinutes}>
			<option value="unsure">{$_('settings.situation.travelTimeNotSure')}</option>
			{#each [5, 10, 15, 20, 25, 30, 45, 60, 90, 120] as mins}
				<option value={mins}>{mins} min</option>
			{/each}
		</select>
	</div>

	<!-- Display -->
	<div class="section-title" id="settings-display">{$_('settings.display.title')}</div>
	<div class="setting-row">
		<label for="setting-time-format" class="setting-label">{$_('settings.display.timeFormat')}</label>
		<select id="setting-time-format" class="setting-select" bind:value={$settings.timeFormat}>
			<option value="12h">{$_('settings.display.timeFormat12h')}</option>
			<option value="24h">{$_('settings.display.timeFormat24h')}</option>
		</select>
	</div>
	<div class="setting-row">
		<label for="setting-intensity" class="setting-label">{$_('settings.display.intensityScale')}</label>
		<select id="setting-intensity" class="setting-select" bind:value={$settings.intensityScale}>
			<option value={5}>{$_('settings.display.levels5')}</option>
			<option value={3}>{$_('settings.display.levels3')}</option>
		</select>
	</div>
	<div class="setting-row">
		<label for="setting-chart-height" class="setting-label">{$_('settings.display.waveChartHeight')}</label>
		<select id="setting-chart-height" class="setting-select" bind:value={$settings.waveChartHeight}>
			<option value={100}>{$_('settings.display.heightSmall')}</option>
			<option value={150}>{$_('settings.display.heightMedium')}</option>
			<option value={200}>{$_('settings.display.heightLarge')}</option>
			<option value={250}>{$_('settings.display.heightXLarge')}</option>
		</select>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<label for="setting-hero" class="setting-label">{$_('settings.display.heroDisplay')}</label>
			<span class="setting-hint">{$_('settings.display.heroHint')}</span>
		</div>
		<select id="setting-hero" class="setting-select" bind:value={$settings.heroMode}>
			<option value="stage-badge">{$_('settings.display.heroStageBadge')}</option>
			<option value="action-card">{$_('settings.display.heroActionCard')}</option>
			<option value="compact-timer">{$_('settings.display.heroCompactTimer')}</option>
		</select>
	</div>
	<div class="setting-row">
		<span id="label-rest-seconds" class="setting-label">{$_('settings.display.showRestSeconds')}</span>
		<label class="toggle" aria-labelledby="label-rest-seconds">
			<input type="checkbox" bind:checked={$settings.showRestSeconds} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<label for="setting-gap" class="setting-label">{$_('settings.display.sessionBreakThreshold')}</label>
			<span class="setting-hint">{$_('settings.display.sessionBreakHint')}</span>
		</div>
		<select id="setting-gap" class="setting-select" bind:value={$settings.chartGapThresholdMin}>
			<option value={0}>{$_('settings.display.breakOff')}</option>
			<option value={15}>15 min</option>
			<option value={30}>30 min</option>
			<option value={60}>1 hour</option>
			<option value={120}>2 hours</option>
		</select>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<label for="setting-stage-basis" class="setting-label">{$_('settings.display.stageTimerMode')}</label>
			<span class="setting-hint">{$_('settings.display.stageTimerHint')}</span>
		</div>
		<select id="setting-stage-basis" class="setting-select" bind:value={$settings.stageTimeBasis}>
			<option value="last-recorded">{$_('settings.display.stageTimerLastRecorded')}</option>
			<option value="current-time">{$_('settings.display.stageTimerCurrentTime')}</option>
		</select>
	</div>

	<!-- Behavior -->
	<div class="section-title" id="settings-behavior">{$_('settings.behavior.title')}</div>
	<div class="setting-row">
		<span id="label-haptic" class="setting-label">{$_('settings.behavior.hapticFeedback')}</span>
		<label class="toggle" aria-labelledby="label-haptic">
			<input type="checkbox" bind:checked={$settings.hapticFeedback} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<span id="label-post-rating" class="setting-label">{$_('settings.behavior.postContractionRating')}</span>
		<label class="toggle" aria-labelledby="label-post-rating">
			<input type="checkbox" bind:checked={$settings.showPostRating} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<span id="label-intensity-picker" class="setting-label">{$_('settings.behavior.showIntensityPicker')}</span>
		<label class="toggle" aria-labelledby="label-intensity-picker">
			<input type="checkbox" bind:checked={$settings.showIntensityPicker} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<span id="label-location-picker" class="setting-label">{$_('settings.behavior.showLocationPicker')}</span>
		<label class="toggle" aria-labelledby="label-location-picker">
			<input type="checkbox" bind:checked={$settings.showLocationPicker} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<span id="label-live-rating" class="setting-label">{$_('settings.behavior.peakRating')}</span>
		<label class="toggle" aria-labelledby="label-live-rating">
			<input type="checkbox" bind:checked={$settings.showLiveRating} />
			<span class="toggle-slider"></span>
		</label>
	</div>

	<!-- Features -->
	<div class="section-title" id="settings-features">{$_('settings.features.title')}</div>
	<div class="setting-row">
		<span id="label-wave-chart" class="setting-label">{$_('settings.features.waveChart')}</span>
		<label class="toggle" aria-labelledby="label-wave-chart">
			<input type="checkbox" bind:checked={$settings.showWaveChart} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<span id="label-chart-overlay" class="setting-label">{$_('settings.features.showTargetLines')}</span>
			<span class="setting-hint">{$_('settings.features.showTargetLinesHint')}</span>
		</div>
		<label class="toggle" aria-labelledby="label-chart-overlay">
			<input type="checkbox" bind:checked={$settings.showChartOverlay} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<span id="label-trend" class="setting-label">{$_('settings.features.trendAnalysis')}</span>
			<span class="setting-hint">{$_('settings.features.trendAnalysisHint')}</span>
		</div>
		<label class="toggle" aria-labelledby="label-trend">
			<input type="checkbox" bind:checked={$settings.showProgressionInsight} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<span id="label-bh" class="setting-label">{$_('settings.features.patternAssessment')}</span>
			<span class="setting-hint">{$_('settings.features.patternAssessmentHint')}</span>
		</div>
		<label class="toggle" aria-labelledby="label-bh">
			<input type="checkbox" bind:checked={$settings.showBraxtonHicksAssessment} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<span id="label-advisor" class="setting-label">{$_('settings.features.hospitalAdvisor')}</span>
			<span class="setting-hint">{$_('settings.features.hospitalAdvisorHint')}</span>
		</div>
		<label class="toggle" aria-labelledby="label-advisor">
			<input type="checkbox" bind:checked={$settings.showHospitalAdvisor} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<span id="label-tips" class="setting-label">{$_('settings.features.contextualTips')}</span>
			<span class="setting-hint">{$_('settings.features.contextualTipsHint')}</span>
		</div>
		<label class="toggle" aria-labelledby="label-tips">
			<input type="checkbox" bind:checked={$settings.showContextualTips} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<span id="label-water-btn" class="setting-label">{$_('settings.features.waterBreakButton')}</span>
		<label class="toggle" aria-labelledby="label-water-btn">
			<input type="checkbox" bind:checked={$settings.showWaterBreakButton} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<span id="label-threshold-rule" class="setting-label">{$_('settings.features.thresholdRuleProgress')}</span>
			<span class="setting-hint">{$_('settings.features.thresholdRuleHint')}</span>
		</div>
		<label class="toggle" aria-labelledby="label-threshold-rule">
			<input type="checkbox" bind:checked={$settings.showThresholdRule} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<span id="label-clinical" class="setting-label">{$_('settings.features.clinicalReference')}</span>
			<span class="setting-hint">{$_('settings.features.clinicalReferenceHint')}</span>
		</div>
		<label class="toggle" aria-labelledby="label-clinical">
			<input type="checkbox" bind:checked={$settings.showClinicalReference} />
			<span class="toggle-slider"></span>
		</label>
	</div>

	<!-- Advisor -->
	<div class="section-title" id="settings-advisor">{$_('settings.advisor.title')}</div>
	<p class="section-desc">{@html $_('settings.advisor.introDesc')}</p>
	<div class="setting-row">
		<div class="setting-label-group">
			<label for="setting-advisor-style" class="setting-label">{$_('settings.advisor.detailLevel')}</label>
			<span class="setting-hint">{$_('settings.advisor.detailLevelHint')}</span>
		</div>
		<select id="setting-advisor-style" class="setting-select" bind:value={$settings.advisorMode}>
			<option value="range">{$_('settings.advisor.detailDetailed')}</option>
			<option value="urgency">{$_('settings.advisor.detailUrgency')}</option>
			<option value="minimal">{$_('settings.advisor.detailMinimal')}</option>
		</select>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<label for="setting-travel" class="setting-label">{$_('settings.advisor.travelTime')}</label>
			<span class="setting-hint">{$_('settings.advisor.travelTimeHint')}</span>
		</div>
		<select id="setting-travel" class="setting-select" onchange={(e) => {
			const val = (e.target as HTMLSelectElement).value;
			if (val === 'unsure') {
				$settings.hospitalAdvisor.travelTimeUncertain = true;
			} else {
				$settings.hospitalAdvisor.travelTimeUncertain = false;
				$settings.hospitalAdvisor.travelTimeMinutes = Number(val);
			}
		}} value={$settings.hospitalAdvisor.travelTimeUncertain ? 'unsure' : $settings.hospitalAdvisor.travelTimeMinutes}>
			<option value="unsure">{$_('settings.situation.travelTimeNotSure')}</option>
			{#each [5, 10, 15, 20, 25, 30, 45, 60, 90, 120] as mins}
				<option value={mins}>{mins} min</option>
			{/each}
		</select>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<label for="setting-risk" class="setting-label">{$_('settings.advisor.alertTiming')}</label>
			<span class="setting-hint">{$_('settings.advisor.alertTimingHint')}</span>
		</div>
		<select id="setting-risk" class="setting-select" bind:value={$settings.hospitalAdvisor.riskAppetite}>
			<option value="conservative">{$_('settings.advisor.alertConservative')}</option>
			<option value="moderate">{$_('settings.advisor.alertModerate')}</option>
			<option value="relaxed">{$_('settings.advisor.alertRelaxed')}</option>
		</select>
	</div>
	<div class="setting-row">
		<label for="setting-phone" class="setting-label">{$_('settings.advisor.providerPhone')}</label>
		<input
			id="setting-phone"
			type="tel"
			class="setting-input"
			placeholder={$_('settings.advisor.providerPhonePlaceholder')}
			bind:value={$settings.hospitalAdvisor.providerPhone}
		/>
	</div>

	<!-- Threshold rule -->
	<div class="section-title" id="settings-threshold">{$_('settings.threshold.title')}</div>
	<p class="section-desc">{$_('settings.threshold.desc')}</p>
	<p class="section-desc section-desc--muted">{@html $_('settings.threshold.detailDesc')}</p>
	<div class="setting-row">
		<div class="setting-label-group">
			<label for="setting-interval" class="setting-label">{$_('settings.threshold.intervalTarget')}</label>
			<span class="setting-hint">{$_('settings.threshold.intervalHint')}</span>
		</div>
		<select id="setting-interval" class="setting-select" bind:value={$settings.threshold.intervalMinutes}>
			{#each [3, 4, 5, 6, 7, 8, 10] as mins}
				<option value={mins}>{$_('settings.threshold.intervalOption', { values: { mins } })}</option>
			{/each}
		</select>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<label for="setting-duration" class="setting-label">{$_('settings.threshold.durationTarget')}</label>
			<span class="setting-hint">{$_('settings.threshold.durationHint')}</span>
		</div>
		<select id="setting-duration" class="setting-select" bind:value={$settings.threshold.durationSeconds}>
			{#each [30, 45, 60, 75, 90, 120] as secs}
				<option value={secs}>{$_('settings.threshold.durationOption', { values: { secs } })}</option>
			{/each}
		</select>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<label for="setting-sustained" class="setting-label">{$_('settings.threshold.sustainedPeriod')}</label>
			<span class="setting-hint">{$_('settings.threshold.sustainedHint')}</span>
		</div>
		<select id="setting-sustained" class="setting-select" bind:value={$settings.threshold.sustainedMinutes}>
			{#each [30, 45, 60, 90, 120] as mins}
				<option value={mins}>{mins} min</option>
			{/each}
		</select>
	</div>

	<!-- Advanced -->
	<div class="section-title" id="settings-advanced">
		<button class="section-toggle" onclick={() => showAdvanced = !showAdvanced}>
			{$_('settings.advanced.title')} {showAdvanced ? '▾' : '▸'}
		</button>
	</div>

	{#if showAdvanced}
		<!-- Per-stage thresholds -->
		<div class="subsection-label">{$_('settings.advanced.stageThresholdsTitle')}</div>
		<p class="section-desc">{$_('settings.advanced.stageThresholdsDesc')}</p>
		{#each ['early', 'active', 'transition'] as stage}
			{#if $settings.stageThresholds[stage]}
				<div class="sub-row">
					<span class="sub-label">{$_('settings.advanced.maxInterval', { values: { stage: stage[0].toUpperCase() + stage.slice(1) } })}</span>
					<select class="setting-select" bind:value={$settings.stageThresholds[stage].maxIntervalMin}>
						{#each [3, 4, 5, 7, 10, 15, 20] as v}
							<option value={v}>{v} min</option>
						{/each}
					</select>
				</div>
				<div class="sub-row">
					<span class="sub-label">{$_('settings.advanced.minDuration', { values: { stage: stage[0].toUpperCase() + stage.slice(1) } })}</span>
					<select class="setting-select" bind:value={$settings.stageThresholds[stage].minDurationSec}>
						{#each [20, 30, 45, 60, 75, 90] as v}
							<option value={v}>{v}s</option>
						{/each}
					</select>
				</div>
			{/if}
		{/each}

		<!-- BH thresholds -->
		<div class="subsection-label">{$_('settings.advanced.bhThresholdsTitle')}</div>
		<p class="section-desc">{$_('settings.advanced.bhThresholdsDesc')}</p>
		<div class="sub-row" title="Lower = more regular pattern. Typical real labor is under 0.25.">
			<span class="sub-label">{$_('settings.advanced.regularityCVLow')}</span>
			<input type="number" class="setting-input setting-input--narrow" step="0.05" min="0" max="1" bind:value={$settings.bhThresholds.regularityCVLow} />
		</div>
		<div class="sub-row">
			<span class="sub-label">{$_('settings.advanced.regularityCVHigh')}</span>
			<input type="number" class="setting-input setting-input--narrow" step="0.05" min="0" max="1" bind:value={$settings.bhThresholds.regularityCVHigh} />
		</div>
		<div class="sub-row">
			<span class="sub-label">{$_('settings.advanced.realLaborThreshold')}</span>
			<input type="number" class="setting-input setting-input--narrow" step="5" min="0" max="100" bind:value={$settings.bhThresholds.verdictRealThreshold} />
		</div>
		<div class="sub-row">
			<span class="sub-label">{$_('settings.advanced.bhThreshold')}</span>
			<input type="number" class="setting-input setting-input--narrow" step="5" min="0" max="100" bind:value={$settings.bhThresholds.verdictBHThreshold} />
		</div>

		<!-- Reset -->
		<button class="reset-btn" onclick={resetAdvanced}>{$_('settings.advanced.resetToDefaults')}</button>
	{/if}

	<!-- Extras -->
	<div class="section-title" id="settings-extras">{$_('settings.extras.title')}</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<span id="label-prayers" class="setting-label">{$_('settings.extras.prayers')}</span>
			<span class="setting-hint">{$_('settings.extras.prayersHint')}</span>
		</div>
		<label class="toggle" aria-labelledby="label-prayers">
			<input type="checkbox" bind:checked={$settings.showPrayers} />
			<span class="toggle-slider"></span>
		</label>
	</div>
</div>

<style>
	.settings-content {
		padding: var(--space-1) var(--space-4) var(--space-5);
	}

	.section-title {
		font-size: var(--text-sm);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-faint);
		margin-top: var(--space-5);
		margin-bottom: var(--space-2);
		padding-bottom: var(--space-1);
		border-bottom: 1px solid var(--border-muted);
	}

	.section-title:first-child {
		margin-top: var(--space-2);
	}

	.setting-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--border-muted);
	}

	.setting-label { font-size: var(--text-base); color: var(--text-secondary); cursor: default; }

	.setting-label-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		flex: 1;
		min-width: 0;
		padding-right: var(--space-3);
	}

	.setting-hint {
		font-size: var(--text-xs);
		color: var(--text-faint);
		line-height: 1.4;
	}

	.section-desc {
		font-size: var(--text-xs);
		color: var(--text-faint);
		line-height: 1.4;
		margin: 0 0 var(--space-2) 0;
	}
	.section-desc--muted {
		color: var(--text-muted);
		font-style: italic;
	}

	.setting-select {
		background: var(--input-bg);
		border: 1px solid var(--input-border);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		padding: var(--space-1) var(--space-2);
		font-size: var(--text-sm);
	}

	/* Force option colors for browsers that support it (native dropdown popups escape scoped CSS) */
	:global(.setting-select option) {
		background: var(--bg-primary);
		color: var(--text-primary);
	}

	.setting-input {
		background: var(--input-bg);
		border: 1px solid var(--input-border);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		padding: var(--space-2) var(--space-3);
		font-size: var(--text-sm);
		width: 140px;
	}

	.toggle { position: relative; display: inline-block; width: 40px; height: 22px; }
	.toggle input { opacity: 0; width: 0; height: 0; }
	.toggle-slider {
		position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
		background: var(--toggle-bg); border-radius: var(--radius-full); transition: var(--transition-slow);
	}
	.toggle-slider::before {
		content: ''; position: absolute; height: var(--icon-sm); width: var(--icon-sm); left: 3px; bottom: 3px;
		background: var(--toggle-knob); border-radius: var(--radius-full); transition: var(--transition-slow);
	}
	.toggle input:checked + .toggle-slider { background: var(--accent); }
	.toggle input:checked + .toggle-slider::before { transform: translateX(18px); }

	.section-toggle {
		background: none;
		border: none;
		color: var(--text-faint);
		font-size: var(--text-sm);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		cursor: pointer;
		padding: 0;
	}

	.subsection-label {
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--text-muted);
		margin-top: var(--space-3);
		margin-bottom: var(--space-1);
	}

	.sub-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--border-muted);
	}

	.sub-label {
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.setting-input--narrow {
		width: 80px;
		text-align: center;
	}

	.reset-btn {
		width: 100%;
		margin-top: var(--space-4);
		padding: var(--space-3);
		border-radius: var(--radius-sm);
		border: 1px solid var(--danger-muted);
		background: none;
		color: var(--danger);
		font-size: var(--text-sm);
		cursor: pointer;
	}
</style>
