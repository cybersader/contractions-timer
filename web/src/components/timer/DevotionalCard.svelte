<script lang="ts">
	let selectedPrayer = $state(0);
	let carouselEl: HTMLDivElement | undefined = $state();
	let isScrollSyncing = false;

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
		if (newIndex >= 0 && newIndex < prayers.length && newIndex !== selectedPrayer) {
			selectedPrayer = newIndex;
		}
	}

	function selectPrayer(i: number) {
		selectedPrayer = i;
		scrollToCard(i);
	}

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
		},
		{
			name: 'St. Colette',
			title: 'Patron of pregnant women & women in childbirth',
			detail: 'A 14th-century French Poor Clare nun known for reforming her order. A stillborn child was said to have been revived after she wrapped it in her veil.'
		},
		{
			name: 'St. Felicity',
			title: 'Patron of expectant mothers',
			detail: 'A 2nd-century woman imprisoned and sentenced to death for her Christian faith while pregnant. Her execution was delayed until after she gave birth in prison.'
		},
		{
			name: 'St. Elizabeth',
			title: 'Patron of expectant mothers',
			detail: 'Cousin of the Blessed Virgin Mary and mother of St. John the Baptist. Called "blessed among women," she conceived her son in her old age by the grace of God.'
		},
		{
			name: 'St. Anne',
			title: 'Patron of grandmothers & women in labor',
			detail: 'Mother of the Blessed Virgin Mary. Venerated since the early Church for conceiving and bearing Mary later in life. Her name means "grace."'
		},
		{
			name: 'St. Monica',
			title: 'Patron of mothers',
			detail: 'A 4th-century mother of St. Augustine of Hippo. She endured great hardship during pregnancy with an abusive husband, yet her faith and perseverance brought her son to conversion.'
		},
		{
			name: 'St. Zélie Martin',
			title: 'Patron of mothers & grieving parents',
			detail: 'A 19th-century French mother who lost four of her nine children in infancy. Canonized in 2015 alongside her husband Louis. Mother of St. Thérèse of Lisieux.'
		},
		{
			name: 'St. Joseph',
			title: 'Patron of families, fathers & the Universal Church',
			detail: 'The foster father of Jesus and spouse of the Blessed Virgin Mary. Known as "Terror of Demons" for his powerful protection over the Holy Family. Patron of a happy death, workers, and the universal Church.'
		}
	];

	type PrayerKind = 'prayer' | 'scripture';

	interface Prayer {
		title: string;
		shortLabel: string;
		kind: PrayerKind;
		text: string;
		attribution: string;
	}

	const prayers: Prayer[] = [
		{
			title: 'Prayer to St. Gerard for Safe Delivery',
			shortLabel: 'St. Gerard',
			kind: 'prayer',
			text: 'O great St. Gerard, beloved servant of Jesus Christ, perfect imitator of thy meek and humble Savior, and devoted child of the Mother of God: enrich me with thy blessing before, during, and after the birth of my child. Through thy intercession may I experience a safe and happy delivery. May my child be brought safely into this world and be raised as a true child of God. Amen.',
			attribution: 'Traditional Catholic Prayer'
		},
		{
			title: 'The Memorare',
			shortLabel: 'Memorare',
			kind: 'prayer',
			text: 'Remember, O most gracious Virgin Mary, that never was it known that anyone who fled to thy protection, implored thy help, or sought thy intercession was left unaided. Inspired by this confidence, I fly unto thee, O Virgin of virgins, my Mother. To thee do I come, before thee I stand, sinful and sorrowful. O Mother of the Word Incarnate, despise not my petitions, but in thy mercy hear and answer me. Amen.',
			attribution: 'Attributed to St. Bernard of Clairvaux'
		},
		{
			title: 'Prayer for Mother and Child',
			shortLabel: 'Mother & Child',
			kind: 'prayer',
			text: 'Lord Jesus Christ, who was carried in the womb of the Blessed Virgin Mary, look with mercy upon this mother and her child. Grant her strength in labor, courage in pain, and joy in new life. May the child be born in safety and health, and may both mother and child rest under thy loving protection. Through the intercession of Mary, Mother of God, and all the holy mothers and saints, we ask this in thy name. Amen.',
			attribution: 'Traditional Catholic Prayer'
		},
		{
			title: 'Hail Mary',
			shortLabel: 'Hail Mary',
			kind: 'prayer',
			text: 'Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.',
			attribution: 'Traditional Catholic Prayer'
		},
		{
			title: 'Prayer to Our Lady of La Leche',
			shortLabel: 'Our Lady of La Leche',
			kind: 'prayer',
			text: 'Lovely Lady of La Leche, most loving Mother of the Child Jesus, and my mother, I come to ask your help. I believe in God\'s power, and I place all my trust in you. Grant me the grace of motherhood. Assist me, dear Lady, in this my longing, and if it be the Holy Will of God for me to conceive, obtain for me the grace of carrying my child to term. Through the intercession of Thy Holy Mother and the merits of her divine Son, have mercy on us. Amen.',
			attribution: 'Traditional — Shrine of Our Lady of La Leche, St. Augustine, FL'
		},
		{
			title: 'Prayer for a Safe Delivery',
			shortLabel: 'Safe Delivery',
			kind: 'prayer',
			text: 'Lord Jesus, I place my baby and myself into your loving hands. Calm my fears, strengthen my body, and guide those who care for us. May this birth be safe and filled with your peace. I trust in your plan for our lives. Amen.',
			attribution: 'Contemporary Catholic Prayer'
		},
		{
			title: 'Prayer to St. Joseph, Protector of Families',
			shortLabel: 'St. Joseph',
			kind: 'prayer',
			text: 'O St. Joseph, whose protection is so great, so strong, so prompt before the throne of God, I place in thee all my interests and desires. O St. Joseph, assist me by thy powerful intercession and obtain for me all spiritual blessings through thy foster Son, Jesus Christ our Lord, so that, having engaged here below thy heavenly power, I may offer my thanksgiving and homage. O St. Joseph, Terror of Demons, pray for us and for our family. Guard this mother and child with thy fatherly care. Amen.',
			attribution: 'Traditional Catholic Prayer to St. Joseph'
		},
		{
			title: 'Psalm 139:13\u201316 — Knit Together',
			shortLabel: '\ud83d\udcd6 Psalm 139',
			kind: 'scripture',
			text: 'For you created my inmost being; you knit me together in my mother\u2019s womb. I praise you because I am fearfully and wonderfully made; your works are wonderful, I know that full well. My frame was not hidden from you when I was made in the secret place, when I was woven together in the depths of the earth. Your eyes saw my unformed body; all the days ordained for me were written in your book before one of them came to be.',
			attribution: 'Psalm 139:13\u201316 (NIV)'
		},
		{
			title: 'Isaiah 66:9 — Promise of Delivery',
			shortLabel: '\ud83d\udcd6 Isaiah 66:9',
			kind: 'scripture',
			text: 'Do I bring to the moment of birth and not give delivery? says the Lord. Do I close up the womb when I bring to delivery? says your God.',
			attribution: 'Isaiah 66:9 (NIV)'
		},
		{
			title: 'Jeremiah 1:5 — Known Before Birth',
			shortLabel: '\ud83d\udcd6 Jeremiah 1:5',
			kind: 'scripture',
			text: 'Before I formed you in the womb I knew you, before you were born I set you apart.',
			attribution: 'Jeremiah 1:5 (NIV)'
		},
		{
			title: 'The Magnificat (Canticle of Mary)',
			shortLabel: '\ud83d\udcd6 Magnificat',
			kind: 'scripture',
			text: 'My soul proclaims the greatness of the Lord, my spirit rejoices in God my Savior, for he has looked with favor on his lowly servant. From this day all generations will call me blessed: the Almighty has done great things for me, and holy is his Name.',
			attribution: 'Luke 1:46\u201349 \u2014 The Magnificat'
		}
	];
</script>

<div class="devotional-page">
	<div class="prayers-section">
		<h4 class="devotional-heading">Prayers & Scripture</h4>
		<div class="prayer-tabs-scroll">
			<div class="prayer-tabs">
				{#each prayers as prayer, i}
					<button
						class="prayer-tab"
						class:active={selectedPrayer === i}
						class:scripture={prayer.kind === 'scripture'}
						onclick={() => selectPrayer(i)}
					>
						{prayer.shortLabel}
					</button>
				{/each}
			</div>
		</div>
		<div class="prayer-carousel" bind:this={carouselEl} onscroll={handleCarouselScroll}>
			{#each prayers as prayer, i}
				<div class="prayer-card">
					{#if prayer.kind === 'scripture'}
						<div class="prayer-kind-badge scripture-badge">Scripture</div>
					{:else}
						<div class="prayer-kind-badge prayer-badge">Prayer</div>
					{/if}
					<h5 class="prayer-title">{prayer.title}</h5>
					<p class="prayer-text">{prayer.text}</p>
					<span class="prayer-attribution">&mdash; {prayer.attribution}</span>
				</div>
			{/each}
		</div>
		<div class="carousel-dots">
			{#each prayers as _, i}
				<button
					class="carousel-dot"
					class:active={selectedPrayer === i}
					onclick={() => selectPrayer(i)}
					aria-label="Prayer {i + 1}"
				></button>
			{/each}
		</div>
	</div>

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

	<p class="devotional-footer">
		&#10013; <em>Pax Domini sit semper vobiscum.</em>
	</p>
	<p class="devotional-translation">The peace of the Lord be always with you.</p>
	<p class="devotional-dedication">Made with &hearts; for AJR</p>
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
		scroll-snap-type: x proximity;
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
