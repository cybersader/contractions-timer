<script lang="ts">
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import { getDurationSeconds, getSessionFilteredIntervals, getLatestSession, getTrend, estimateTimeTo511 } from '../../lib/labor-logic/calculations';
	import { formatDurationShort, formatInterval } from '../../lib/labor-logic/formatters';

	$: gapMin = $settings.chartGapThresholdMin;
	$: threshold = $settings.threshold;

	$: allCompleted = $session.contractions.filter(c => c.end !== null);
	$: completed = gapMin > 0 ? getLatestSession(allCompleted, gapMin) : allCompleted;
	$: hasEnough = completed.length >= 4;

	$: durations = completed.map(getDurationSeconds);
	$: intervals = gapMin > 0
		? getSessionFilteredIntervals(completed, gapMin)
		: completed.slice(1).map((c, i) =>
			(new Date(c.start).getTime() - new Date(completed[i].start).getTime()) / 60000
		);

	$: durationTrend = hasEnough ? getTrend(durations) : null;
	$: intervalTrend = hasEnough && intervals.length >= 3 ? getTrend(intervals) : null;
	$: estimate = hasEnough ? estimateTimeTo511(completed, threshold, gapMin) : null;
</script>

<div class="insight">
	{#if !hasEnough}
		<div class="placeholder">Need 4+ contractions to analyze trends</div>
	{:else}
		<div class="section-label">Trends</div>

		{#if intervalTrend}
			<div class="insight-row">
				<span class="label">Gap between:</span>
				<span class="value value--{intervalTrend.direction}">
					{formatInterval(intervalTrend.firstValue)} → {formatInterval(intervalTrend.lastValue)}
					({intervalTrend.direction === 'decreasing' ? 'getting closer' : intervalTrend.direction === 'increasing' ? 'spreading apart' : 'stable'}
					{intervalTrend.direction === 'decreasing' ? '↓' : intervalTrend.direction === 'increasing' ? '↑' : '↔'})
				</span>
			</div>
		{/if}

		{#if durationTrend}
			<div class="insight-row">
				<span class="label">Each contraction:</span>
				<span class="value value--{durationTrend.direction === 'increasing' ? 'decreasing' : durationTrend.direction === 'decreasing' ? 'increasing' : 'stable'}">
					{formatDurationShort(durationTrend.firstValue)} → {formatDurationShort(durationTrend.lastValue)}
					({durationTrend.direction === 'increasing' ? 'lasting longer' : durationTrend.direction === 'decreasing' ? 'getting shorter' : 'stable'}
					{durationTrend.direction === 'increasing' ? '↑' : durationTrend.direction === 'decreasing' ? '↓' : '↔'})
				</span>
			</div>
		{/if}

		{#if estimate !== null}
			<div class="estimate">
				{#if estimate === 0}
					{threshold.intervalMinutes}-1-1 criteria currently met
				{:else}
					At this pace, may reach {threshold.intervalMinutes}-1-1 in ~{estimate} min
				{/if}
			</div>
			<div class="disclaimer">Based on last {intervals.length} interval{intervals.length !== 1 ? 's' : ''} (this session)</div>
		{/if}
	{/if}
</div>

<style>
	.placeholder {
		text-align: center;
		padding: 16px;
		color: rgba(255, 255, 255, 0.3);
		font-size: 0.78rem;
	}

	.section-label {
		font-size: 0.82rem;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.7);
		margin-bottom: 8px;
	}

	.insight-row {
		margin-bottom: 6px;
	}

	.label {
		font-size: 0.78rem;
		color: rgba(255, 255, 255, 0.5);
	}

	.value {
		font-size: 0.78rem;
		color: rgba(255, 255, 255, 0.7);
	}

	.value--decreasing { color: #4ade80; }
	.value--increasing { color: #f87171; }
	.value--stable { color: rgba(255, 255, 255, 0.5); }

	.estimate {
		margin-top: 10px;
		padding: 8px 12px;
		background: rgba(129, 140, 248, 0.06);
		border: 1px solid rgba(129, 140, 248, 0.15);
		border-radius: 8px;
		font-size: 0.78rem;
		color: #a5b4fc;
	}

	.disclaimer {
		font-size: 0.68rem;
		color: rgba(255, 255, 255, 0.25);
		margin-top: 4px;
		text-align: center;
	}
</style>
