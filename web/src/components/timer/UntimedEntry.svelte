<script lang="ts">
	import { _ } from '../../lib/i18n/index';
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import { generateId, formatTimeShort } from '../../lib/labor-logic/formatters';
	import { haptic } from '../../lib/haptic';
	import { ClipboardList, Minus, Plus, Check } from 'lucide-svelte';

	let open = $state(false);
	let minutesAgo = $state(5);
	let durationSec = $state(60);
	let intensity: number | null = $state(null);
	let location: string | null = $state(null);

	function toggle() {
		open = !open;
		if (open) {
			minutesAgo = 5;
			durationSec = 60;
			intensity = null;
			location = null;
		}
	}

	function adjustMinutesAgo(delta: number) {
		minutesAgo = Math.max(0, Math.min(720, minutesAgo + delta));
		if ($settings.hapticFeedback) haptic(20);
	}

	function adjustDuration(delta: number) {
		durationSec = Math.max(15, Math.min(300, durationSec + delta));
		if ($settings.hapticFeedback) haptic(20);
	}

	let startTime = $derived(new Date(Date.now() - minutesAgo * 60000));
	let endTime = $derived(new Date(startTime.getTime() + durationSec * 1000));

	function logContraction() {
		if ($settings.hapticFeedback) haptic(50);
		session.update(s => ({
			...s,
			contractions: [...s.contractions, {
				id: generateId(),
				start: startTime.toISOString(),
				end: endTime.toISOString(),
				intensity: intensity as any,
				location: location as any,
				notes: '',
				untimed: true,
			}].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
		}));
		open = false;
	}

	let durationLabel = $derived(
		durationSec >= 60
			? `${Math.floor(durationSec / 60)}m ${durationSec % 60 ? durationSec % 60 + 's' : ''}`
			: `${durationSec}s`
	);
</script>

<div class="untimed-section">
	<button class="untimed-toggle" onclick={toggle}>
		<ClipboardList size={14} aria-hidden="true" />
		<span>{open ? $_('common.cancel') : $_('timer.untimedEntry.logPastContraction')}</span>
	</button>

	{#if open}
		<div class="untimed-form">
			<p class="form-intro">{$_('timer.untimedEntry.formIntro')}</p>

			<!-- When -->
			<div class="form-group">
				<span class="form-label">{$_('timer.untimedEntry.whenLabel')}</span>
				<div class="stepper">
					<button class="stepper-btn" onclick={() => adjustMinutesAgo(5)} aria-label={$_('timer.untimedEntry.earlierAriaLabel')}>
						<Minus size={16} />
					</button>
					<span class="stepper-value">{$_('timer.untimedEntry.minutesAgo', { values: { count: minutesAgo } })}</span>
					<button class="stepper-btn" onclick={() => adjustMinutesAgo(-5)} aria-label={$_('timer.untimedEntry.moreRecentAriaLabel')}>
						<Plus size={16} />
					</button>
				</div>
			</div>
			<div class="form-hint">{formatTimeShort(startTime)}</div>

			<!-- Duration -->
			<div class="form-group">
				<span class="form-label">{$_('timer.untimedEntry.durationLabel')}</span>
				<div class="stepper">
					<button class="stepper-btn" onclick={() => adjustDuration(-15)} aria-label={$_('timer.untimedEntry.shorterAriaLabel')}>
						<Minus size={16} />
					</button>
					<span class="stepper-value">{durationLabel}</span>
					<button class="stepper-btn" onclick={() => adjustDuration(15)} aria-label={$_('timer.untimedEntry.longerAriaLabel')}>
						<Plus size={16} />
					</button>
				</div>
			</div>

			<!-- Intensity (optional) -->
			<div class="form-group">
				<span class="form-label">{$_('timer.untimedEntry.intensityLabel')} <span class="optional">{$_('timer.untimedEntry.optional')}</span></span>
				<div class="pill-row">
					{#each [1, 2, 3, 4, 5] as level}
						<button
							class="pill"
							class:selected={intensity === level}
							onclick={() => { intensity = intensity === level ? null : level; if ($settings.hapticFeedback) haptic(20); }}
						>
							{level}
						</button>
					{/each}
				</div>
			</div>

			<!-- Location (optional) -->
			<div class="form-group">
				<span class="form-label">{$_('timer.untimedEntry.locationLabel')} <span class="optional">{$_('timer.untimedEntry.optional')}</span></span>
				<div class="pill-row">
					{#each [['front', $_('timer.untimedEntry.front')], ['back', $_('timer.untimedEntry.back')], ['wrapping', $_('timer.untimedEntry.wrap')]] as [val, label]}
						<button
							class="pill pill--wide"
							class:selected={location === val}
							onclick={() => { location = location === val ? null : val; if ($settings.hapticFeedback) haptic(20); }}
						>
							{label}
						</button>
					{/each}
				</div>
			</div>

			<button class="log-btn" onclick={logContraction}>
				<Check size={16} aria-hidden="true" />
				{$_('timer.untimedEntry.logContraction')}
			</button>
		</div>
	{/if}
</div>

<style>
	.untimed-section {
		margin-top: var(--space-3);
	}

	.untimed-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-2);
		border-radius: var(--radius-sm);
		border: 1px dashed var(--border);
		background: none;
		color: var(--text-muted);
		font-size: var(--text-sm);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.untimed-toggle:active {
		background: var(--bg-card-hover);
	}

	.untimed-form {
		margin-top: var(--space-2);
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: var(--space-4);
	}

	.form-intro {
		font-size: var(--text-sm);
		color: var(--text-muted);
		text-align: center;
		margin-bottom: var(--space-3);
	}

	.form-group {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-2) 0;
	}

	.form-label {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		font-weight: 500;
	}

	.optional {
		font-size: var(--text-xs);
		color: var(--text-faint);
		font-weight: 400;
	}

	.form-hint {
		font-size: var(--text-xs);
		color: var(--text-faint);
		text-align: right;
		margin-top: calc(var(--space-1) * -1);
		margin-bottom: var(--space-1);
	}

	.stepper {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.stepper-btn {
		width: var(--btn-height-sm);
		height: var(--btn-height-sm);
		border-radius: var(--radius-sm);
		border: 1px solid var(--input-border);
		background: var(--bg-card);
		color: var(--text-secondary);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		-webkit-tap-highlight-color: transparent;
	}

	.stepper-btn:active {
		background: var(--bg-card-hover);
	}

	.stepper-value {
		min-width: 72px;
		text-align: center;
		font-size: var(--text-base);
		color: var(--text-primary);
		font-family: 'JetBrains Mono', monospace;
	}

	.pill-row {
		display: flex;
		gap: var(--space-2);
	}

	.pill {
		min-width: var(--btn-height-sm);
		min-height: var(--btn-height-sm);
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-sm);
		border: 1px solid var(--input-border);
		background: var(--bg-card);
		color: var(--text-muted);
		font-size: var(--text-sm);
		font-weight: 500;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		-webkit-tap-highlight-color: transparent;
	}

	.pill--wide {
		padding: var(--space-1) var(--space-3);
	}

	.pill:active {
		transform: scale(0.95);
	}

	.pill.selected {
		background: var(--accent-muted);
		border-color: var(--accent);
		color: var(--accent);
	}

	.log-btn {
		width: 100%;
		padding: var(--space-3);
		border-radius: var(--radius-sm);
		border: none;
		background: var(--accent-muted);
		color: var(--accent);
		font-size: var(--text-base);
		font-weight: 600;
		cursor: pointer;
		margin-top: var(--space-3);
		-webkit-tap-highlight-color: transparent;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
	}

	.log-btn:active {
		opacity: 0.8;
	}
</style>
