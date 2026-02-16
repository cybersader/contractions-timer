<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { session } from '../../lib/stores/session';
	import { formatTimeShort, formatDurationShort } from '../../lib/labor-logic/formatters';

	let recent = $derived(
		$session.contractions
			.filter(c => c.end !== null)
			.slice(-3)
			.reverse()
	);

	function intensityDot(intensity: number): string {
		if (intensity >= 4) return 'dot--high';
		if (intensity >= 2) return 'dot--mid';
		return 'dot--low';
	}
</script>

{#if recent.length > 0}
	<div class="recent-list">
		{#each recent as c (c.id)}
			<div class="recent-item">
				<span class="recent-time">{formatTimeShort(new Date(c.start))}</span>
				<span class="recent-dur">{formatDurationShort((new Date(c.end!).getTime() - new Date(c.start).getTime()) / 1000)}</span>
				<span class="intensity-dot {intensityDot(c.intensity)}"></span>
			</div>
		{/each}
	</div>
{:else}
	<div class="recent-empty">{$_('timer.recentContractions.noCompleted')}</div>
{/if}

<style>
	.recent-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.recent-item {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-2);
		background: var(--bg-card-hover);
		border-radius: var(--radius-sm);
		font-size: var(--text-sm);
	}

	.recent-time {
		color: var(--text-secondary);
		min-width: 60px;
	}

	.recent-dur {
		color: var(--text-muted);
		font-family: 'JetBrains Mono', monospace;
		flex: 1;
	}

	.intensity-dot {
		width: var(--space-2);
		height: var(--space-2);
		border-radius: var(--radius-full);
		flex-shrink: 0;
	}

	.dot--low { background: var(--success); }
	.dot--mid { background: var(--warning); }
	.dot--high { background: var(--danger); }

	.recent-empty {
		font-size: var(--text-sm);
		color: var(--text-faint);
		text-align: center;
		padding: var(--space-2);
	}
</style>
