<script lang="ts">
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import { EMPTY_SESSION, DEFAULT_SETTINGS } from '../../lib/labor-logic/types';
	import { clearAllData, exportData, importData } from '../../lib/storage';

	let showClearConfirm = false;
	let importError = '';

	function handleClear() {
		if (!showClearConfirm) { showClearConfirm = true; return; }
		clearAllData();
		session.set({ ...EMPTY_SESSION, layout: [...EMPTY_SESSION.layout] });
		settings.set({ ...DEFAULT_SETTINGS });
		showClearConfirm = false;
	}

	function handleExport() {
		const json = exportData();
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `contractions-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function handleImport() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;
			try {
				const text = await file.text();
				importData(text);
				// Reload stores from localStorage
				window.location.reload();
			} catch (e) {
				importError = 'Invalid file format';
				setTimeout(() => importError = '', 3000);
			}
		};
		input.click();
	}
</script>

<div class="page">
	<h2 class="page-title">Settings</h2>

	<!-- Your situation -->
	<div class="section-title">Your situation</div>
	<div class="setting-row">
		<span class="setting-label">First baby?</span>
		<select class="setting-select" bind:value={$settings.parity}>
			<option value="first-baby">Yes, first baby</option>
			<option value="subsequent">No, had one before</option>
		</select>
	</div>

	<!-- Display -->
	<div class="section-title">Display</div>
	<div class="setting-row">
		<span class="setting-label">Time format</span>
		<select class="setting-select" bind:value={$settings.timeFormat}>
			<option value="12h">12 hour</option>
			<option value="24h">24 hour</option>
		</select>
	</div>
	<div class="setting-row">
		<span class="setting-label">Intensity scale</span>
		<select class="setting-select" bind:value={$settings.intensityScale}>
			<option value={5}>5 levels</option>
			<option value={3}>3 levels</option>
		</select>
	</div>
	<div class="setting-row">
		<span class="setting-label">Wave chart height</span>
		<select class="setting-select" bind:value={$settings.waveChartHeight}>
			<option value={100}>Small (100px)</option>
			<option value={150}>Medium (150px)</option>
			<option value={200}>Large (200px)</option>
			<option value={250}>Extra large (250px)</option>
		</select>
	</div>

	<!-- Behavior -->
	<div class="section-title">Behavior</div>
	<div class="setting-row">
		<span class="setting-label">Haptic feedback</span>
		<label class="toggle">
			<input type="checkbox" bind:checked={$settings.hapticFeedback} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<span class="setting-label">Post-contraction rating</span>
		<label class="toggle">
			<input type="checkbox" bind:checked={$settings.showPostRating} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<span class="setting-label">Show intensity picker</span>
		<label class="toggle">
			<input type="checkbox" bind:checked={$settings.showIntensityPicker} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<span class="setting-label">Show location picker</span>
		<label class="toggle">
			<input type="checkbox" bind:checked={$settings.showLocationPicker} />
			<span class="toggle-slider"></span>
		</label>
	</div>

	<!-- Features -->
	<div class="section-title">Features</div>
	<div class="setting-row">
		<span class="setting-label">Wave chart</span>
		<label class="toggle">
			<input type="checkbox" bind:checked={$settings.showWaveChart} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<span class="setting-label">Chart threshold overlay</span>
		<label class="toggle">
			<input type="checkbox" bind:checked={$settings.showChartOverlay} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<span class="setting-label">Trend analysis</span>
		<label class="toggle">
			<input type="checkbox" bind:checked={$settings.showProgressionInsight} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<span class="setting-label">Pattern assessment</span>
		<label class="toggle">
			<input type="checkbox" bind:checked={$settings.showBraxtonHicksAssessment} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<span class="setting-label">Hospital advisor</span>
		<label class="toggle">
			<input type="checkbox" bind:checked={$settings.showHospitalAdvisor} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<span class="setting-label">Contextual tips</span>
		<label class="toggle">
			<input type="checkbox" bind:checked={$settings.showContextualTips} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<span class="setting-label">Water break button</span>
		<label class="toggle">
			<input type="checkbox" bind:checked={$settings.showWaterBreakButton} />
			<span class="toggle-slider"></span>
		</label>
	</div>
	<div class="setting-row">
		<span class="setting-label">Clinical reference</span>
		<label class="toggle">
			<input type="checkbox" bind:checked={$settings.showClinicalReference} />
			<span class="toggle-slider"></span>
		</label>
	</div>

	<!-- Hospital advisor -->
	<div class="section-title">Hospital</div>
	<div class="setting-row">
		<span class="setting-label">Travel time</span>
		<select class="setting-select" bind:value={$settings.hospitalAdvisor.travelTimeMinutes}>
			{#each [5, 10, 15, 20, 25, 30, 45, 60, 90, 120] as mins}
				<option value={mins}>{mins} min</option>
			{/each}
		</select>
	</div>
	<div class="setting-row">
		<span class="setting-label">Risk comfort</span>
		<select class="setting-select" bind:value={$settings.hospitalAdvisor.riskAppetite}>
			<option value="conservative">Conservative (go early)</option>
			<option value="moderate">Moderate</option>
			<option value="relaxed">Relaxed (wait longer)</option>
		</select>
	</div>
	<div class="setting-row">
		<span class="setting-label">Provider phone</span>
		<input
			type="tel"
			class="setting-input"
			placeholder="e.g. 555-0123"
			bind:value={$settings.hospitalAdvisor.providerPhone}
		/>
	</div>

	<!-- Threshold rule -->
	<div class="section-title">Threshold rule</div>
	<div class="setting-row">
		<span class="setting-label">Interval target</span>
		<select class="setting-select" bind:value={$settings.threshold.intervalMinutes}>
			{#each [3, 4, 5, 6, 7, 8, 10] as mins}
				<option value={mins}>{mins} min apart</option>
			{/each}
		</select>
	</div>
	<div class="setting-row">
		<span class="setting-label">Duration target</span>
		<select class="setting-select" bind:value={$settings.threshold.durationSeconds}>
			{#each [30, 45, 60, 75, 90, 120] as secs}
				<option value={secs}>{secs}s long</option>
			{/each}
		</select>
	</div>
	<div class="setting-row">
		<span class="setting-label">Sustained period</span>
		<select class="setting-select" bind:value={$settings.threshold.sustainedMinutes}>
			{#each [30, 45, 60, 90, 120] as mins}
				<option value={mins}>{mins} min</option>
			{/each}
		</select>
	</div>

	<!-- Divider -->
	<div class="divider"></div>

	<!-- Export / Import -->
	<div class="data-section">
		<button class="data-btn" on:click={handleExport}>Export data (JSON)</button>
		<button class="data-btn" on:click={handleImport}>Import data</button>
		{#if importError}
			<div class="import-error">{importError}</div>
		{/if}
	</div>

	<!-- Clear data -->
	<div class="danger-zone">
		{#if showClearConfirm}
			<p class="danger-text">This will delete all contraction data. Are you sure?</p>
			<div class="danger-buttons">
				<button class="btn-danger" on:click={handleClear}>Yes, clear everything</button>
				<button class="btn-cancel" on:click={() => showClearConfirm = false}>Cancel</button>
			</div>
		{:else}
			<button class="btn-danger-outline" on:click={handleClear}>Clear all data</button>
		{/if}
	</div>

	<!-- About -->
	<div class="about">
		<p class="about-text">Contraction Timer v0.1.0</p>
		<p class="about-text">Data stays on this device.</p>
		<a href="https://github.com/cybersader/contractions-timer" target="_blank" rel="noopener" class="about-link">
			GitHub
		</a>
	</div>
</div>

<style>
	.section-title {
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: rgba(255, 255, 255, 0.35);
		margin-top: 20px;
		margin-bottom: 6px;
		padding-bottom: 4px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	}

	.setting-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.03);
	}

	.setting-label { font-size: 0.82rem; color: rgba(255, 255, 255, 0.7); }

	.setting-select {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		color: white;
		padding: 4px 8px;
		font-size: 0.78rem;
	}

	.setting-input {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		color: white;
		padding: 6px 10px;
		font-size: 0.78rem;
		width: 140px;
	}

	.toggle { position: relative; display: inline-block; width: 40px; height: 22px; }
	.toggle input { opacity: 0; width: 0; height: 0; }
	.toggle-slider {
		position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
		background: rgba(255, 255, 255, 0.15); border-radius: 22px; transition: 0.3s;
	}
	.toggle-slider::before {
		content: ''; position: absolute; height: 16px; width: 16px; left: 3px; bottom: 3px;
		background: white; border-radius: 50%; transition: 0.3s;
	}
	.toggle input:checked + .toggle-slider { background: #818cf8; }
	.toggle input:checked + .toggle-slider::before { transform: translateX(18px); }

	.divider { height: 1px; background: rgba(255, 255, 255, 0.06); margin: 20px 0; }

	/* Data section */
	.data-section { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
	.data-btn {
		flex: 1; min-width: 120px; padding: 10px;
		border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(255, 255, 255, 0.03);
		color: rgba(255, 255, 255, 0.6); font-size: 0.78rem; cursor: pointer;
	}
	.import-error { width: 100%; font-size: 0.75rem; color: #f87171; text-align: center; margin-top: 4px; }

	/* Danger zone */
	.danger-zone { padding: 16px 0; }
	.danger-text { color: #f87171; font-size: 0.82rem; margin-bottom: 8px; }
	.danger-buttons { display: flex; gap: 8px; }
	.btn-danger { padding: 8px 16px; border-radius: 8px; border: none; background: rgba(248, 113, 113, 0.15); color: #f87171; font-size: 0.82rem; font-weight: 600; cursor: pointer; }
	.btn-cancel { padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1); background: transparent; color: rgba(255, 255, 255, 0.6); font-size: 0.82rem; cursor: pointer; }
	.btn-danger-outline { padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(248, 113, 113, 0.3); background: transparent; color: #f87171; font-size: 0.82rem; cursor: pointer; }

	/* About */
	.about { margin-top: 24px; text-align: center; }
	.about-text { font-size: 0.72rem; color: rgba(255, 255, 255, 0.3); margin-bottom: 2px; }
	.about-link { font-size: 0.72rem; color: #818cf8; text-decoration: none; }
</style>
