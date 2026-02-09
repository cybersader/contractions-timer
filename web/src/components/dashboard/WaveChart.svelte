<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import { tick } from '../../lib/stores/timer';
	import { getDurationSeconds, isContractionActive, getElapsedSeconds } from '../../lib/labor-logic/calculations';
	import { formatTimeShort, formatElapsedApprox } from '../../lib/labor-logic/formatters';
	import type { Contraction, LaborEvent } from '../../lib/labor-logic/types';

	interface Segment {
		contractions: Contraction[];
		startMs: number;
		endMs: number;
		durationMs: number;
	}

	const BREAK_WIDTH = 50;
	const PADDING = 20;

	let canvas: HTMLCanvasElement;
	let container: HTMLElement;
	let fitToView = false;

	$: chartHeight = $settings.waveChartHeight || 150;
	$: gapThresholdMin = $settings.chartGapThresholdMin || 30;
	$: showOverlay = $settings.showChartOverlay;
	$: threshold = $settings.threshold;
	$: contractions = $session.contractions;
	$: events = $session.events;

	// Re-render on tick (for active contraction updates)
	$: if ($tick && canvas) render();

	onMount(() => { render(); });
	afterUpdate(() => { render(); });

	function getIntensityColor(level: number, alpha: number): string {
		const colors: Record<number, [number, number, number]> = {
			1: [100, 180, 220],
			2: [120, 200, 150],
			3: [220, 200, 80],
			4: [230, 140, 60],
			5: [220, 80, 80],
		};
		const [r, g, b] = colors[level] || colors[3];
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}

	function buildSegments(allContractions: Contraction[], active: Contraction | undefined): Segment[] {
		if (allContractions.length === 0) return [];
		const gapThresholdMs = gapThresholdMin > 0 ? gapThresholdMin * 60000 : 0;

		if (gapThresholdMs === 0) {
			const firstStart = new Date(allContractions[0].start).getTime();
			const lastTime = active ? Date.now() : new Date(allContractions[allContractions.length - 1].start).getTime();
			return [{ contractions: allContractions, startMs: firstStart, endMs: lastTime, durationMs: Math.max(lastTime - firstStart, 60000) }];
		}

		const segments: Segment[] = [];
		let current: Contraction[] = [allContractions[0]];

		for (let i = 1; i < allContractions.length; i++) {
			const prevStart = new Date(allContractions[i - 1].start).getTime();
			const currStart = new Date(allContractions[i].start).getTime();
			if (currStart - prevStart > gapThresholdMs) {
				segments.push(makeSegment(current, false));
				current = [allContractions[i]];
			} else {
				current.push(allContractions[i]);
			}
		}

		const isLastActive = active && current.includes(active);
		segments.push(makeSegment(current, !!isLastActive));
		return segments;
	}

	function makeSegment(cs: Contraction[], containsActive: boolean): Segment {
		const startMs = new Date(cs[0].start).getTime();
		const last = cs[cs.length - 1];
		const endMs = containsActive ? Date.now() : new Date(last.start).getTime();
		return { contractions: cs, startMs, endMs, durationMs: Math.max(endMs - startMs, 60000) };
	}

	function render() {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const completed = contractions.filter(c => c.end !== null);
		const active = contractions.find(isContractionActive);
		const allContractions = [...completed];
		if (active) allContractions.push(active);
		const totalContractions = allContractions.length;

		const containerWidth = container?.clientWidth || 400;
		const dpr = window.devicePixelRatio || 1;
		const height = chartHeight;

		if (totalContractions === 0) {
			sizeCanvas(ctx, canvas, containerWidth, height, dpr);
			ctx.clearRect(0, 0, containerWidth, height);
			ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
			ctx.font = '13px system-ui, sans-serif';
			ctx.textAlign = 'center';
			ctx.fillText('Contractions will appear here', containerWidth / 2, height / 2);
			return;
		}

		const segments = buildSegments(allContractions, active);
		const hasBreaks = segments.length > 1;
		const totalDurationMs = segments.reduce((sum, s) => sum + s.durationMs, 0);
		const totalDurationMin = totalDurationMs / 60000;
		const breakSpace = hasBreaks ? (segments.length - 1) * BREAK_WIDTH : 0;

		let canvasWidth: number;
		if (fitToView) {
			canvasWidth = containerWidth;
		} else {
			const naturalWidth = Math.max(totalDurationMin * 12, containerWidth - PADDING * 2);
			canvasWidth = Math.max(containerWidth, naturalWidth + breakSpace + PADDING * 2);
		}

		const contentWidth = canvasWidth - breakSpace - PADDING * 2;
		sizeCanvas(ctx, canvas, canvasWidth, height, dpr);
		ctx.clearRect(0, 0, canvasWidth, height);

		const baseline = height - PADDING;
		const maxHeight = height - PADDING * 2;

		// Draw baseline
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(PADDING, baseline);
		ctx.lineTo(canvasWidth - PADDING, baseline);
		ctx.stroke();

		// Pre-calculate break X positions
		const breakXPositions: number[] = [];
		{
			let preX = PADDING;
			for (let si = 0; si < segments.length; si++) {
				preX += (segments[si].durationMs / totalDurationMs) * contentWidth;
				if (si < segments.length - 1) {
					breakXPositions.push(preX + BREAK_WIDTH / 2);
					preX += BREAK_WIDTH;
				}
			}
		}

		let xOffset = PADDING;

		for (let si = 0; si < segments.length; si++) {
			const seg = segments[si];
			const segWidth = (seg.durationMs / totalDurationMs) * contentWidth;
			const pixelsPerMinute = seg.durationMs > 0 ? segWidth / (seg.durationMs / 60000) : segWidth;

			// Time grid
			drawTimeGrid(ctx, seg.startMs, seg.durationMs, xOffset, segWidth, baseline, height, breakXPositions);

			// Threshold overlay
			if (showOverlay && seg.contractions.length >= 2) {
				drawThresholdOverlay(ctx, seg, xOffset, segWidth, baseline);
			}

			// Contractions
			for (const c of seg.contractions) {
				const startMs = new Date(c.start).getTime();
				const centerX = seg.durationMs > 0
					? xOffset + ((startMs - seg.startMs) / seg.durationMs) * segWidth
					: xOffset + segWidth / 2;

				if (c.untimed) {
					const intensity = c.intensity || 3;
					const hFrac = 0.2 + (intensity - 1) * 0.2;
					const mH = maxHeight * hFrac * 0.4;
					const color = getIntensityColor(intensity, 0.6);
					ctx.save();
					ctx.strokeStyle = color;
					ctx.lineWidth = 1.5;
					ctx.setLineDash([4, 3]);
					ctx.beginPath();
					ctx.moveTo(centerX, baseline);
					ctx.lineTo(centerX, baseline - mH);
					ctx.stroke();
					ctx.setLineDash([]);
					ctx.restore();
					const dy = 4;
					ctx.fillStyle = color;
					ctx.beginPath();
					ctx.moveTo(centerX, baseline - mH - dy);
					ctx.lineTo(centerX + dy, baseline - mH);
					ctx.lineTo(centerX, baseline - mH + dy);
					ctx.lineTo(centerX - dy, baseline - mH);
					ctx.closePath();
					ctx.fill();
					continue;
				}

				const isActive = isContractionActive(c);
				const durationSec = isActive ? getElapsedSeconds(c) : getDurationSeconds(c);
				const intensity = c.intensity || 3;
				const pixelWidth = Math.max(10, Math.min(80, (durationSec / 60) * pixelsPerMinute));
				const sigma = pixelWidth / 3;
				const hFrac = 0.2 + (intensity - 1) * 0.2;
				let peakHeight = maxHeight * hFrac;
				const color = getIntensityColor(intensity, isActive ? 0.6 : 0.8);

				let leftSigma = sigma;
				let rightSigma = sigma;
				const phases = c.phases;
				if (phases?.peakOffsetSec != null && c.end) {
					const totalSec = (new Date(c.end).getTime() - new Date(c.start).getTime()) / 1000;
					if (totalSec > 0) {
						const peakFrac = Math.min(phases.peakOffsetSec / totalSec, 0.95);
						leftSigma = Math.max(sigma * (peakFrac / 0.5), sigma * 0.3);
						rightSigma = Math.max(sigma * ((1 - peakFrac) / 0.5), sigma * 0.3);
					}
				}

				ctx.fillStyle = color;
				ctx.beginPath();
				ctx.moveTo(centerX - leftSigma * 3, baseline);
				for (let px = Math.floor(-leftSigma * 3); px <= 0; px++) {
					ctx.lineTo(centerX + px, baseline - Math.exp(-(px * px) / (2 * leftSigma * leftSigma)) * peakHeight);
				}
				for (let px = 1; px <= Math.ceil(rightSigma * 3); px++) {
					ctx.lineTo(centerX + px, baseline - Math.exp(-(px * px) / (2 * rightSigma * rightSigma)) * peakHeight);
				}
				ctx.lineTo(centerX + Math.ceil(rightSigma * 3), baseline);
				ctx.closePath();
				ctx.fill();

				if (isActive) {
					ctx.strokeStyle = getIntensityColor(intensity, 1);
					ctx.lineWidth = 2;
					ctx.stroke();
				}
			}

			xOffset += segWidth;

			if (si < segments.length - 1) {
				const nextSeg = segments[si + 1];
				const gapMs = nextSeg.startMs - seg.endMs;
				drawBreakMarker(ctx, xOffset, baseline, height, gapMs);
				xOffset += BREAK_WIDTH;
			}
		}

		// Water break markers
		for (const event of events) {
			if (event.type !== 'water-break') continue;
			const eventMs = new Date(event.timestamp).getTime();
			const ex = getEventXPosition(eventMs, segments, totalDurationMs, contentWidth);
			if (ex !== null) drawWaterBreakMarker(ctx, ex, baseline);
		}
	}

	function sizeCanvas(ctx: CanvasRenderingContext2D, cvs: HTMLCanvasElement, w: number, h: number, dpr: number) {
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		cvs.width = w * dpr;
		cvs.height = h * dpr;
		cvs.style.width = `${w}px`;
		cvs.style.height = `${h}px`;
		ctx.scale(dpr, dpr);
	}

	function drawTimeGrid(ctx: CanvasRenderingContext2D, firstStartMs: number, timeRangeMs: number, chartLeft: number, chartWidth: number, baseline: number, height: number, breakXPos: number[]) {
		const timeRangeMin = timeRangeMs / 60000;
		const gridMinutes = timeRangeMin <= 30 ? 5 : timeRangeMin <= 120 ? 15 : 30;
		const gridMs = gridMinutes * 60000;
		const firstGridTime = Math.ceil(firstStartMs / gridMs) * gridMs;
		const endTime = firstStartMs + timeRangeMs;

		ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
		ctx.lineWidth = 0.5;
		ctx.font = '10px system-ui, sans-serif';
		ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
		ctx.textAlign = 'center';

		for (let t = firstGridTime; t <= endTime; t += gridMs) {
			const x = chartLeft + ((t - firstStartMs) / timeRangeMs) * chartWidth;
			if (x < chartLeft + 15 || x > chartLeft + chartWidth - 15) continue;
			if (breakXPos.some(bx => Math.abs(x - bx) < BREAK_WIDTH)) continue;
			ctx.beginPath();
			ctx.moveTo(x, PADDING);
			ctx.lineTo(x, baseline);
			ctx.stroke();
			ctx.fillText(formatTimeShort(new Date(t)), x, height - 4);
		}
	}

	function drawThresholdOverlay(ctx: CanvasRenderingContext2D, seg: Segment, xOffset: number, segWidth: number, baseline: number) {
		const thresholdMin = threshold.intervalMinutes;
		for (let i = 1; i < seg.contractions.length; i++) {
			const prev = new Date(seg.contractions[i - 1].start).getTime();
			const curr = new Date(seg.contractions[i].start).getTime();
			const interval = (curr - prev) / 60000;
			let color: string | null = null;
			if (interval <= thresholdMin) color = 'rgba(74, 222, 128, 0.3)';
			else if (interval <= thresholdMin * 1.5) color = 'rgba(251, 191, 36, 0.2)';
			if (!color) continue;
			const x1 = seg.durationMs > 0 ? xOffset + ((prev - seg.startMs) / seg.durationMs) * segWidth : xOffset;
			const x2 = seg.durationMs > 0 ? xOffset + ((curr - seg.startMs) / seg.durationMs) * segWidth : xOffset + segWidth;
			ctx.fillStyle = color;
			ctx.fillRect(x1, baseline - 3, x2 - x1, 6);
		}
	}

	function drawBreakMarker(ctx: CanvasRenderingContext2D, x: number, baseline: number, height: number, gapMs: number) {
		const midX = x + BREAK_WIDTH / 2;
		const zigSize = 4;
		ctx.save();
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
		ctx.lineWidth = 1.5;
		ctx.setLineDash([3, 3]);
		for (const dx of [-4, 4]) {
			ctx.beginPath();
			ctx.moveTo(midX + dx, PADDING);
			for (let y = PADDING; y <= baseline; y += zigSize * 2) {
				ctx.lineTo(midX + dx + zigSize, y + zigSize);
				ctx.lineTo(midX + dx, y + zigSize * 2);
			}
			ctx.stroke();
		}
		ctx.setLineDash([]);
		ctx.restore();
		ctx.font = '9px system-ui, sans-serif';
		ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
		ctx.textAlign = 'center';
		ctx.fillText(formatElapsedApprox(gapMs / 60000), midX, height - 3);
	}

	function drawWaterBreakMarker(ctx: CanvasRenderingContext2D, x: number, baseline: number) {
		ctx.save();
		ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
		ctx.lineWidth = 1.5;
		ctx.setLineDash([5, 4]);
		ctx.beginPath();
		ctx.moveTo(x, PADDING + 14);
		ctx.lineTo(x, baseline);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.font = '12px system-ui, sans-serif';
		ctx.fillStyle = 'rgba(59, 130, 246, 0.9)';
		ctx.textAlign = 'center';
		ctx.fillText('💧', x, PADDING + 10);
		ctx.restore();
	}

	function getEventXPosition(eventMs: number, segments: Segment[], totalDurationMs: number, contentWidth: number): number | null {
		let xOff = PADDING;
		for (let si = 0; si < segments.length; si++) {
			const seg = segments[si];
			const segWidth = (seg.durationMs / totalDurationMs) * contentWidth;
			if (eventMs >= seg.startMs && eventMs <= seg.endMs) {
				return xOff + ((eventMs - seg.startMs) / seg.durationMs) * segWidth;
			}
			if (si < segments.length - 1 && eventMs > seg.endMs && eventMs < segments[si + 1].startMs) {
				return xOff + segWidth;
			}
			xOff += segWidth;
			if (si < segments.length - 1) xOff += BREAK_WIDTH;
		}
		if (segments.length > 0 && eventMs >= segments[segments.length - 1].endMs) return xOff;
		return null;
	}

	function handleFit() { fitToView = true; }
	function handleNow() {
		fitToView = false;
		render();
		if (container) container.scrollLeft = container.scrollWidth;
	}
</script>

<div class="wave-chart">
	{#if contractions.filter(c => c.end !== null).length > 0 || contractions.some(isContractionActive)}
		<div class="chart-toolbar">
			<button class="chart-btn" on:click={handleFit}>Fit</button>
			<button class="chart-btn" on:click={handleNow}>Now →</button>
		</div>
	{/if}
	<div class="canvas-container" bind:this={container}>
		<canvas bind:this={canvas}></canvas>
	</div>
	{#if showOverlay}
		<div class="chart-legend">Green = within {threshold.intervalMinutes} min</div>
	{/if}
</div>

<style>
	.wave-chart {
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 12px;
		padding: 10px;
		margin-bottom: 12px;
	}

	.chart-toolbar {
		display: flex;
		justify-content: flex-end;
		gap: 6px;
		margin-bottom: 6px;
	}

	.chart-btn {
		padding: 3px 10px;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(255, 255, 255, 0.04);
		color: rgba(255, 255, 255, 0.5);
		font-size: 0.7rem;
		cursor: pointer;
	}

	.chart-btn:active { background: rgba(255, 255, 255, 0.08); }

	.canvas-container {
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}

	.canvas-container::-webkit-scrollbar { height: 4px; }
	.canvas-container::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 2px; }

	.chart-legend {
		font-size: 0.68rem;
		color: rgba(255, 255, 255, 0.3);
		margin-top: 4px;
		text-align: center;
	}
</style>
