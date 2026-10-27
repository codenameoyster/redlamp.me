import { test, expect } from './fixtures';

const graphCases = [
	{ name: 'short Word Ladder', button: 'short', graph: ['7', '9', '3', '21', '63', '18'], layout: ['300', '6300', '5400', '2100'], path: ['hit', 'hot', 'dot', 'dog', 'cog'] },
	{ name: 'long Word Ladder', button: 'long', graph: ['20', '36', '3', '190', '570', '72'], layout: ['300', '57000', '21600', '6000'], path: ['cat', 'cap', 'cop', 'cog'] },
];

for (const c of graphCases) {
	test(`counts Graph construction and layout for ${c.name}`, async ({ page }) => {
		await page.goto('/word_ladder_visualizer');
		await page.locator(`button[onclick="loadExample('${c.button}')"]`).click();
		await expect(page.locator('#graphCounts td')).toHaveText(c.graph);
		await expect(page.locator('#layoutCounts td')).toHaveText(c.layout);
		await page.locator('button[onclick="runBFS()"]').click();
		await expect(page.locator('#resultBox .path-step')).toHaveText(c.path);
		await expect(page.locator('#drawCounts td').first()).toHaveText(c.graph[1]);
		await expect(page.locator('#drawCounts td').nth(1)).toHaveText(c.graph[0]);
		await expect.poll(() => page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
			const rect = canvas.getBoundingClientRect();
			return Math.max(Math.abs(canvas.width - rect.width), Math.abs(canvas.height - rect.height));
		})).toBeLessThanOrEqual(1);
	});
}

const bfsCases = [
	{ name: 'copied paths and Queue front removal', start: 'hit', end: 'cog', add: '', counts: ['7', '16', '15', '4', '2', '9', '5', '5'], path: ['hit', 'hot', 'dot', 'dog', 'cog'] },
	{ name: 'disconnected end', start: 'hit', end: 'zzz', add: 'zzz', counts: ['7', '18', '15', '4', '2', '9', '5', '0'], path: [] },
	{ name: 'start equals end', start: 'hit', end: 'hit', add: '', counts: ['1', '0', '0', '0', '1', '1', '1', '1'], path: ['hit'] },
];

for (const c of bfsCases) {
	test(`counts BFS work with ${c.name}`, async ({ page }) => {
		await page.goto('/word_ladder_visualizer');
		if (c.add) {
			await page.locator('#newWord').fill(c.add);
			await page.locator('#newWord').press('Enter');
		}
		await page.locator('#beginWord').fill(c.start);
		await page.locator('#endWord').fill(c.end);
		await page.locator('button[onclick="runBFS()"]').click();
		await expect(page.locator('#bfsCounts td')).toHaveText(c.counts);
		await expect(page.locator('#resultBox .path-step')).toHaveText(c.path);
		if (!c.path.length) await expect(page.locator('#resultBox')).toContainText('Путь не найден');
	});
}

test('clears BFS evidence when the Graph changes or an endpoint is absent', async ({ page }) => {
	await page.goto('/word_ladder_visualizer');
	await page.locator('#newWord').fill('hog');
	await page.locator('#newWord').press('Enter');
	await expect(page.locator('#graphCounts td')).toHaveText(['8', '13', '3', '28', '84', '26']);
	await expect(page.locator('#bfsCounts td')).toHaveCount(0);
	await expect(page.locator('#resultBox .path-step')).toHaveCount(0);
	await page.locator('#endWord').fill('zzz');
	await page.locator('button[onclick="runBFS()"]').click();
	await expect(page.locator('#resultBox')).toContainText('Оба слова должны быть в списке');
	await expect(page.locator('#bfsCounts td')).toHaveCount(0);
});

const factorCases = [
	{ name: '12 and a residual prime', n: '12', counts: ['1', '4', '2'], factors: [['2', '× 2'], ['3', '× 1']], steps: [['2', '12 → 3', '4', '2'], ['3 (в ответ)', '3 → 3', '0', '0']] },
	{ name: '360 and a shrinking remainder', n: '360', counts: ['2', '9', '5'], factors: [['2', '× 3'], ['3', '× 2'], ['5', '× 1']], steps: [['2', '360 → 45', '5', '3'], ['3', '45 → 5', '4', '2'], ['5 (в ответ)', '5 → 5', '0', '0']] },
	{ name: '1024 repeated divisions', n: '1024', counts: ['1', '12', '10'], factors: [['2', '× 10']], steps: [['2', '1024 → 1', '12', '10']] },
	{ name: '9699690 distinct factors', n: '9699690', counts: ['16', '30', '7'], factors: [['2', '× 1'], ['3', '× 1'], ['5', '× 1'], ['7', '× 1'], ['11', '× 1'], ['13', '× 1'], ['17', '× 1'], ['19', '× 1']], steps: null },
	{ name: '998244353 prime worst case', n: '998244353', counts: ['31594', '31594', '0'], factors: [['998244353', '× 1']], steps: [['2…31595', '998244353 → 998244353', '31594', '0'], ['998244353 (в ответ)', '998244353 → 998244353', '0', '0']] },
	{ name: 'small prime with no candidate', n: '3', counts: ['0', '0', '0'], factors: [['3', '× 1']], steps: [['3 (в ответ)', '3 → 3', '0', '0']] },
	{ name: 'square includes its square root', n: '49', counts: ['6', '9', '2'], factors: [['7', '× 2']], steps: [['2…6', '49 → 49', '5', '0'], ['7', '49 → 1', '4', '2']] },
];

for (const c of factorCases) {
	test(`counts Trial Division for ${c.name}`, async ({ page }) => {
		await page.goto('/mathtools/primefactorization');
		await page.locator('#numInput').fill(c.n);
		await page.locator('#numInput').press('Enter');
		await expect(page.locator('#operationCounts td')).toHaveText(c.counts);
		const factors = await page.locator('.factor-chip').evaluateAll(chips => chips.map(chip => [...chip.children].map(el => el.textContent!.trim())));
		expect(factors).toEqual(c.factors);
		expect(factors.reduce((product, [base, count]) => product * Number(base) ** Number(count.slice(2)), 1)).toBe(Number(c.n));
		const steps = await page.locator('#divisionSteps tbody tr').evaluateAll(rows => rows.map(row => [...row.children].map(el => el.textContent!.trim())));
		if (c.steps) expect(steps).toEqual(c.steps);
		expect(steps.reduce((sum, row) => sum + Number(row[2]), 0)).toBe(Number(c.counts[1]));
		expect(steps.reduce((sum, row) => sum + Number(row[3]), 0)).toBe(Number(c.counts[2]));
	});
}

const invalidCases = [
	{ name: 'empty input', value: '', message: 'Введите число.' },
	{ name: 'below the lower bound', value: '1', message: 'Введите целое число ≥ 2.' },
	{ name: 'fraction', value: '2.5', message: 'Введите целое число ≥ 2.' },
	{ name: 'above the upper bound', value: '1000000000000', message: 'Число слишком велико' },
];

for (const c of invalidCases) {
	test(`preserves the factor result after ${c.name}`, async ({ page }) => {
		await page.goto('/mathtools/primefactorization');
		await page.getByRole('button', { name: '12', exact: true }).click();
		await page.locator('#numInput').fill(c.value);
		await page.locator('#numInput').press('Enter');
		await expect(page.locator('#errorMsg')).toContainText(c.message);
		await expect(page.locator('#operationCounts td')).toHaveText(['1', '4', '2']);
		await expect(page.locator('#historyList .history-item')).toHaveCount(1);
	});
}

test('recomputes counts from history and keeps one row per input', async ({ page }) => {
	await page.goto('/mathtools/primefactorization');
	await page.getByRole('button', { name: '12', exact: true }).click();
	await page.getByRole('button', { name: '360', exact: true }).click();
	await page.locator('.history-item').filter({ has: page.locator('.h-num', { hasText: /^12$/ }) }).click();
	await expect(page.locator('#numInput')).toHaveValue('12');
	await expect(page.locator('#operationCounts td')).toHaveText(['1', '4', '2']);
	await expect(page.locator('.history-item')).toHaveCount(2);
	await expect(page.locator('.h-num').first()).toHaveText('12');
	await page.locator('button[onclick="clearHistory()"]').click();
	await expect(page.locator('#historyCard')).toBeHidden();
	await expect(page.locator('#operationCounts td')).toHaveText(['1', '4', '2']);
});

const reflowCases = [
	{ name: 'Word Ladder at 390 px', url: '/word_ladder_visualizer', width: 390 },
	{ name: 'Word Ladder at 320 px', url: '/word_ladder_visualizer', width: 320 },
	{ name: 'Prime Factorization at 390 px', url: '/mathtools/primefactorization', width: 390 },
	{ name: 'Prime Factorization at 320 px', url: '/mathtools/primefactorization', width: 320 },
];

for (const c of reflowCases) {
	test(`keeps controls and counts within ${c.name}`, async ({ page }) => {
		await page.setViewportSize({ width: c.width, height: 844 });
		await page.goto(c.url);
		if (c.url.includes('primefactorization')) await page.getByRole('button', { name: '998244353', exact: true }).click();
		else {
			await page.locator('button[onclick="loadExample(\'long\')"]').click();
			await page.locator('button[onclick="runBFS()"]').click();
			const edgePixels = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
				const { width, height } = canvas;
				const pixels = canvas.getContext('2d')!.getImageData(0, 0, width, height).data;
				let count = 0;
				for (let x = 0; x < width; x++) count += Number(pixels[4 * x + 3] > 0) + Number(pixels[4 * ((height - 1) * width + x) + 3] > 0);
				for (let y = 0; y < height; y++) count += Number(pixels[4 * y * width + 3] > 0) + Number(pixels[4 * (y * width + width - 1) + 3] > 0);
				return count;
			});
			expect(edgePixels, 'Graph marks must fit inside the canvas').toBe(0);
		}
		await page.locator('details').evaluateAll((details: HTMLDetailsElement[]) => details.forEach(el => { el.open = true; }));
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(c.width);
		const outside = await page.locator('input, button, table').evaluateAll(elements => elements.filter(el => {
			const rect = el.getBoundingClientRect();
			return rect.width > 0 && (rect.left < 0 || rect.right > innerWidth);
		}).map(el => el.outerHTML));
		expect(outside).toEqual([]);
	});
}
