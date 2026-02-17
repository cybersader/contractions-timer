<script lang="ts">
	import type { ContractionLocation } from '../../lib/labor-logic/types';
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import IntensityPicker from './IntensityPicker.svelte';
	import LocationPicker from './LocationPicker.svelte';

	let lastCompleted = $derived.by(() => {
		return [...$session.contractions]
			.filter(c => c.end !== null && !c.ratingDismissed)
			.pop();
	});

	let needsRating = $derived(
		lastCompleted && $settings.showPostRating &&
		(lastCompleted.intensity === null || lastCompleted.location === null)
	);

	function setIntensity(level: number) {
		if (!lastCompleted) return;
		const id = lastCompleted.id;
		session.update(s => ({
			...s,
			contractions: s.contractions.map(c =>
				c.id === id ? { ...c, intensity: level } : c
			),
		}));
	}

	function setLocation(loc: ContractionLocation) {
		if (!lastCompleted) return;
		const id = lastCompleted.id;
		session.update(s => ({
			...s,
			contractions: s.contractions.map(c =>
				c.id === id ? { ...c, location: loc } : c
			),
		}));
	}

	function clearIntensity() {
		if (!lastCompleted) return;
		const id = lastCompleted.id;
		session.update(s => ({
			...s,
			contractions: s.contractions.map(c =>
				c.id === id ? { ...c, intensity: null } : c
			),
		}));
	}

	function dismiss() {
		if (!lastCompleted) return;
		const id = lastCompleted.id;
		session.update(s => ({
			...s,
			contractions: s.contractions.map(c =>
				c.id === id ? { ...c, ratingDismissed: true } : c
			),
		}));
	}
</script>

{#if needsRating && lastCompleted}
	<div class="post-rating">
		{#if lastCompleted.intensity === null && $settings.showIntensityPicker}
			<IntensityPicker
				value={lastCompleted.intensity}
				onSelect={setIntensity}
				onSkip={dismiss}
			/>
		{/if}
		{#if lastCompleted.location === null && $settings.showLocationPicker && (lastCompleted.intensity !== null || !$settings.showIntensityPicker)}
			<LocationPicker
				value={lastCompleted.location}
				onSelect={setLocation}
				onSkip={dismiss}
				onBack={$settings.showIntensityPicker ? clearIntensity : undefined}
			/>
		{/if}
	</div>
{/if}

<style>
	.post-rating {
		margin-top: var(--space-3);
	}
</style>
