import { describe, it, expect } from 'bun:test';
import {
	formatDuration,
	formatDurationShort,
	formatInterval,
	formatTime,
	formatTimeShort,
	getIntensityLabel,
	getLocationLabel,
	getLaborStageLabel,
	mapIntensityTo3,
	generateId,
	formatElapsedApprox,
} from '../src/utils/formatters';

describe('formatDuration', () => {
	it('formats zero seconds', () => {
		expect(formatDuration(0)).toBe('0:00');
	});

	it('formats seconds under a minute', () => {
		expect(formatDuration(45)).toBe('0:45');
	});

	it('formats exactly one minute', () => {
		expect(formatDuration(60)).toBe('1:00');
	});

	it('formats minutes and seconds', () => {
		expect(formatDuration(83)).toBe('1:23');
	});

	it('formats large durations', () => {
		expect(formatDuration(725)).toBe('12:05');
	});

	it('handles negative values', () => {
		expect(formatDuration(-5)).toBe('0:00');
	});

	it('pads seconds with leading zero', () => {
		expect(formatDuration(61)).toBe('1:01');
	});
});

describe('formatDurationShort', () => {
	it('formats seconds only', () => {
		expect(formatDurationShort(45)).toBe('45s');
	});

	it('formats minutes only', () => {
		expect(formatDurationShort(120)).toBe('2m');
	});

	it('formats minutes and seconds', () => {
		expect(formatDurationShort(83)).toBe('1m 23s');
	});
});

describe('formatInterval', () => {
	it('formats zero minutes', () => {
		expect(formatInterval(0)).toBe('0s');
	});

	it('formats whole minutes', () => {
		expect(formatInterval(5)).toBe('5m');
	});

	it('formats fractional minutes', () => {
		expect(formatInterval(5.5)).toBe('5m 30s');
	});
});

describe('formatTime', () => {
	it('formats an ISO time string', () => {
		const result = formatTime('2026-02-08T14:30:00.000Z');
		// The exact format depends on locale, but it should contain numbers
		expect(result).toMatch(/\d/);
	});
});

describe('getIntensityLabel', () => {
	it('returns Mild for level 1', () => {
		expect(getIntensityLabel(1)).toBe('Mild');
	});

	it('returns Intense for level 5', () => {
		expect(getIntensityLabel(5)).toBe('Intense');
	});

	it('handles unknown levels', () => {
		expect(getIntensityLabel(99)).toBe('Level 99');
	});
});

describe('getLocationLabel', () => {
	it('returns Lower belly', () => {
		expect(getLocationLabel('front')).toBe('Lower belly');
	});

	it('returns All around', () => {
		expect(getLocationLabel('wrapping')).toBe('All around');
	});

	it('returns raw value for unknown', () => {
		expect(getLocationLabel('unknown')).toBe('unknown');
	});
});

describe('formatTimeShort', () => {
	it('formats afternoon in 12h mode', () => {
		const date = new Date(2026, 1, 8, 14, 30, 0);
		expect(formatTimeShort(date, '12h')).toBe('2:30p');
	});

	it('formats morning in 12h mode', () => {
		const date = new Date(2026, 1, 8, 9, 5, 0);
		expect(formatTimeShort(date, '12h')).toBe('9:05a');
	});

	it('formats noon in 12h mode', () => {
		const date = new Date(2026, 1, 8, 12, 0, 0);
		expect(formatTimeShort(date, '12h')).toBe('12:00p');
	});

	it('formats midnight in 12h mode', () => {
		const date = new Date(2026, 1, 8, 0, 0, 0);
		expect(formatTimeShort(date, '12h')).toBe('12:00a');
	});

	it('formats in 24h mode', () => {
		const date = new Date(2026, 1, 8, 14, 30, 0);
		expect(formatTimeShort(date, '24h')).toBe('14:30');
	});

	it('pads hours in 24h mode', () => {
		const date = new Date(2026, 1, 8, 3, 5, 0);
		expect(formatTimeShort(date, '24h')).toBe('03:05');
	});

	it('defaults to 12h format', () => {
		const date = new Date(2026, 1, 8, 14, 30, 0);
		expect(formatTimeShort(date)).toBe('2:30p');
	});
});

describe('getLaborStageLabel', () => {
	it('returns Pre-labor', () => {
		expect(getLaborStageLabel('pre-labor')).toBe('Pre-labor');
	});

	it('returns Early labor', () => {
		expect(getLaborStageLabel('early')).toBe('Early labor');
	});

	it('returns Active labor', () => {
		expect(getLaborStageLabel('active')).toBe('Active labor');
	});

	it('returns Transition', () => {
		expect(getLaborStageLabel('transition')).toBe('Transition');
	});

	it('returns raw value for unknown stage', () => {
		expect(getLaborStageLabel('unknown')).toBe('unknown');
	});
});

describe('mapIntensityTo3', () => {
	it('maps 1 to 1', () => {
		expect(mapIntensityTo3(1)).toBe(1);
	});

	it('maps 2 to 1', () => {
		expect(mapIntensityTo3(2)).toBe(1);
	});

	it('maps 3 to 3', () => {
		expect(mapIntensityTo3(3)).toBe(3);
	});

	it('maps 4 to 5', () => {
		expect(mapIntensityTo3(4)).toBe(5);
	});

	it('maps 5 to 5', () => {
		expect(mapIntensityTo3(5)).toBe(5);
	});
});

describe('formatElapsedApprox', () => {
	it('formats sub-minute', () => {
		expect(formatElapsedApprox(0.5)).toBe('<1 min');
	});

	it('formats minutes', () => {
		expect(formatElapsedApprox(45)).toBe('~45 min');
	});

	it('formats about one hour', () => {
		expect(formatElapsedApprox(70)).toBe('~1 hour');
	});

	it('formats multiple hours', () => {
		expect(formatElapsedApprox(150)).toBe('~3 hours');
	});

	it('rounds minutes', () => {
		expect(formatElapsedApprox(22.7)).toBe('~23 min');
	});
});

describe('generateId', () => {
	it('returns a string', () => {
		expect(typeof generateId()).toBe('string');
	});

	it('returns unique IDs', () => {
		const ids = new Set(Array.from({ length: 100 }, generateId));
		expect(ids.size).toBe(100);
	});

	it('returns 6-character IDs', () => {
		expect(generateId().length).toBe(6);
	});
});
