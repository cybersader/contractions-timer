<script lang="ts">
	import { _ } from 'svelte-i18n';
	let selectedPrayer = $state(0);
	let carouselEl: HTMLDivElement | undefined = $state();
	let isScrollSyncing = false;

	const saintKeys = [
		'gerardMajella', 'giannaMolla', 'raymondNonnatus', 'margaretAntioch',
		'ourLadyLaLeche', 'colette', 'felicity', 'elizabeth',
		'anne', 'monica', 'zelieMartin', 'joseph'
	];

	const prayerKeys = [
		'stGerard', 'memorare', 'motherAndChild', 'hailMary',
		'ourLadyLaLeche', 'safeDelivery', 'stJoseph',
		'psalm139', 'isaiah66', 'jeremiah1', 'magnificat'
	];

	const scriptureKeys = new Set(['psalm139', 'isaiah66', 'jeremiah1', 'magnificat']);

	function scrollToCard(index: number) {
		if (!carouselEl) return;
		const cards = carouselEl.querySelectorAll('.prayer-card');
		if (cards[index]) {
			isScrollSyncing = true;
			cards[index].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
			setTimeout(() => { isScrollSyncing = false; }, 400);
		}
	}

	function handleCarouselScroll() {
		if (isScrollSyncing || !carouselEl) return;
		const scrollLeft = carouselEl.scrollLeft;
		const cardWidth = carouselEl.offsetWidth;
		const newIndex = Math.round(scrollLeft / cardWidth);
		if (newIndex >= 0 && newIndex < prayerKeys.length && newIndex !== selectedPrayer) {
			selectedPrayer = newIndex;
		}
	}

	function selectPrayer(i: number) {
		selectedPrayer = i;
		scrollToCard(i);
	}
</script>

<div class="devotional-page">
	<div class="prayers-section">
		<h4 class="devotional-heading">{$_('devotional.headingPrayersAndScripture')}</h4>
		<div class="prayer-tabs-scroll">
			<div class="prayer-tabs">
				{#each prayerKeys as key, i}
					<button
						class="prayer-tab"
						class:active={selectedPrayer === i}
						class:scripture={scriptureKeys.has(key)}
						onclick={() => selectPrayer(i)}
					>
						{$_(`devotional.prayers.${key}.shortLabel`)}
					</button>
				{/each}
			</div>
		</div>
		<div class="prayer-carousel" bind:this={carouselEl} onscroll={handleCarouselScroll}>
			{#each prayerKeys as key, i}
				<div class="prayer-card">
					{#if scriptureKeys.has(key)}
						<div class="prayer-kind-badge scripture-badge">{$_('devotional.scriptureBadge')}</div>
					{:else}
						<div class="prayer-kind-badge prayer-badge">{$_('devotional.prayerBadge')}</div>
					{/if}
					<h5 class="prayer-title">{$_(`devotional.prayers.${key}.title`)}</h5>
					<p class="prayer-text">{$_(`devotional.prayers.${key}.text`)}</p>
					<span class="prayer-attribution">&mdash; {$_(`devotional.prayers.${key}.attribution`)}</span>
				</div>
			{/each}
		</div>
		<div class="carousel-dots">
			{#each prayerKeys as _key, i}
				<button
					class="carousel-dot"
					class:active={selectedPrayer === i}
					onclick={() => selectPrayer(i)}
					aria-label={$_('devotional.prayerDotAriaLabel', { values: { index: i + 1 } })}
				></button>
			{/each}
		</div>
	</div>

	<div class="saints-section">
		<h4 class="devotional-heading">{$_('devotional.headingPatronSaints')}</h4>
		{#each saintKeys as key}
			<div class="saint-entry">
				<span class="saint-name">{$_(`devotional.saints.${key}.name`)}</span>
				<span class="saint-title">{$_(`devotional.saints.${key}.title`)}</span>
				<p class="saint-detail">{$_(`devotional.saints.${key}.detail`)}</p>
			</div>
		{/each}
	</div>

	<p class="devotional-footer">
		&#10013; <em>{$_('devotional.footerLatin')}</em>
	</p>
	<p class="devotional-translation">{$_('devotional.footerTranslation')}</p>
	<p class="devotional-dedication">{$_('devotional.dedication')}</p>
</div>

<style>
	.devotional-page {
		padding: var(--space-4);
	}

	.devotional-heading {
		font-family: var(--theme-font, inherit);
		font-size: var(--text-sm);
		font-weight: 700;
		letter-spacing: 1.5px;
		text-transform: uppercase;
		color: var(--accent);
		margin: 0 0 var(--space-3) 0;
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--accent-muted);
	}

	.saints-section {
		margin-bottom: var(--space-4);
	}

	.saint-entry {
		margin-bottom: var(--space-3);
		padding-left: var(--space-3);
		border-left: 2px solid var(--border);
	}

	.saint-name {
		display: block;
		font-family: var(--theme-font, inherit);
		font-weight: 700;
		font-size: var(--text-sm);
		color: var(--text-primary);
		letter-spacing: 0.5px;
	}

	.saint-title {
		display: block;
		font-size: var(--text-xs);
		color: var(--accent);
		font-style: italic;
		margin-bottom: 4px;
	}

	.saint-detail {
		font-size: var(--text-xs);
		color: var(--text-muted);
		line-height: 1.5;
		margin: 0;
	}

	.prayers-section {
		margin-bottom: var(--space-4);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
	}

	.prayer-tabs-scroll {
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		margin: 0 calc(-1 * var(--space-4));
		padding: 0 var(--space-4);
		margin-bottom: var(--space-3);
		scrollbar-width: none;
	}

	.prayer-tabs-scroll::-webkit-scrollbar {
		display: none;
	}

	.prayer-tabs {
		display: flex;
		flex-wrap: nowrap;
		gap: var(--space-1);
		width: max-content;
	}

	.prayer-tab {
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--border);
		border-radius: 9999px;
		background: transparent;
		color: var(--text-secondary);
		font-size: var(--text-xs);
		font-family: var(--theme-font, inherit);
		cursor: pointer;
		min-height: 32px;
		white-space: nowrap;
		flex-shrink: 0;
		-webkit-tap-highlight-color: transparent;
		transition: all 150ms ease;
	}

	.prayer-tab.active {
		background: var(--accent-muted);
		border-color: var(--accent);
		color: var(--accent);
		font-weight: 600;
	}

	.prayer-tab.scripture {
		border-style: dashed;
	}

	.prayer-tab.scripture.active {
		border-style: solid;
	}

	.prayer-carousel {
		display: flex;
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		scroll-behavior: smooth;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
		gap: var(--space-3);
		margin: 0 calc(-1 * var(--space-4));
		padding: 0 var(--space-4);
	}

	.prayer-carousel::-webkit-scrollbar {
		display: none;
	}

	.prayer-card {
		flex: 0 0 100%;
		scroll-snap-align: center;
		padding: var(--space-3);
		background: var(--border-muted);
		border: 1px solid var(--border-muted);
		border-radius: 6px;
		position: relative;
		box-sizing: border-box;
	}

	.carousel-dots {
		display: flex;
		justify-content: center;
		gap: 6px;
		margin-top: var(--space-2);
	}

	.carousel-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		border: none;
		padding: 0;
		background: var(--border);
		cursor: pointer;
		transition: all 150ms ease;
		-webkit-tap-highlight-color: transparent;
	}

	.carousel-dot.active {
		background: var(--accent);
		transform: scale(1.3);
	}

	.prayer-kind-badge {
		display: inline-block;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.5px;
		text-transform: uppercase;
		padding: 2px 8px;
		border-radius: 9999px;
		margin-bottom: var(--space-2);
	}

	.prayer-badge {
		background: var(--accent-muted);
		color: var(--accent);
	}

	.scripture-badge {
		background: var(--border);
		color: var(--text-secondary);
	}

	.prayer-title {
		font-family: var(--theme-font, inherit);
		font-size: var(--text-sm);
		font-weight: 700;
		color: var(--text-primary);
		margin: 0 0 var(--space-2) 0;
		letter-spacing: 0.5px;
	}

	.prayer-text {
		font-size: var(--text-sm);
		line-height: 1.7;
		color: var(--text-primary);
		margin: 0 0 var(--space-2) 0;
		font-style: italic;
	}

	.prayer-attribution {
		display: block;
		font-size: var(--text-xs);
		color: var(--text-muted);
		text-align: right;
	}

	.devotional-footer {
		text-align: center;
		font-size: var(--text-xs);
		color: var(--text-muted);
		font-style: italic;
		margin: 0;
		padding-top: var(--space-2);
		border-top: 1px solid var(--border-muted);
	}

	.devotional-translation {
		text-align: center;
		font-size: 10px;
		color: var(--text-faint);
		margin: 2px 0 0;
		letter-spacing: 0.3px;
	}

	.devotional-dedication {
		text-align: center;
		font-size: 10px;
		color: var(--text-muted);
		opacity: 0.4;
		margin: var(--space-3) 0 0;
		user-select: none;
		letter-spacing: 0.5px;
	}
</style>
