import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	workers: 1,
	timeout: 25_000,
	expect: { timeout: 5_000 },
	outputDir: '.wrangler/playwright/results',
	reporter: [['list'], ['html', { outputFolder: '.wrangler/playwright/report', open: 'never' }]],
	use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
	projects: [
		{ name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } } },
		{ name: 'mobile', testMatch: /workflow\.spec\.ts/, use: { browserName: 'chromium', viewport: { width: 390, height: 844 } } },
	],
});
