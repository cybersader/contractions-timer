<script lang="ts">
	import { session } from '../../lib/stores/session';
	import { timerPhase } from '../../lib/stores/timer';
	import { isContractionActive } from '../../lib/labor-logic/calculations';
	import { generateId } from '../../lib/labor-logic/formatters';
	import { haptic } from '../../lib/haptic';

	$: phase = $timerPhase;
	$: contractionCount = $session.contractions.filter(c => c.end !== null).length;

	function startContraction() {
		haptic(80);
		session.update(s => ({
			...s,
			contractions: [...s.contractions, {
				id: generateId(),
				start: new Date().toISOString(),
				end: null,
				intensity: null,
				location: null,
				notes: '',
			}],
			sessionStartedAt: s.sessionStartedAt ?? new Date().toISOString(),
		}));
	}

	function stopContraction() {
		haptic(40);
		session.update(s => ({
			...s,
			contractions: s.contractions.map(c =>
				isContractionActive(c)
					? { ...c, end: new Date().toISOString() }
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
	on:click={handleClick}
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
		padding: 24px 32px;
		border-radius: 20px;
		border: 2px solid rgba(129, 140, 248, 0.3);
		background: rgba(129, 140, 248, 0.08);
		color: #818cf8;
		font-size: 1.5rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s ease;
		-webkit-tap-highlight-color: transparent;
	}

	.big-button:active {
		transform: scale(0.97);
	}

	.big-button.contracting {
		background: rgba(248, 113, 113, 0.12);
		border-color: rgba(248, 113, 113, 0.4);
		color: #f87171;
		animation: pulse-red 1.5s ease-in-out infinite;
	}

	.big-button.resting {
		background: rgba(74, 222, 128, 0.08);
		border-color: rgba(74, 222, 128, 0.3);
		color: #4ade80;
	}

	@keyframes pulse-red {
		0%, 100% { box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.2); }
		50% { box-shadow: 0 0 0 12px rgba(248, 113, 113, 0); }
	}

	.big-button-text {
		display: block;
		text-align: center;
	}
</style>
