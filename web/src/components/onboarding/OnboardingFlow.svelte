<script lang="ts">
	import { settings } from '../../lib/stores/settings';
	import { HeartPulse, Baby, Car, ChevronRight, Check, Phone } from 'lucide-svelte';

	interface Props {
		onComplete: () => void;
	}
	let { onComplete } = $props<Props>();

	let step = $state(0);

	// Quick setup values (pre-filled from defaults)
	let parity = $state<'first-baby' | 'subsequent'>('first-baby');
	let travelTime = $state(30);
	let travelUncertain = $state(false);
	let providerPhone = $state('');

	function selectTravelTime(mins: number) {
		travelTime = mins;
		travelUncertain = false;
	}

	function selectUncertain() {
		travelUncertain = true;
		travelTime = 0;
	}

	function skip() {
		markDone();
		onComplete();
	}

	function finish() {
		settings.update(s => ({
			...s,
			parity,
			hospitalAdvisor: {
				...s.hospitalAdvisor,
				travelTimeMinutes: travelUncertain ? 0 : travelTime,
				travelTimeUncertain: travelUncertain,
				providerPhone: providerPhone.trim() || s.hospitalAdvisor.providerPhone,
			},
		}));
		markDone();
		onComplete();
	}

	function markDone() {
		try {
			localStorage.setItem('ct-onboarding-done', '1');
		} catch { /* ignore */ }
	}
</script>

<div class="onboarding-overlay">
	<div class="onboarding-card">
		{#if step === 0}
			<!-- Step 1: Welcome -->
			<div class="step step-welcome">
				<div class="step-icon">
					<HeartPulse size={36} />
				</div>
				<h1 class="step-title">Contraction Timer</h1>
				<p class="step-desc">Track contractions, see patterns, and know when it's time to go to the hospital.</p>
				<p class="step-sub">All data stays on this device. No accounts needed.</p>

				<button class="onboarding-btn onboarding-btn-primary" onclick={() => step = 1}>
					Get started
					<ChevronRight size={18} />
				</button>
				<button class="onboarding-btn onboarding-btn-ghost" onclick={skip}>
					Skip setup
				</button>
			</div>

		{:else if step === 1}
			<!-- Step 2: Quick setup -->
			<div class="step step-setup">
				<h2 class="step-title">Quick setup</h2>
				<p class="step-desc">Two quick questions to personalize your experience.</p>

				<div class="setup-group">
					<label class="setup-label">
						<Baby size={18} />
						Is this your first baby?
					</label>
					<div class="setup-options">
						<button
							class="option-btn"
							class:option-active={parity === 'first-baby'}
							onclick={() => parity = 'first-baby'}
						>
							Yes, first
						</button>
						<button
							class="option-btn"
							class:option-active={parity === 'subsequent'}
							onclick={() => parity = 'subsequent'}
						>
							No, had one before
						</button>
					</div>
				</div>

				<div class="setup-group">
					<label class="setup-label">
						<Car size={18} />
						How far is your hospital?
					</label>
					<div class="setup-options setup-options-wrap">
						{#each [10, 15, 20, 30, 45, 60] as mins}
							<button
								class="option-btn"
								class:option-active={!travelUncertain && travelTime === mins}
								onclick={() => selectTravelTime(mins)}
							>
								{mins} min
							</button>
						{/each}
						<button
							class="option-btn"
							class:option-active={travelUncertain}
							onclick={selectUncertain}
						>
							Not sure
						</button>
					</div>
					{#if travelUncertain}
						<p class="setup-hint">No problem — we'll use a conservative estimate and give you a range.</p>
					{/if}
				</div>

				<div class="setup-group">
					<label class="setup-label">
						<Phone size={18} />
						Provider or hospital phone (optional)
					</label>
					<input
						type="tel"
						class="setup-input"
						placeholder="(555) 123-4567"
						bind:value={providerPhone}
					/>
					<p class="setup-hint">Quick-dial from the app when it's time to call.</p>
				</div>

				<button class="onboarding-btn onboarding-btn-primary" onclick={() => step = 2}>
					Continue
					<ChevronRight size={18} />
				</button>
				<button class="onboarding-btn onboarding-btn-ghost" onclick={skip}>
					Skip
				</button>
			</div>

		{:else}
			<!-- Step 3: Ready -->
			<div class="step step-ready">
				<div class="step-icon step-icon-success">
					<Check size={36} />
				</div>
				<h2 class="step-title">You're all set</h2>
				<p class="step-desc">Tap the big button when a contraction starts. Tap again when it ends. The app does the rest.</p>

				<div class="ready-summary">
					<div class="summary-item">
						<Baby size={16} />
						<span>{parity === 'first-baby' ? 'First baby' : 'Not first baby'}</span>
					</div>
					<div class="summary-item">
						<Car size={16} />
						<span>{travelUncertain ? 'Travel time: not sure' : `${travelTime} min to hospital`}</span>
					</div>
					{#if providerPhone.trim()}
						<div class="summary-item">
							<Phone size={16} />
							<span>{providerPhone.trim()}</span>
						</div>
					{/if}
				</div>

				<button class="onboarding-btn onboarding-btn-primary" onclick={finish}>
					Start tracking
				</button>
			</div>
		{/if}

		<!-- Progress dots -->
		<div class="progress-dots">
			{#each [0, 1, 2] as i}
				<div class="dot" class:dot-active={step === i} class:dot-done={step > i}></div>
			{/each}
		</div>
	</div>
</div>

<style>
	.onboarding-overlay {
		position: fixed;
		inset: 0;
		background: var(--bg-overlay, rgba(0, 0, 0, 0.6));
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-4);
		animation: fadeIn 300ms ease-out;
	}

	.onboarding-card {
		background: var(--bg-primary);
		border-radius: var(--radius-lg);
		padding: var(--space-6) var(--space-5);
		max-width: 400px;
		width: 100%;
		max-height: 90dvh;
		overflow-y: auto;
		box-shadow: var(--shadow-lg);
		animation: slideUp 300ms ease-out;
	}

	.step {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	.step-icon {
		width: 72px;
		height: 72px;
		border-radius: var(--radius-xl);
		background: var(--accent-muted);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--accent);
		margin-bottom: var(--space-4);
	}

	.step-icon-success {
		background: var(--success-muted);
		color: var(--success);
	}

	.step-title {
		font-size: var(--text-xl);
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: var(--space-2);
	}

	.step-desc {
		font-size: var(--text-base);
		color: var(--text-secondary);
		line-height: 1.5;
		margin-bottom: var(--space-2);
		max-width: 320px;
	}

	.step-sub {
		font-size: var(--text-sm);
		color: var(--text-faint);
		margin-bottom: var(--space-5);
	}

	/* Setup groups */
	.setup-group {
		width: 100%;
		text-align: left;
		margin-bottom: var(--space-4);
	}

	.setup-label {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-base);
		font-weight: 500;
		color: var(--text-primary);
		margin-bottom: var(--space-2);
	}

	.setup-label :global(svg) {
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.setup-options {
		display: flex;
		gap: var(--space-2);
	}

	.setup-options-wrap {
		flex-wrap: wrap;
	}

	.setup-input {
		width: 100%;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		background: var(--bg-card);
		color: var(--text-primary);
		font-size: var(--text-base);
		font-family: inherit;
		outline: none;
		transition: border-color var(--transition-fast);
	}

	.setup-input:focus {
		border-color: var(--accent);
	}

	.setup-input::placeholder {
		color: var(--text-faint);
	}

	.setup-hint {
		font-size: var(--text-xs);
		color: var(--text-muted);
		margin-top: var(--space-1);
		line-height: 1.4;
	}

	.option-btn {
		flex: 1;
		min-width: fit-content;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		background: var(--bg-card);
		color: var(--text-secondary);
		font-size: var(--text-sm);
		cursor: pointer;
		transition: all var(--transition-fast);
		-webkit-tap-highlight-color: transparent;
	}

	.option-btn:active {
		transform: scale(0.97);
	}

	.option-btn.option-active {
		border-color: var(--accent);
		background: var(--accent-muted);
		color: var(--accent);
		font-weight: 500;
	}

	/* Buttons */
	.onboarding-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-3) var(--space-5);
		border-radius: var(--radius-md);
		border: none;
		font-size: var(--text-base);
		font-weight: 600;
		cursor: pointer;
		transition: all var(--transition-fast);
		-webkit-tap-highlight-color: transparent;
	}

	.onboarding-btn:active {
		transform: scale(0.97);
	}

	.onboarding-btn-primary {
		background: var(--accent);
		color: white;
		margin-top: var(--space-3);
	}

	.onboarding-btn-ghost {
		background: transparent;
		color: var(--text-muted);
		margin-top: var(--space-2);
	}

	/* Ready summary */
	.ready-summary {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-3);
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		margin-top: var(--space-3);
		margin-bottom: var(--space-2);
	}

	.summary-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.summary-item :global(svg) {
		color: var(--text-muted);
		flex-shrink: 0;
	}

	/* Progress dots */
	.progress-dots {
		display: flex;
		justify-content: center;
		gap: var(--space-2);
		margin-top: var(--space-5);
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: var(--radius-full);
		background: var(--border);
		transition: all var(--transition-base);
	}

	.dot-active {
		background: var(--accent);
		width: 24px;
	}

	.dot-done {
		background: var(--accent);
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes slideUp {
		from { opacity: 0; transform: translateY(16px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
