<script lang="ts">
	let selectedPrayer = $state(0);

	interface PatronSaint {
		name: string;
		title: string;
		detail: string;
	}

	const saints: PatronSaint[] = [
		{
			name: 'St. Gerard Majella',
			title: 'Patron of expectant mothers',
			detail: 'An 18th-century Redemptorist lay brother whose intercession is sought by mothers for safe delivery and healthy children.'
		},
		{
			name: 'St. Gianna Beretta Molla',
			title: 'Patron of mothers & unborn children',
			detail: 'An Italian physician and mother who sacrificed her life for her unborn child in 1962. Canonized by Pope John Paul II in 2004.'
		},
		{
			name: 'St. Raymond Nonnatus',
			title: 'Patron of childbirth & midwives',
			detail: 'A 13th-century Mercedarian friar named "non natus" (not born) because he was delivered by caesarean section after his mother\'s death.'
		},
		{
			name: 'St. Margaret of Antioch',
			title: 'Patron of childbirth',
			detail: 'A virgin martyr of the early Church, invoked for centuries by women in labor. One of the Fourteen Holy Helpers.'
		},
		{
			name: 'Our Lady of La Leche',
			title: 'Patroness of nursing mothers',
			detail: 'A beloved devotion to the Blessed Virgin Mary honoring her as a nursing mother, with a shrine in St. Augustine, Florida since 1615.'
		}
	];

	interface Prayer {
		title: string;
		text: string;
		attribution: string;
	}

	const prayers: Prayer[] = [
		{
			title: 'Prayer to St. Gerard for Safe Delivery',
			text: 'O great St. Gerard, beloved servant of Jesus Christ, perfect imitator of thy meek and humble Savior, and devoted child of the Mother of God: enrich me with thy blessing before, during, and after the birth of my child. Through thy intercession may I experience a safe and happy delivery. May my child be brought safely into this world and be raised as a true child of God. Amen.',
			attribution: 'Traditional'
		},
		{
			title: 'The Memorare',
			text: 'Remember, O most gracious Virgin Mary, that never was it known that anyone who fled to thy protection, implored thy help, or sought thy intercession was left unaided. Inspired by this confidence, I fly unto thee, O Virgin of virgins, my Mother. To thee do I come, before thee I stand, sinful and sorrowful. O Mother of the Word Incarnate, despise not my petitions, but in thy mercy hear and answer me. Amen.',
			attribution: 'Attributed to St. Bernard of Clairvaux'
		},
		{
			title: 'Prayer for Mother and Child',
			text: 'Lord Jesus Christ, who was carried in the womb of the Blessed Virgin Mary, look with mercy upon this mother and her child. Grant her strength in labor, courage in pain, and joy in new life. May the child be born in safety and health, and may both mother and child rest under thy loving protection. Through the intercession of Mary, Mother of God, and all the holy mothers and saints, we ask this in thy name. Amen.',
			attribution: 'Traditional'
		},
		{
			title: 'Hail Mary',
			text: 'Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.',
			attribution: 'Traditional Catholic prayer'
		}
	];
</script>

<div class="devotional-page">
	<div class="saints-section">
		<h4 class="devotional-heading">Patron Saints of Childbirth</h4>
		{#each saints as saint}
			<div class="saint-entry">
				<span class="saint-name">{saint.name}</span>
				<span class="saint-title">{saint.title}</span>
				<p class="saint-detail">{saint.detail}</p>
			</div>
		{/each}
	</div>

	<div class="prayers-section">
		<h4 class="devotional-heading">Prayers</h4>
		<div class="prayer-tabs">
			{#each prayers as prayer, i}
				<button
					class="prayer-tab"
					class:active={selectedPrayer === i}
					onclick={() => selectedPrayer = i}
				>
					{prayer.title.split(' ').slice(0, 3).join(' ')}
				</button>
			{/each}
		</div>
		<div class="prayer-content">
			<h5 class="prayer-title">{prayers[selectedPrayer].title}</h5>
			<p class="prayer-text">{prayers[selectedPrayer].text}</p>
			<span class="prayer-attribution">— {prayers[selectedPrayer].attribution}</span>
		</div>
	</div>

	<p class="devotional-footer">
		&#10013; May the Lord bless and protect you and your child.
	</p>
	<p class="devotional-hidden">&#10084;&#65039;u AJR</p>
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
		margin-bottom: var(--space-3);
	}

	.prayer-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin-bottom: var(--space-3);
	}

	.prayer-tab {
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--border);
		border-radius: 4px;
		background: transparent;
		color: var(--text-secondary);
		font-size: var(--text-xs);
		font-family: var(--theme-font, inherit);
		cursor: pointer;
		min-height: 32px;
		-webkit-tap-highlight-color: transparent;
		transition: all 150ms ease;
	}

	.prayer-tab.active {
		background: var(--accent-muted);
		border-color: var(--accent);
		color: var(--accent);
		font-weight: 600;
	}

	.prayer-content {
		padding: var(--space-3);
		background: var(--border-muted);
		border: 1px solid var(--border-muted);
		border-radius: 6px;
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

	.devotional-hidden {
		text-align: center;
		font-size: 8px;
		color: var(--text-faint);
		opacity: 0.25;
		margin: var(--space-4) 0 0;
		user-select: none;
	}
</style>
