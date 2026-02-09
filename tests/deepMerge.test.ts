import { describe, it, expect } from 'bun:test';
import { deepMerge } from '../src/utils/deepMerge';

describe('deepMerge', () => {
	it('returns defaults when no overrides', () => {
		const defaults = { a: 1, b: 'hello' };
		expect(deepMerge(defaults, undefined)).toEqual({ a: 1, b: 'hello' });
	});

	it('merges flat keys', () => {
		const defaults = { a: 1, b: 2 };
		const overrides = { a: 10 };
		expect(deepMerge(defaults, overrides)).toEqual({ a: 10, b: 2 });
	});

	it('deep-merges nested objects', () => {
		const defaults = { nested: { x: 1, y: 2 }, top: true };
		const overrides = { nested: { x: 10 } };
		expect(deepMerge(defaults, overrides as typeof defaults)).toEqual({
			nested: { x: 10, y: 2 },
			top: true,
		});
	});

	it('does not clobber new nested keys with undefined', () => {
		const defaults = {
			threshold: { a: 5, b: 60, c: 60 },
			stageThresholds: { early: { max: 30, min: 30 } },
		};
		// Simulate old settings that don't have stageThresholds
		const overrides = { threshold: { a: 4, b: 60, c: 60 } };
		const result = deepMerge(defaults, overrides as typeof defaults);
		expect(result.stageThresholds).toEqual({ early: { max: 30, min: 30 } });
	});

	it('replaces arrays instead of merging', () => {
		const defaults = { items: [1, 2, 3] };
		const overrides = { items: [4, 5] };
		expect(deepMerge(defaults, overrides)).toEqual({ items: [4, 5] });
	});

	it('handles null overrides gracefully', () => {
		const defaults = { a: { x: 1 }, b: 'hello' };
		const overrides = { a: null, b: 'world' };
		const result = deepMerge(defaults, overrides as unknown as typeof defaults);
		expect(result.a).toBeNull();
		expect(result.b).toBe('world');
	});

	it('preserves all defaults when overrides is empty', () => {
		const defaults = { a: 1, b: { c: 2, d: 3 } };
		expect(deepMerge(defaults, {})).toEqual({ a: 1, b: { c: 2, d: 3 } });
	});

	it('handles triple-nested objects', () => {
		const defaults = { a: { b: { c: 1, d: 2 }, e: 3 } };
		const overrides = { a: { b: { c: 10 } } };
		const result = deepMerge(defaults, overrides as typeof defaults);
		expect(result.a.b.c).toBe(10);
		expect(result.a.b.d).toBe(2);
		expect(result.a.e).toBe(3);
	});
});
