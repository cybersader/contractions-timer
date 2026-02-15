<script lang="ts">
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
	<div class="section-title" id="settings-situation">Your situation</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<label for="setting-parity" class="setting-label">First baby?</label>
			<span class="setting-hint">First labors typically last longer. This affects time estimates and stage duration ranges.</span>
		</div>
		<select id="setting-parity" class="setting-select" bind:value={$settings.parity}>
			<option value="first-baby">Yes, first baby</option>
			<option value="subsequent">No, had one before</option>
		</select>
	</div>

	<!-- Display -->
	<div class="section-title" id="settings-display">Display</div>
	<div class="setting-row">
		<label for="setting-time-format" class="setting-label">Time format</label>
		<select id="setting-time-format" class="setting-select" bind:value={$settings.timeFormat}>
			<option value="12h">12 hour</option>
			<option value="24h">24 hour</option>
		</select>
	</div>
	<div class="setting-row">
		<label for="setting-intensity" class="setting-label">Intensity scale</label>
		<select id="setting-intensity" class="setting-select" bind:value={$settings.intensityScale}>
			<option value={5}>5 levels</option>
			<option value={3}>3 levels</option>
		</select>
	</div>
	<div class="setting-row">
		<label for="setting-chart-height" class="setting-label">Wave chart height</label>
		<select id="setting-chart-height" class="setting-select" bind:value={$settings.waveChartHeight}>
			<option value={100}>Small (100px)</option>
			<option value={150}>Medium (150px)</option>
			<option value={200}>Large (200px)</option>
			<option value={250}>Extra large (250px)</option>
		</select>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<label for="setting-hero" class="setting-label">Hero display</label>
			<span class="setting-hint">Info card above the timer: stage label, action suggestion, or compact elapsed time.</span>
		</div>
		<select id="setting-hero" class="setting-select" bind:value={$settings.heroMode}>
			<option value="stage-badge">Stage badge</option>
			<option value="action-card">Action card</option>
			<option value="compact-timer">Compact timer</option>
		</select>
	</div>
	<div class="setting-row">
		<span id="label-rest-seconds" class="setting-label">Show rest in seconds</span>
		<label class="toggle" aria-labelledby="label-rest-seconds">
			<input type="checkbox" bind:checked={$settings.showRestSeconds} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<label for="setting-gap" class="setting-label">Session break threshold</label>
			<span class="setting-hint">Gaps longer than this are shown as separate sessions in the wave chart and trend analysis.</span>
		</div>
		<select id="setting-gap" class="setting-select" bind:value={$settings.chartGapThresholdMin}>
			<option value={0}>Off</option>
			<option value={15}>15 min</option>
			<option value={30}>30 min</option>
			<option value={60}>1 hour</option>
			<option value={120}>2 hours</option>
		</select>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<label for="setting-stage-basis" class="setting-label">Stage timer mode</label>
			<span class="setting-hint">How stage duration is calculated: from last contraction or continuously.</span>
		</div>
		<select id="setting-stage-basis" class="setting-select" bind:value={$settings.stageTimeBasis}>
			<option value="last-recorded">Last recorded</option>
			<option value="current-time">Current time</option>
		</select>
	</div>

	<!-- Behavior -->
	<div class="section-title" id="settings-behavior">Behavior</div>
	<div class="setting-row">
		<span id="label-haptic" class="setting-label">Haptic feedback</span>
		<label class="toggle" aria-labelledby="label-haptic">
			<input type="checkbox" bind:checked={$settings.hapticFeedback} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<span id="label-post-rating" class="setting-label">Post-contraction rating</span>
		<label class="toggle" aria-labelledby="label-post-rating">
			<input type="checkbox" bind:checked={$settings.showPostRating} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<span id="label-intensity-picker" class="setting-label">Show intensity picker</span>
		<label class="toggle" aria-labelledby="label-intensity-picker">
			<input type="checkbox" bind:checked={$settings.showIntensityPicker} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<span id="label-location-picker" class="setting-label">Show location picker</span>
		<label class="toggle" aria-labelledby="label-location-picker">
			<input type="checkbox" bind:checked={$settings.showLocationPicker} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<span id="label-live-rating" class="setting-label">Peak rating during contraction</span>
		<label class="toggle" aria-labelledby="label-live-rating">
			<input type="checkbox" bind:checked={$settings.showLiveRating} />
			<span class="toggle-slider"></span>
		</label>
	</div>

	<!-- Features -->
	<div class="section-title" id="settings-features">Features</div>
	<div class="setting-row">
		<span id="label-wave-chart" class="setting-label">Wave chart</span>
		<label class="toggle" aria-labelledby="label-wave-chart">
			<input type="checkbox" bind:checked={$settings.showWaveChart} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<span id="label-chart-overlay" class="setting-label">Show target lines on chart</span>
			<span class="setting-hint">Colored reference lines on the wave chart when contractions hit your timing targets.</span>
		</div>
		<label class="toggle" aria-labelledby="label-chart-overlay">
			<input type="checkbox" bind:checked={$settings.showChartOverlay} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<span id="label-trend" class="setting-label">Trend analysis</span>
			<span class="setting-hint">Linear regression on recent contractions to detect shortening intervals and longer durations.</span>
		</div>
		<label class="toggle" aria-labelledby="label-trend">
			<input type="checkbox" bind:checked={$settings.showProgressionInsight} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<span id="label-bh" class="setting-label">Pattern assessment</span>
			<span class="setting-hint">Weighted scoring of 6 criteria (regularity, duration trend, intensity, location, interval trend, sustained activity) to distinguish real labor from Braxton Hicks.</span>
		</div>
		<label class="toggle" aria-labelledby="label-bh">
			<input type="checkbox" bind:checked={$settings.showBraxtonHicksAssessment} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<span id="label-advisor" class="setting-label">Hospital advisor</span>
			<span class="setting-hint">Departure timing advice on the Advisor page based on your contraction pattern.</span>
		</div>
		<label class="toggle" aria-labelledby="label-advisor">
			<input type="checkbox" bind:checked={$settings.showHospitalAdvisor} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<span id="label-tips" class="setting-label">Contextual tips</span>
			<span class="setting-hint">Stage-appropriate guidance cards on the Timer and Advisor pages.</span>
		</div>
		<label class="toggle" aria-labelledby="label-tips">
			<input type="checkbox" bind:checked={$settings.showContextualTips} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<span id="label-water-btn" class="setting-label">Water break button</span>
		<label class="toggle" aria-labelledby="label-water-btn">
			<input type="checkbox" bind:checked={$settings.showWaterBreakButton} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<span id="label-threshold-rule" class="setting-label">Threshold rule progress</span>
			<span class="setting-hint">Show 5-1-1 (or custom) rule progress on the labor advisor page.</span>
		</div>
		<label class="toggle" aria-labelledby="label-threshold-rule">
			<input type="checkbox" bind:checked={$settings.showThresholdRule} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<span id="label-clinical" class="setting-label">Clinical reference</span>
			<span class="setting-hint">Labor guide on the Advisor page: stages, Braxton Hicks comparison, and warning signs.</span>
		</div>
		<label class="toggle" aria-labelledby="label-clinical">
			<input type="checkbox" bind:checked={$settings.showClinicalReference} />
			<span class="toggle-slider"></span>
		</label>
	</div>

	<!-- Advisor -->
	<div class="section-title" id="settings-advisor">Advisor</div>
	<p class="section-desc">These three settings work together: <strong>Detail level</strong> controls how much info the advisor shows. <strong>Alert timing</strong> shifts when "time to go" appears. <strong>Travel time</strong> adds buffer so you leave with time to spare.</p>
	<div class="setting-row">
		<div class="setting-label-group">
			<label for="setting-advisor-style" class="setting-label">Advisor detail level</label>
			<span class="setting-hint">Controls how much detail the hospital advisor shows: time ranges, urgency level, or a single-line summary.</span>
		</div>
		<select id="setting-advisor-style" class="setting-select" bind:value={$settings.advisorMode}>
			<option value="range">Detailed (range estimates)</option>
			<option value="urgency">Urgency only</option>
			<option value="minimal">Minimal</option>
		</select>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<label for="setting-travel" class="setting-label">Travel time</label>
			<span class="setting-hint">How long it takes to reach your hospital. Factored into departure timing.</span>
		</div>
		<select id="setting-travel" class="setting-select" bind:value={$settings.hospitalAdvisor.travelTimeMinutes}>
			{#each [5, 10, 15, 20, 25, 30, 45, 60, 90, 120] as mins}
				<option value={mins}>{mins} min</option>
			{/each}
		</select>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<label for="setting-risk" class="setting-label">Alert timing</label>
			<span class="setting-hint">Conservative alerts you earlier, relaxed waits longer. Affects when you see "time to go" advice.</span>
		</div>
		<select id="setting-risk" class="setting-select" bind:value={$settings.hospitalAdvisor.riskAppetite}>
			<option value="conservative">Conservative (go early)</option>
			<option value="moderate">Moderate</option>
			<option value="relaxed">Relaxed (wait longer)</option>
		</select>
	</div>
	<div class="setting-row">
		<label for="setting-phone" class="setting-label">Provider phone</label>
		<input
			id="setting-phone"
			type="tel"
			class="setting-input"
			placeholder="e.g. 555-0123"
			bind:value={$settings.hospitalAdvisor.providerPhone}
		/>
	</div>

	<!-- Threshold rule -->
	<div class="section-title" id="settings-threshold">Threshold rule</div>
	<p class="section-desc">The N-1-1 rule is clinical guidance (ACOG) for when to head to the hospital. Standard is 5-1-1: contractions 5 minutes apart, 1 minute long, for 1 hour. Your provider may recommend 3-1-1, 4-1-1, or other variations — adjust below.</p>
	<p class="section-desc section-desc--muted">Each criterion uses the <strong>average</strong> of recent contractions within the analysis window, not a single contraction. A contraction lasting 64s counts as "over 1 minute." These are guidelines, not absolute rules — always follow your provider's advice.</p>
	<div class="setting-row">
		<div class="setting-label-group">
			<label for="setting-interval" class="setting-label">Interval target</label>
			<span class="setting-hint">Average time between contraction starts (start-to-start). Checked when average ≤ this value.</span>
		</div>
		<select id="setting-interval" class="setting-select" bind:value={$settings.threshold.intervalMinutes}>
			{#each [3, 4, 5, 6, 7, 8, 10] as mins}
				<option value={mins}>{mins} min apart</option>
			{/each}
		</select>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<label for="setting-duration" class="setting-label">Duration target</label>
			<span class="setting-hint">Average contraction length (start to stop). Checked when average ≥ this value.</span>
		</div>
		<select id="setting-duration" class="setting-select" bind:value={$settings.threshold.durationSeconds}>
			{#each [30, 45, 60, 75, 90, 120] as secs}
				<option value={secs}>{secs}s long</option>
			{/each}
		</select>
	</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<label for="setting-sustained" class="setting-label">Sustained period</label>
			<span class="setting-hint">Total span from first to most recent contraction. Checked when ≥ this value, confirming the pattern is consistent, not a one-off cluster.</span>
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
			Advanced {showAdvanced ? '▾' : '▸'}
		</button>
	</div>

	{#if showAdvanced}
		<!-- Per-stage thresholds -->
		<div class="subsection-label">Stage thresholds</div>
		<p class="section-desc">Define contraction patterns for each labor stage. Based on ACOG guidelines. Max interval = longest gap between contractions; min duration = shortest contraction length.</p>
		{#each ['early', 'active', 'transition'] as stage}
			{#if $settings.stageThresholds[stage]}
				<div class="sub-row">
					<span class="sub-label">{stage[0].toUpperCase() + stage.slice(1)} max interval</span>
					<select class="setting-select" bind:value={$settings.stageThresholds[stage].maxIntervalMin}>
						{#each [3, 4, 5, 7, 10, 15, 20] as v}
							<option value={v}>{v} min</option>
						{/each}
					</select>
				</div>
				<div class="sub-row">
					<span class="sub-label">{stage[0].toUpperCase() + stage.slice(1)} min duration</span>
					<select class="setting-select" bind:value={$settings.stageThresholds[stage].minDurationSec}>
						{#each [20, 30, 45, 60, 75, 90] as v}
							<option value={v}>{v}s</option>
						{/each}
					</select>
				</div>
			{/if}
		{/each}

		<!-- BH thresholds -->
		<div class="subsection-label">Pattern assessment thresholds</div>
		<p class="section-desc">Fine-tune how we distinguish practice contractions from real labor. Most users should leave these at defaults.</p>
		<div class="sub-row" title="Lower = more regular pattern. Typical real labor is under 0.25.">
			<span class="sub-label">Regularity CV (low)</span>
			<input type="number" class="setting-input setting-input--narrow" step="0.05" min="0" max="1" bind:value={$settings.bhThresholds.regularityCVLow} />
		</div>
		<div class="sub-row">
			<span class="sub-label">Regularity CV (high)</span>
			<input type="number" class="setting-input setting-input--narrow" step="0.05" min="0" max="1" bind:value={$settings.bhThresholds.regularityCVHigh} />
		</div>
		<div class="sub-row">
			<span class="sub-label">Real labor threshold</span>
			<input type="number" class="setting-input setting-input--narrow" step="5" min="0" max="100" bind:value={$settings.bhThresholds.verdictRealThreshold} />
		</div>
		<div class="sub-row">
			<span class="sub-label">BH threshold</span>
			<input type="number" class="setting-input setting-input--narrow" step="5" min="0" max="100" bind:value={$settings.bhThresholds.verdictBHThreshold} />
		</div>

		<!-- Reset -->
		<button class="reset-btn" onclick={resetAdvanced}>Reset advanced to defaults</button>
	{/if}

	<!-- Extras -->
	<div class="section-title" id="settings-extras">Extras</div>
	<div class="setting-row">
		<div class="setting-label-group">
			<span id="label-prayers" class="setting-label">Prayers</span>
			<span class="setting-hint">Show the Prayers tab in the menu. Always visible on Cathedral and Shire themes.</span>
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
