import { test } from '@playwright/test';

const MID_THEMES = [
	'warm-mid',    // Cathedral
	'forest-mid',  // Shire
	'lavender-mid', // Crystal
	'soft-mid',     // Aurora
	'ocean-mid',    // Abyss
] as const;

const PAGES = ['Timer', 'Dashboard', 'History', 'Advisor'] as const;

async function dismissOnboarding(page: import('@playwright/test').Page) {
	await page.evaluate(() => { localStorage.setItem('ct-onboarding-done', '1'); });
}

async function setTheme(page: import('@playwright/test').Page, theme: string) {
	await page.evaluate((t) => {
		document.documentElement.setAttribute('data-theme', t);
		localStorage.setItem('ct-theme', t);
	}, theme);
	await page.waitForTimeout(200);
}

async function addSampleData(page: import('@playwright/test').Page) {
	await page.evaluate(() => {
		const now = Date.now();
		const contractions = [];
		for (let i = 0; i < 5; i++) {
			const start = new Date(now - (i * 6 * 60000) - 50000).toISOString();
			const end = new Date(now - (i * 6 * 60000)).toISOString();
			contractions.push({
				id: `test-${i}`,
				start,
				end,
				intensity: Math.min(i + 2, 5),
				location: ['front', 'back', 'wrapping'][i % 3],
				notes: '',
				untimed: false,
			});
		}
		const session = {
			contractions,
			events: [],
			sessionStartedAt: new Date(now - 30 * 60000).toISOString(),
			layout: ['hospital-advisor', 'summary', 'pattern-assessment', 'trend-analysis', 'wave-chart', 'timeline', 'labor-guide'],
			paused: false,
		};
		localStorage.setItem('contractions-timer-data', JSON.stringify(session));
	});
}

test.describe('Mid-theme audit screenshots', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await dismissOnboarding(page);
		await addSampleData(page);
		await page.reload();
		await page.waitForSelector('[role="tablist"]', { timeout: 10000 });
	});

	for (const theme of MID_THEMES) {
		for (const pageName of PAGES) {
			test(`${theme} — ${pageName}`, async ({ page }) => {
				await setTheme(page, theme);
				if (pageName !== 'Timer') {
					await page.getByRole('tab', { name: pageName }).click();
					await page.waitForTimeout(500);
				}
				await page.screenshot({
					path: `test-results/audit-${theme}-${pageName.toLowerCase()}.png`,
					fullPage: true,
				});
			});
		}

		// Also screenshot hamburger menu
		test(`${theme} — Menu`, async ({ page }) => {
			await setTheme(page, theme);
			await page.getByLabel('Menu').click();
			await page.waitForTimeout(400);
			await page.screenshot({
				path: `test-results/audit-${theme}-menu.png`,
				fullPage: true,
			});
		});
	}
});
