import { test } from '@playwright/test';

const MID_THEMES = [
	'soft-mid',
	'clinical-mid',
	'warm-mid',
	'ocean-mid',
	'forest-mid',
	'sunset-mid',
	'lavender-mid',
	'midnight-mid',
	'sky-mid',
	'blush-mid',
];

for (const theme of MID_THEMES) {
	test(`screenshot: ${theme} timer page`, async ({ page }) => {
		// Skip onboarding and set theme before page load
		await page.addInitScript((t) => {
			localStorage.setItem('ct-onboarding-done', '1');
			localStorage.setItem('ct-theme', t);
		}, theme);
		await page.goto('/');
		// Apply theme to DOM immediately
		await page.evaluate((t) => {
			document.documentElement.setAttribute('data-theme', t);
		}, theme);
		await page.waitForTimeout(800);
		await page.screenshot({ path: `test-results/mid-v2-${theme}-timer.png`, fullPage: false });
	});
}
