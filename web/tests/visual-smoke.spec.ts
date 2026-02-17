import { test, expect } from '@playwright/test';

const THEMES = [
	'clinical-light',
	'clinical-dark',
	'soft-light',
	'soft-dark',
	'warm-light',
	'warm-dark',
	'ocean-light',
	'ocean-dark',
	'forest-light',
	'forest-dark',
	'sunset-light',
	'sunset-dark',
	'lavender-light',
	'lavender-dark',
	'midnight-light',
	'midnight-dark',
] as const;

/** Dismiss onboarding overlay so it doesn't block interactions */
async function dismissOnboarding(page: import('@playwright/test').Page) {
	await page.evaluate(() => { localStorage.setItem('ct-onboarding-done', '1'); });
}

test.describe('Visual smoke tests', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await dismissOnboarding(page);
		await page.reload();
		// Wait for Svelte to hydrate
		await page.waitForSelector('[role="tablist"]', { timeout: 10000 });
	});

	test('Timer page (default)', async ({ page }) => {
		await expect(page.locator('[role="tablist"]')).toBeVisible();
		await page.screenshot({ path: 'test-results/01-timer-default.png', fullPage: true });
	});

	test('Timer page - More events expanded', async ({ page }) => {
		const moreBtn = page.getByText('More events');
		if (await moreBtn.isVisible()) {
			await moreBtn.click();
			await page.waitForTimeout(300);
		}
		await page.screenshot({ path: 'test-results/02-timer-more-events.png', fullPage: true });
	});

	test('Dashboard tab', async ({ page }) => {
		await page.getByRole('tab', { name: 'Dashboard' }).click();
		await page.waitForTimeout(500);
		await page.screenshot({ path: 'test-results/03-dashboard.png', fullPage: true });
	});

	test('History tab', async ({ page }) => {
		await page.getByRole('tab', { name: 'History' }).click();
		await page.waitForTimeout(500);
		await page.screenshot({ path: 'test-results/04-history.png', fullPage: true });
	});

	test('Advisor tab', async ({ page }) => {
		await page.getByRole('tab', { name: 'Advisor' }).click();
		await page.waitForTimeout(500);
		await page.screenshot({ path: 'test-results/05-advisor.png', fullPage: true });
	});

	test('Hamburger menu', async ({ page }) => {
		// The hamburger button is in the header
		const hamburger = page.locator('button').filter({ hasText: /^$/ }).first();
		// Try clicking the menu button by its position (top-right area)
		const menuBtn = page.locator('.header-bar button, .hamburger-btn, button[aria-label*="menu" i]').first();
		if (await menuBtn.isVisible()) {
			await menuBtn.click();
		} else {
			// Fallback: click top-right area
			await page.click('header button:last-child');
		}
		await page.waitForTimeout(400);
		await page.screenshot({ path: 'test-results/06-hamburger-menu.png', fullPage: true });
	});

	test('Settings panel', async ({ page }) => {
		// Open hamburger menu first
		const menuBtn = page.locator('.header-bar button, .hamburger-btn, button[aria-label*="menu" i]').first();
		if (await menuBtn.isVisible()) {
			await menuBtn.click();
			await page.waitForTimeout(300);
		}
		// Click Settings
		const settingsBtn = page.getByText('Settings');
		if (await settingsBtn.isVisible()) {
			await settingsBtn.click();
			await page.waitForTimeout(300);
		}
		await page.screenshot({ path: 'test-results/07-settings.png', fullPage: true });
	});

	test('Sessions panel', async ({ page }) => {
		const menuBtn = page.locator('.header-bar button, .hamburger-btn, button[aria-label*="menu" i]').first();
		if (await menuBtn.isVisible()) {
			await menuBtn.click();
			await page.waitForTimeout(300);
		}
		const sessionsBtn = page.getByText('Sessions');
		if (await sessionsBtn.isVisible()) {
			await sessionsBtn.click();
			await page.waitForTimeout(300);
		}
		await page.screenshot({ path: 'test-results/08-sessions.png', fullPage: true });
	});
});

test.describe('Progressive disclosure tiers', () => {
	test('Tier 0 - Empty (welcome state)', async ({ page }) => {
		await page.goto('/');
		// Clear any existing data + dismiss onboarding
		await page.evaluate(() => {
			localStorage.removeItem('contractions-timer-data');
			localStorage.setItem('ct-onboarding-done', '1');
		});
		await page.reload();
		await page.waitForSelector('[role="tablist"]', { timeout: 10000 });
		await page.waitForTimeout(300);
		await page.screenshot({ path: 'test-results/tier-0-empty.png', fullPage: true });
	});

	test('Tier 1 - Single contraction', async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => {
			localStorage.setItem('ct-onboarding-done', '1');
			const now = new Date();
			const session = {
				contractions: [{
					id: 'test1', start: new Date(now.getTime() - 180000).toISOString(),
					end: new Date(now.getTime() - 145000).toISOString(),
					intensity: 2, location: 'front', notes: '',
				}],
				events: [],
				sessionStartedAt: new Date(now.getTime() - 300000).toISOString(),
				layout: ['hospital-advisor', 'summary', 'pattern-assessment', 'trend-analysis', 'wave-chart', 'timeline', 'labor-guide'],
				paused: false,
			};
			localStorage.setItem('contractions-timer-data', JSON.stringify(session));
		});
		await page.reload();
		await page.waitForSelector('[role="tablist"]', { timeout: 10000 });
		await page.waitForTimeout(300);
		await page.screenshot({ path: 'test-results/tier-1-single.png', fullPage: true });
	});

	test('Tier 2 - Tracking (3 contractions)', async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => {
			localStorage.setItem('ct-onboarding-done', '1');
			const now = new Date();
			const c = (minsAgo: number, durSec: number, intensity: number) => ({
				id: Math.random().toString(36).slice(2, 10),
				start: new Date(now.getTime() - minsAgo * 60000).toISOString(),
				end: new Date(now.getTime() - minsAgo * 60000 + durSec * 1000).toISOString(),
				intensity, location: 'front', notes: '',
			});
			const session = {
				contractions: [c(25, 35, 2), c(15, 40, 2), c(6, 45, 3)],
				events: [],
				sessionStartedAt: new Date(now.getTime() - 30 * 60000).toISOString(),
				layout: ['hospital-advisor', 'summary', 'pattern-assessment', 'trend-analysis', 'wave-chart', 'timeline', 'labor-guide'],
				paused: false,
			};
			localStorage.setItem('contractions-timer-data', JSON.stringify(session));
		});
		await page.reload();
		await page.waitForSelector('[role="tablist"]', { timeout: 10000 });
		await page.waitForTimeout(300);
		await page.screenshot({ path: 'test-results/tier-2-tracking.png', fullPage: true });
	});

	test('Tier 3 - Pattern (early labor, 5+ contractions)', async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => {
			localStorage.setItem('ct-onboarding-done', '1');
			const now = new Date();
			const c = (minsAgo: number, durSec: number, intensity: number) => ({
				id: Math.random().toString(36).slice(2, 10),
				start: new Date(now.getTime() - minsAgo * 60000).toISOString(),
				end: new Date(now.getTime() - minsAgo * 60000 + durSec * 1000).toISOString(),
				intensity, location: 'front', notes: '',
			});
			const session = {
				contractions: [c(60, 30, 1), c(48, 35, 2), c(37, 35, 2), c(25, 40, 2), c(14, 40, 2)],
				events: [],
				sessionStartedAt: new Date(now.getTime() - 65 * 60000).toISOString(),
				layout: ['hospital-advisor', 'summary', 'pattern-assessment', 'trend-analysis', 'wave-chart', 'timeline', 'labor-guide'],
				paused: false,
			};
			localStorage.setItem('contractions-timer-data', JSON.stringify(session));
		});
		await page.reload();
		await page.waitForSelector('[role="tablist"]', { timeout: 10000 });
		await page.waitForTimeout(300);
		await page.screenshot({ path: 'test-results/tier-3-pattern.png', fullPage: true });
	});

	test('Tier 4 - Active labor (transition seed)', async ({ page }) => {
		await page.goto('/');
		await dismissOnboarding(page);
		await page.reload();
		await page.waitForSelector('[role="tablist"]', { timeout: 10000 });
		// Use dev tools to load transition scenario
		const menuBtn = page.locator('.header-bar button, .hamburger-btn, button[aria-label*="menu" i]').first();
		if (await menuBtn.isVisible()) {
			await menuBtn.click();
			await page.waitForTimeout(300);
		}
		const devtoolsBtn = page.getByText('Dev tools');
		if (await devtoolsBtn.isVisible()) {
			await devtoolsBtn.click();
			await page.waitForTimeout(300);
		}
		const transitionBtn = page.getByText('Transition');
		if (await transitionBtn.isVisible()) {
			await transitionBtn.click();
			await page.waitForTimeout(300);
		}
		// Close menu
		const closeBtn = page.locator('button[aria-label="Close"]');
		if (await closeBtn.isVisible()) {
			await closeBtn.click();
			await page.waitForTimeout(300);
		}
		await page.screenshot({ path: 'test-results/tier-4-active.png', fullPage: true });
	});
});

test.describe('Desktop layout (1280px)', () => {
	test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await dismissOnboarding(page);
		await page.reload();
		await page.waitForSelector('[role="tablist"]', { timeout: 10000 });
	});

	test('Desktop - Timer page', async ({ page }) => {
		await page.waitForTimeout(300);
		// Sidebar should be visible
		await expect(page.locator('.sidebar')).toBeVisible();
		await page.screenshot({ path: 'test-results/desktop-01-timer.png', fullPage: true });
	});

	test('Desktop - Dashboard', async ({ page }) => {
		await page.getByRole('tab', { name: 'Dashboard' }).click();
		await page.waitForTimeout(500);
		await page.screenshot({ path: 'test-results/desktop-02-dashboard.png', fullPage: true });
	});

	test('Desktop - History', async ({ page }) => {
		await page.getByRole('tab', { name: 'History' }).click();
		await page.waitForTimeout(500);
		await page.screenshot({ path: 'test-results/desktop-03-history.png', fullPage: true });
	});

	test('Desktop - Advisor', async ({ page }) => {
		await page.getByRole('tab', { name: 'Advisor' }).click();
		await page.waitForTimeout(500);
		await page.screenshot({ path: 'test-results/desktop-04-advisor.png', fullPage: true });
	});

	test('Desktop - Tier 3 with data', async ({ page }) => {
		await page.evaluate(() => {
			const now = new Date();
			const c = (minsAgo: number, durSec: number, intensity: number) => ({
				id: Math.random().toString(36).slice(2, 10),
				start: new Date(now.getTime() - minsAgo * 60000).toISOString(),
				end: new Date(now.getTime() - minsAgo * 60000 + durSec * 1000).toISOString(),
				intensity, location: 'front', notes: '',
			});
			const session = {
				contractions: [c(60, 30, 1), c(48, 35, 2), c(37, 35, 2), c(25, 40, 2), c(14, 40, 2)],
				events: [],
				sessionStartedAt: new Date(now.getTime() - 65 * 60000).toISOString(),
				layout: ['hospital-advisor', 'summary', 'pattern-assessment', 'trend-analysis', 'wave-chart', 'timeline', 'labor-guide'],
				paused: false,
			};
			localStorage.setItem('contractions-timer-data', JSON.stringify(session));
		});
		await page.reload();
		await page.waitForSelector('[role="tablist"]', { timeout: 10000 });
		await page.waitForTimeout(300);
		await page.screenshot({ path: 'test-results/desktop-05-tier3.png', fullPage: true });
	});

	test('Desktop - Hamburger menu', async ({ page }) => {
		// On desktop, menu button is in the sidebar
		const menuBtn = page.locator('.sidebar-menu-btn, button[aria-label*="menu" i]').first();
		if (await menuBtn.isVisible()) {
			await menuBtn.click();
			await page.waitForTimeout(400);
		}
		await page.screenshot({ path: 'test-results/desktop-06-menu.png', fullPage: true });
	});
});

test.describe('Onboarding flow', () => {
	test('Step 1 - Welcome (fresh user)', async ({ page }) => {
		// Clear onboarding flag to simulate fresh user
		await page.goto('/');
		await page.evaluate(() => {
			localStorage.removeItem('ct-onboarding-done');
			localStorage.removeItem('contractions-timer-data');
			localStorage.removeItem('contractions-timer-settings');
		});
		await page.reload();
		await page.waitForTimeout(500);
		await page.screenshot({ path: 'test-results/onboarding-01-welcome.png', fullPage: true });
	});

	test('Step 2 - Quick setup', async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => {
			localStorage.removeItem('ct-onboarding-done');
		});
		await page.reload();
		await page.waitForTimeout(500);
		// Click "Get started"
		const getStartedBtn = page.getByText('Get started');
		if (await getStartedBtn.isVisible()) {
			await getStartedBtn.click();
			await page.waitForTimeout(300);
		}
		await page.screenshot({ path: 'test-results/onboarding-02-setup.png', fullPage: true });
	});

	test('Step 3 - Ready', async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => {
			localStorage.removeItem('ct-onboarding-done');
		});
		await page.reload();
		await page.waitForTimeout(500);
		// Click through: Get started → Continue
		const getStartedBtn = page.getByText('Get started');
		if (await getStartedBtn.isVisible()) {
			await getStartedBtn.click();
			await page.waitForTimeout(300);
		}
		const continueBtn = page.getByText('Continue');
		if (await continueBtn.isVisible()) {
			await continueBtn.click();
			await page.waitForTimeout(300);
		}
		await page.screenshot({ path: 'test-results/onboarding-03-ready.png', fullPage: true });
	});

	test('Onboarding completes and does not reappear', async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => {
			localStorage.removeItem('ct-onboarding-done');
		});
		await page.reload();
		await page.waitForTimeout(500);
		// Complete the flow
		await page.getByText('Get started').click();
		await page.waitForTimeout(200);
		await page.getByText('Continue').click();
		await page.waitForTimeout(200);
		await page.getByText('Start tracking').click();
		await page.waitForTimeout(300);
		// Onboarding should be gone
		const onboardingOverlay = page.locator('.onboarding-overlay');
		await expect(onboardingOverlay).toHaveCount(0);
		// Reload — should NOT show onboarding again
		await page.reload();
		await page.waitForSelector('[role="tablist"]', { timeout: 10000 });
		await page.waitForTimeout(300);
		await expect(page.locator('.onboarding-overlay')).toHaveCount(0);
		await page.screenshot({ path: 'test-results/onboarding-04-completed.png', fullPage: true });
	});
});

test.describe('Theme screenshots', () => {
	for (const theme of THEMES) {
		test(`Theme: ${theme}`, async ({ page }) => {
			await page.goto('/');
			// Dismiss onboarding + set theme in one evaluate
			await page.evaluate((t) => {
				localStorage.setItem('ct-onboarding-done', '1');
				localStorage.setItem('ct-theme', t);
			}, theme);
			await page.reload();
			await page.waitForSelector('[role="tablist"]', { timeout: 10000 });
			await page.waitForTimeout(300);

			await page.screenshot({
				path: `test-results/theme-${theme}.png`,
				fullPage: true,
			});
		});
	}
});
