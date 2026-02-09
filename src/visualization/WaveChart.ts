import type { Contraction, ThresholdConfig } from '../types';
import { getDurationSeconds, isContractionActive, getElapsedSeconds } from '../data/calculations';
import { formatTimeShort, formatElapsedApprox } from '../utils/formatters';

/** A continuous group of contractions with no large gaps between them. */
interface Segment {
	contractions: Contraction[];
	startMs: number;
	endMs: number;
	durationMs: number;
}

/** Width of the break marker between segments (in CSS pixels). */
const BREAK_WIDTH = 50;

/**
 * TOCO-style wave chart rendered on HTML Canvas.
 * Each contraction is a Gaussian bell curve with:
 * - Height proportional to intensity (1-5)
 * - Width proportional to duration
 * - Spacing proportional to interval
 * - Color gradient from blue (mild) to red (intense)
 *
 * Supports gap compression: large time gaps between contractions
 * are collapsed into a visual break marker instead of empty space.
 */
export class WaveChart {
	private el: HTMLElement;
	private canvas: HTMLCanvasElement;
	private canvasCtx: CanvasRenderingContext2D;
	private threshold: ThresholdConfig;
	private contractions: Contraction[] = [];
	private chartHeight: number;
	private gapThresholdMin: number;
	private showOverlay: boolean;

	private canvasContainer: HTMLElement;
	private toolbar: HTMLElement;
	private legendEl: HTMLElement | null = null;
	private fitToView = false;
	private readonly PADDING = 20;

	constructor(parent: HTMLElement, threshold: ThresholdConfig, chartHeight = 150, gapThresholdMin = 30, showOverlay = false) {
		this.threshold = threshold;
		this.chartHeight = chartHeight;
		this.gapThresholdMin = gapThresholdMin;
		this.showOverlay = showOverlay;

		this.el = parent.createDiv({ cls: 'ct-wave-chart' });

		// Header row with chart controls (label is in the collapsible section header)
		const headerRow = this.el.createDiv({ cls: 'ct-chart-header' });
		this.toolbar = headerRow.createDiv({ cls: 'ct-chart-toolbar ct-hidden' });

		const fitBtn = this.toolbar.createEl('button', { cls: 'ct-chart-btn', text: 'Fit' });
		fitBtn.addEventListener('click', () => { this.fitToView = true; this.render(); });

		const nowBtn = this.toolbar.createEl('button', { cls: 'ct-chart-btn', text: 'Now \u2192' });
		nowBtn.addEventListener('click', () => { this.fitToView = false; this.render(); this.scrollToEnd(); });

		this.canvasContainer = this.el.createDiv({ cls: 'ct-canvas-container' });
		this.canvas = this.canvasContainer.createEl('canvas', { cls: 'ct-canvas' });
		this.canvasCtx = this.canvas.getContext('2d')!;

		// Overlay legend (shown only when overlay is active)
		if (this.showOverlay) {
			this.legendEl = this.el.createDiv({
				cls: 'ct-chart-legend',
				text: `Green = within ${threshold.intervalMinutes} min`,
			});
		}
	}

	update(contractions: Contraction[]): void {
		this.contractions = contractions;
		this.render();
	}

	private render(): void {
		const completed = this.contractions.filter(c => c.end !== null);
		const active = this.contractions.find(isContractionActive);

		const containerWidth = this.canvas.parentElement?.clientWidth || 400;
		const totalContractions = completed.length + (active ? 1 : 0);

		const allContractions = [...completed];
		if (active) allContractions.push(active);

		const dpr = window.devicePixelRatio || 1;
		const height = this.chartHeight;

		// If no contractions, show placeholder
		if (totalContractions === 0) {
			this.sizeCanvas(containerWidth, height, dpr);
			const ctx = this.canvasCtx;
			ctx.clearRect(0, 0, containerWidth, height);
			ctx.fillStyle = getComputedStyle(this.el).getPropertyValue('--text-muted').trim() || '#888';
			ctx.font = '14px var(--font-text)';
			ctx.textAlign = 'center';
			ctx.fillText('Contractions will appear here', containerWidth / 2, height / 2);
			return;
		}

		// Build segments (gap compression)
		const segments = this.buildSegments(allContractions, active);
		const hasBreaks = segments.length > 1;

		// Calculate total content width
		const totalDurationMs = segments.reduce((sum, s) => sum + s.durationMs, 0);
		const totalDurationMin = totalDurationMs / 60000;
		const breakSpace = hasBreaks ? (segments.length - 1) * BREAK_WIDTH : 0;
		let canvasWidth: number;

		if (this.fitToView) {
			// Fit mode: compress everything into the visible container
			canvasWidth = containerWidth;
		} else {
			const naturalWidth = Math.max(totalDurationMin * 12, containerWidth - this.PADDING * 2);
			const totalWidth = naturalWidth + breakSpace + this.PADDING * 2;
			canvasWidth = Math.max(containerWidth, totalWidth);
		}

		const contentWidth = canvasWidth - breakSpace - this.PADDING * 2;

		this.sizeCanvas(canvasWidth, height, dpr);
		const ctx = this.canvasCtx;
		ctx.clearRect(0, 0, canvasWidth, height);

		const baseline = height - this.PADDING;
		const maxHeight = height - this.PADDING * 2;

		// Draw baseline
		ctx.strokeStyle = getComputedStyle(this.el).getPropertyValue('--background-modifier-border').trim() || '#333';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(this.PADDING, baseline);
		ctx.lineTo(canvasWidth - this.PADDING, baseline);
		ctx.stroke();

		// Pre-calculate break marker X positions so time grid can avoid them
		const breakXPositions: number[] = [];
		{
			let preCalcX = this.PADDING;
			for (let si = 0; si < segments.length; si++) {
				const segW = (segments[si].durationMs / totalDurationMs) * contentWidth;
				preCalcX += segW;
				if (si < segments.length - 1) {
					breakXPositions.push(preCalcX + BREAK_WIDTH / 2);
					preCalcX += BREAK_WIDTH;
				}
			}
		}

		// Render each segment
		let xOffset = this.PADDING;

		for (let si = 0; si < segments.length; si++) {
			const seg = segments[si];
			const segDurationMin = seg.durationMs / 60000;
			const segWidth = (seg.durationMs / totalDurationMs) * contentWidth;
			const pixelsPerMinute = segDurationMin > 0 ? segWidth / segDurationMin : segWidth;

			// Draw time grid for this segment (skipping labels near break markers)
			this.drawTimeGrid(ctx, seg.startMs, seg.durationMs, xOffset, segWidth, baseline, height, breakXPositions);

			// Draw threshold overlay (between baseline and bell curves)
			if (this.showOverlay && seg.contractions.length >= 2) {
				this.drawThresholdOverlay(ctx, seg, xOffset, segWidth, baseline);
			}

			// Draw contractions in this segment
			for (const contraction of seg.contractions) {
				const startMs = new Date(contraction.start).getTime();
				const centerX = seg.durationMs > 0
					? xOffset + ((startMs - seg.startMs) / seg.durationMs) * segWidth
					: xOffset + segWidth / 2;

				const isActive = isContractionActive(contraction);
				const durationSec = isActive
					? getElapsedSeconds(contraction)
					: getDurationSeconds(contraction);
				const intensity = contraction.intensity || 3;

				const pixelWidth = Math.max(10, Math.min(80, (durationSec / 60) * pixelsPerMinute));
				const sigma = pixelWidth / 3;

				const heightFraction = 0.2 + (intensity - 1) * 0.2;
				let peakHeight = maxHeight * heightFraction;
				const color = this.getIntensityColor(intensity, isActive ? 0.6 : 0.8);

				// Asymmetric curve when phase data exists
				const phases = contraction.phases;
				let leftSigma = sigma;
				let rightSigma = sigma;
				if (phases) {
					if (phases.peakOffsetSec != null && contraction.end) {
						// New format: shift the peak based on when user tapped "decreasing"
						const totalSec = (new Date(contraction.end).getTime() - new Date(contraction.start).getTime()) / 1000;
						if (totalSec > 0) {
							const peakFraction = Math.min(phases.peakOffsetSec / totalSec, 0.95);
							// Scale left/right sigma proportional to building/easing fractions
							leftSigma = sigma * (peakFraction / 0.5);
							rightSigma = sigma * ((1 - peakFraction) / 0.5);
							// Clamp to reasonable bounds
							leftSigma = Math.max(leftSigma, sigma * 0.3);
							rightSigma = Math.max(rightSigma, sigma * 0.3);
						}
					} else {
						// Legacy format: 1-5 intensity ratings per phase
						if (phases.building !== null) {
							leftSigma = sigma * (1.4 - (phases.building - 1) * 0.15);
						}
						if (phases.easing !== null) {
							rightSigma = sigma * (1.4 - (phases.easing - 1) * 0.15);
						}
						if (phases.peak !== null) {
							peakHeight = maxHeight * (0.2 + (phases.peak - 1) * 0.2);
						}
					}
				}

				ctx.fillStyle = color;
				ctx.beginPath();
				ctx.moveTo(centerX - leftSigma * 3, baseline);

				// Left side (building)
				for (let px = Math.floor(-leftSigma * 3); px <= 0; px += 1) {
					const x = centerX + px;
					const gauss = Math.exp(-(px * px) / (2 * leftSigma * leftSigma));
					ctx.lineTo(x, baseline - gauss * peakHeight);
				}

				// Right side (easing)
				for (let px = 1; px <= Math.ceil(rightSigma * 3); px += 1) {
					const x = centerX + px;
					const gauss = Math.exp(-(px * px) / (2 * rightSigma * rightSigma));
					ctx.lineTo(x, baseline - gauss * peakHeight);
				}

				ctx.lineTo(centerX + Math.ceil(rightSigma * 3), baseline);
				ctx.closePath();
				ctx.fill();

				if (isActive) {
					ctx.strokeStyle = this.getIntensityColor(intensity, 1);
					ctx.lineWidth = 2;
					ctx.stroke();
				}
			}

			xOffset += segWidth;

			// Draw break marker between segments
			if (si < segments.length - 1) {
				const nextSeg = segments[si + 1];
				const gapMs = nextSeg.startMs - seg.endMs;
				this.drawBreakMarker(ctx, xOffset, baseline, height, gapMs);
				xOffset += BREAK_WIDTH;
			}
		}

		// Draw per-contraction time labels when grid lines are sparse
		this.drawContractionLabels(ctx, segments, totalDurationMs, contentWidth, baseline, height);

		// Show toolbar when there are contractions to interact with
		if (totalContractions >= 1) {
			this.toolbar.removeClass('ct-hidden');
		} else {
			this.toolbar.addClass('ct-hidden');
		}
	}

	/**
	 * Split contractions into segments separated by large gaps.
	 * If gap compression is disabled (threshold = 0), returns a single segment.
	 */
	private buildSegments(allContractions: Contraction[], active: Contraction | undefined): Segment[] {
		if (allContractions.length === 0) return [];

		const gapThresholdMs = this.gapThresholdMin > 0 ? this.gapThresholdMin * 60000 : 0;

		// No compression — single segment
		if (gapThresholdMs === 0) {
			const firstStart = new Date(allContractions[0].start).getTime();
			const lastTime = active
				? Date.now()
				: new Date(allContractions[allContractions.length - 1].start).getTime();
			return [{
				contractions: allContractions,
				startMs: firstStart,
				endMs: lastTime,
				durationMs: Math.max(lastTime - firstStart, 60000),
			}];
		}

		const segments: Segment[] = [];
		let currentContractions: Contraction[] = [allContractions[0]];

		for (let i = 1; i < allContractions.length; i++) {
			const prevStart = new Date(allContractions[i - 1].start).getTime();
			const currStart = new Date(allContractions[i].start).getTime();
			const gap = currStart - prevStart;

			if (gap > gapThresholdMs) {
				// Close current segment
				segments.push(this.makeSegment(currentContractions, false));
				currentContractions = [allContractions[i]];
			} else {
				currentContractions.push(allContractions[i]);
			}
		}

		// Close final segment (may contain the active contraction)
		const isLastActive = active && currentContractions.includes(active);
		segments.push(this.makeSegment(currentContractions, !!isLastActive));

		return segments;
	}

	private makeSegment(contractions: Contraction[], containsActive: boolean): Segment {
		const startMs = new Date(contractions[0].start).getTime();
		const lastC = contractions[contractions.length - 1];
		const endMs = containsActive
			? Date.now()
			: new Date(lastC.start).getTime();
		return {
			contractions,
			startMs,
			endMs,
			durationMs: Math.max(endMs - startMs, 60000),
		};
	}

	/** Draw a zigzag break marker indicating a compressed time gap. */
	private drawBreakMarker(
		ctx: CanvasRenderingContext2D,
		x: number,
		baseline: number,
		height: number,
		gapMs: number
	): void {
		const midX = x + BREAK_WIDTH / 2;
		const top = this.PADDING;
		const zigSize = 4;

		ctx.save();
		ctx.strokeStyle = getComputedStyle(this.el).getPropertyValue('--text-faint').trim() || '#555';
		ctx.lineWidth = 1.5;
		ctx.setLineDash([3, 3]);

		// Left zigzag line
		ctx.beginPath();
		ctx.moveTo(midX - 4, top);
		for (let y = top; y <= baseline; y += zigSize * 2) {
			ctx.lineTo(midX - 4 + zigSize, y + zigSize);
			ctx.lineTo(midX - 4, y + zigSize * 2);
		}
		ctx.stroke();

		// Right zigzag line
		ctx.beginPath();
		ctx.moveTo(midX + 4, top);
		for (let y = top; y <= baseline; y += zigSize * 2) {
			ctx.lineTo(midX + 4 + zigSize, y + zigSize);
			ctx.lineTo(midX + 4, y + zigSize * 2);
		}
		ctx.stroke();

		ctx.setLineDash([]);
		ctx.restore();

		// Gap duration label
		const gapMin = gapMs / 60000;
		const label = formatElapsedApprox(gapMin);
		ctx.font = '9px var(--font-text)';
		ctx.fillStyle = getComputedStyle(this.el).getPropertyValue('--text-faint').trim() || '#555';
		ctx.textAlign = 'center';
		ctx.fillText(label, midX, height - 3);
	}

	/**
	 * Draw colored baseline segments between consecutive contractions
	 * showing how close their interval is to the threshold.
	 * Green = within threshold, Amber = within 1.5x threshold.
	 */
	private drawThresholdOverlay(
		ctx: CanvasRenderingContext2D,
		seg: Segment,
		xOffset: number,
		segWidth: number,
		baseline: number
	): void {
		const thresholdMin = this.threshold.intervalMinutes;
		const contractions = seg.contractions;

		for (let i = 1; i < contractions.length; i++) {
			const prevStartMs = new Date(contractions[i - 1].start).getTime();
			const currStartMs = new Date(contractions[i].start).getTime();
			const intervalMin = (currStartMs - prevStartMs) / 60000;

			let color: string | null = null;
			if (intervalMin <= thresholdMin) {
				color = 'rgba(74, 222, 128, 0.3)'; // green
			} else if (intervalMin <= thresholdMin * 1.5) {
				color = 'rgba(251, 191, 36, 0.2)'; // amber
			}

			if (!color) continue;

			// Calculate x positions within segment
			const x1 = seg.durationMs > 0
				? xOffset + ((prevStartMs - seg.startMs) / seg.durationMs) * segWidth
				: xOffset;
			const x2 = seg.durationMs > 0
				? xOffset + ((currStartMs - seg.startMs) / seg.durationMs) * segWidth
				: xOffset + segWidth;

			ctx.fillStyle = color;
			ctx.fillRect(x1, baseline - 3, x2 - x1, 6);
		}
	}

	/**
	 * Draw clock-time grid lines with actual times of day.
	 */
	private drawTimeGrid(
		ctx: CanvasRenderingContext2D,
		firstStartMs: number,
		timeRangeMs: number,
		chartLeft: number,
		chartWidth: number,
		baseline: number,
		height: number,
		breakXPositions: number[] = []
	): void {
		const timeRangeMin = timeRangeMs / 60000;

		let gridMinutes: number;
		if (timeRangeMin <= 30) gridMinutes = 5;
		else if (timeRangeMin <= 120) gridMinutes = 15;
		else gridMinutes = 30;

		const gridMs = gridMinutes * 60000;

		const firstGridTime = Math.ceil(firstStartMs / gridMs) * gridMs;
		const endTime = firstStartMs + timeRangeMs;

		ctx.strokeStyle = getComputedStyle(this.el).getPropertyValue('--background-modifier-border').trim() || '#222';
		ctx.lineWidth = 0.5;
		ctx.font = '10px var(--font-text)';
		ctx.fillStyle = getComputedStyle(this.el).getPropertyValue('--text-muted').trim() || '#666';
		ctx.textAlign = 'center';

		for (let t = firstGridTime; t <= endTime; t += gridMs) {
			const x = chartLeft + ((t - firstStartMs) / timeRangeMs) * chartWidth;

			if (x < chartLeft + 15 || x > chartLeft + chartWidth - 15) continue;

			// Skip labels that would overlap with break markers
			const tooCloseToBreak = breakXPositions.some(bx => Math.abs(x - bx) < BREAK_WIDTH);
			if (tooCloseToBreak) continue;

			ctx.beginPath();
			ctx.moveTo(x, this.PADDING);
			ctx.lineTo(x, baseline);
			ctx.stroke();

			const date = new Date(t);
			ctx.fillText(formatTimeShort(date), x, height - 4);
		}
	}

	/**
	 * Draw a timestamp label under each contraction when the time grid
	 * is too sparse to provide context (e.g. only 1-2 contractions over
	 * a short time span where no 5-min grid line falls).
	 */
	private drawContractionLabels(
		ctx: CanvasRenderingContext2D,
		segments: Segment[],
		totalDurationMs: number,
		contentWidth: number,
		baseline: number,
		height: number
	): void {
		ctx.font = '9px var(--font-text)';
		ctx.fillStyle = getComputedStyle(this.el).getPropertyValue('--text-muted').trim() || '#888';
		ctx.textAlign = 'center';

		let xOffset = this.PADDING;
		let lastLabelX = -Infinity; // avoid overlapping labels

		for (let si = 0; si < segments.length; si++) {
			const seg = segments[si];
			const segWidth = (seg.durationMs / totalDurationMs) * contentWidth;

			for (const contraction of seg.contractions) {
				const startMs = new Date(contraction.start).getTime();
				const x = seg.durationMs > 0
					? xOffset + ((startMs - seg.startMs) / seg.durationMs) * segWidth
					: xOffset + segWidth / 2;

				// Skip if too close to previous label (< 40px apart)
				if (x - lastLabelX < 40) continue;

				const label = formatTimeShort(new Date(startMs));
				ctx.fillText(label, x, height - 4);
				lastLabelX = x;
			}

			xOffset += segWidth;
			if (si < segments.length - 1) {
				xOffset += BREAK_WIDTH;
			}
		}
	}

	/** Size the canvas for the given CSS dimensions and device pixel ratio. */
	private sizeCanvas(width: number, height: number, dpr: number): void {
		this.canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
		this.canvas.width = width * dpr;
		this.canvas.height = height * dpr;
		this.canvas.style.width = `${width}px`;
		this.canvas.style.height = `${height}px`;
		this.canvasCtx.scale(dpr, dpr);
	}

	/** Scroll the chart container all the way to the right. */
	scrollToEnd(): void {
		this.canvasContainer.scrollLeft = this.canvasContainer.scrollWidth;
	}

	private getIntensityColor(level: number, alpha: number): string {
		const colors: Record<number, [number, number, number]> = {
			1: [100, 180, 220], // Soft blue
			2: [120, 200, 150], // Green
			3: [220, 200, 80],  // Yellow
			4: [230, 140, 60],  // Orange
			5: [220, 80, 80],   // Red
		};
		const [r, g, b] = colors[level] || colors[3];
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}
}
