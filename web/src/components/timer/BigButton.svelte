<script lang="ts">
	import { session } from '../../lib/stores/session';
	import { timerPhase } from '../../lib/stores/timer';
	import { isContractionActive } from '../../lib/labor-logic/calculations';
	import { generateId } from '../../lib/labor-logic/formatters';
	import { haptic } from '../../lib/haptic';
	import { dlog } from '../../lib/debug-log';

	let phase = $derived($timerPhase);
	let contractionCount = $derived($session.contractions.filter(c => c.end !== null).length);

	function startContraction() {
		haptic(80);
		const id = generateId();
		const now = new Date().toISOString();
		dlog('session', 'Contraction started', { id, timestamp: now, number: contractionCount + 1 }, { src: 'BigButton' });
		session.update(s => ({
			...s,
			contractions: [...s.contractions, {
				id,
				start: now,
				end: null,
				intensity: null,
				location: null,
				notes: '',
			}],
			sessionStartedAt: s.sessionStartedAt ?? now,
		}));
	}

	function stopContraction() {
		haptic(40);
		const now = new Date().toISOString();
		dlog('session', 'Contraction stopped', { timestamp: now, number: contractionCount }, { src: 'BigButton' });
		session.update(s => ({
			...s,
			contractions: s.contractions.map(c =>
				isContractionActive(c)
					? { ...c, end: now }
					: c
			),
		}));
	}

	function handleClick() {
		if (phase === 'contracting') {
			stopContraction();
		} else {
			startContraction();
		}
	}
</script>

<button
	class="big-button"
	class:contracting={phase === 'contracting'}
	class:resting={phase === 'resting'}
	onclick={handleClick}
>
	<span class="big-button-text">
		{#if phase === 'contracting'}
			Stop
		{:else if phase === 'idle'}
			Start
		{:else}
			Start #{contractionCount + 1}
		{/if}
	</span>
</button>

<style>
	.big-button {
		width: 100%;
		max-width: 320px;
		margin: 0 auto;
		display: block;
		padding: var(--space-5) var(--space-6);
		border-radius: var(--radius-xl);
		border: 2px solid var(--big-button-border, var(--accent-muted));
		background: var(--big-button-bg, var(--accent-muted));
		color: var(--big-button-color, var(--accent));
		box-shadow: var(--big-button-glow, none);
		font-size: var(--text-2xl);
		font-weight: 700;
		cursor: pointer;
		transition: all var(--transition-base);
		-webkit-tap-highlight-color: transparent;
	}

	.big-button:active {
		transform: scale(0.97);
	}

	.big-button.contracting {
		background: var(--big-button-active-bg, var(--danger-muted));
		border-color: var(--big-button-active-border, var(--danger-muted));
		color: var(--big-button-active-color, var(--danger));
		box-shadow: var(--big-button-active-glow, 0 0 0 0 var(--danger-muted));
		animation: pulse-red 1.5s ease-in-out infinite;
	}

	.big-button.resting {
		background: var(--big-button-rest-bg, var(--success-muted));
		border-color: var(--big-button-rest-border, var(--success-muted));
		color: var(--big-button-rest-color, var(--success));
	}

	@keyframes pulse-red {
		0%, 100% { box-shadow: var(--big-button-active-glow, 0 0 0 0 var(--danger-muted)); }
		50% { box-shadow: 0 0 0 12px transparent; }
	}

	.big-button-text {
		display: block;
		text-align: center;
	}
</style>
