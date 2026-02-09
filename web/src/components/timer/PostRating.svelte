<script lang="ts">
	import type { ContractionLocation } from '../../lib/labor-logic/types';
	import { session } from '../../lib/stores/session';
	import { settings } from '../../lib/stores/settings';
	import IntensityPicker from './IntensityPicker.svelte';
	import LocationPicker from './LocationPicker.svelte';

	$: lastCompleted = [...$session.contractions]
		.filter(c => c.end !== null && !c.ratingDismissed)
		.pop();

	$: needsRating = lastCompleted && $settings.showPostRating &&
		(lastCompleted.intensity === null || lastCompleted.location === null);

	function setIntensity(level: number) {
		if (!lastCompleted) return;
		session.update(s => ({
			...s,
			contractions: s.contractions.map(c =>
				c.id === lastCompleted!.id ? { ...c, intensity: level } : c
			),
		}));
	}

	function setLocation(loc: ContractionLocation) {
		if (!lastCompleted) return;
		session.update(s => ({
			...s,
			contractions: s.contractions.map(c =>
				c.id === lastCompleted!.id ? { ...c, location: loc } : c
			),
		}));
	}

	function dismiss() {
		if (!lastCompleted) return;
		session.update(s => ({
			...s,
			contractions: s.contractions.map(c =>
				c.id === lastCompleted!.id ? { ...c, ratingDismissed: true } : c
			),
		}));
	}
</script>

{#if needsRating && lastCompleted}
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
		/>
	{/if}
{/if}
