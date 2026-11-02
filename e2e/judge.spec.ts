import { test, expect, addTask, signIn, type TestEnv } from './fixtures';
import type { Problem } from '../shared/leetcode';

// The server judges Container With Most Water on its hidden tests: 8 edge cases, 4 random inputs, then 2 inputs of 100,000 heights.
const container = 'class Solution:\n    def maxArea(self, height: List[int]) -> int:\n        best, l, r = 0, 0, len(height) - 1\n';
const hidden: { name: string; code: string; verdict: string; section: string }[] = [
	{ name: 'accepts a correct solution and completes the task', code: `${container}        while l < r:\n            best = max(best, min(height[l], height[r]) * (r - l))\n            if height[l] < height[r]:\n                l += 1\n            else:\n                r -= 1\n        return best\n`, verdict: 'Принято', section: 'Принятое' },
	{ name: 'shows the failed hidden test of a solution without the width', code: `${container}        while l < r:\n            best = max(best, min(height[l], height[r]))\n            if height[l] < height[r]:\n                l += 1\n            else:\n                r -= 1\n        return best\n`, verdict: 'Неверный ответ на тесте 5 Ввод: [[1,2,3,4,5]] Верный ответ: 6 Ваш ответ: 4', section: 'В процессе' },
	{ name: 'shows a runtime error above the code buttons', code: `${container}        raise ValueError('bad')\n`, verdict: 'Ошибка выполнения на тесте 1: Строка 4: ValueError: bad', section: 'В процессе' },
	{ name: 'stops a quadratic solution on the maximum input', code: `${container}        for i in range(len(height)):\n            for j in range(i + 1, len(height)):\n                best = max(best, min(height[i], height[j]) * (j - i))\n        return best\n`, verdict: 'Превышено время на тесте 13', section: 'В процессе' },
];
test('shows Принято beside Отправить on a library problem', async ({ page, server }) => {
	test.slow();
	const { DB } = await server.getWorker<TestEnv>().getEnv(), problemId = crypto.randomUUID();
	await DB.prepare("INSERT INTO problems (id,slug,title,difficulty,topics,summary,search_text,created_at,updated_at) VALUES (?,'container-with-most-water','Container With Most Water','medium','[]','','','now','now')").bind(problemId).run();
	await page.route('**/leetcode/api/problems/*/tests', route => route.fulfill({ json: { spec: { mode: 'call', method: 'maxArea' }, source: 'set', standard: [], own: [], skeleton: '' } }));
	await signIn(page);
	await page.goto(`/leetcode/problems/${problemId}`);
	await page.getByLabel('Код решения', { exact: true }).fill(hidden[0].code);
	await page.getByRole('button', { name: 'Отправить', exact: true }).click();
	await expect(page.getByText('Принято', { exact: true })).toBeInViewport({ timeout: 60_000 });
});

for (const row of hidden) {
	test(row.name, async ({ page, server }) => {
		test.slow();
		const { DB } = await server.getWorker<TestEnv>().getEnv(), problemId = crypto.randomUUID();
		await DB.prepare("INSERT INTO problems (id,slug,title,difficulty,topics,summary,search_text,created_at,updated_at) VALUES (?,'container-with-most-water','Container With Most Water','medium','[]','','','now','now')").bind(problemId).run();
		await addTask(DB, problemId, 'in_progress');
		// The real tests route asks leetcode.com for the starter code.
		await page.route('**/leetcode/api/problems/*/tests', route => route.fulfill({ json: { spec: { mode: 'call', method: 'maxArea' }, source: 'set', standard: [], own: [], skeleton: '' } }));
		await signIn(page);
		await page.goto(`/leetcode/problems/${problemId}`);
		await page.getByLabel('Код решения', { exact: true }).fill(row.code);
		await page.getByRole('button', { name: 'Отправить', exact: true }).click();
		if (row.name === 'stops a quadratic solution on the maximum input') await expect(page.getByText('Проверяем: 12 из 14', { exact: true })).toBeVisible({ timeout: 60_000 });
		const result = row.verdict === 'Принято' ? page.getByText('Принято', { exact: true }) : page.getByRole('alert', { name: 'Результат проверки' });
		await expect(result).toHaveText(row.verdict, { useInnerText: true, timeout: 60_000 });
		await expect(page.getByText(/^Проверяем/)).toHaveCount(0);
		if (row.verdict !== 'Принято') {
			const [failure, button] = await Promise.all([result.boundingBox(), page.getByRole('button', { name: 'Отправить', exact: true }).boundingBox()]);
			expect(failure!.y + failure!.height).toBeLessThanOrEqual(button!.y);
		}
		await page.getByRole('link', { name: 'Домашняя работа', exact: true }).click();
		await expect(page.getByRole('region', { name: row.section, exact: true }).getByRole('heading', { level: 3 })).toHaveText(['Container With Most Water']);
	});
}

test('schedules more practice and shows the review date', async ({ page, notebook }) => {
	await page.getByRole('button', { name: 'Нужно потренироваться', exact: true }).click();
	const shown = page.getByText(/^Повторим/);
	await expect(shown).toBeVisible();
	const { understanding, nextReviewDate } = await (await page.request.get(`/leetcode/api/problems/${notebook.problem.id}`)).json() as Problem;
	expect(understanding).toBe('needs_practice');
	await expect(shown).toHaveText(`Повторим ${nextReviewDate!.slice(8)}.${nextReviewDate!.slice(5, 7)}.`);
	// The tip of the button shows below it, so the date is on the line of the button.
	const [date, button] = [await shown.boundingBox(), await page.getByRole('button', { name: 'Нужно потренироваться', exact: true }).boundingBox()];
	expect(date!.y).toBeLessThan(button!.y + button!.height);
});

test('shows the code buttons in one row and the practice button below the own tests', async ({ page, notebook }) => {
	await page.route('**/leetcode/api/problems/*/tests', route => route.fulfill({ json: { spec: { mode: 'call', method: 'twoSum' }, source: 'set', standard: [{ input: '[[2, 7, 11, 15], 9]', expected: '[0, 1]' }], own: [], skeleton: '' } }));
	await page.goto(`/leetcode/problems/${notebook.problem.id}`);
	const button = (name: string) => page.getByRole('button', { name, exact: true });
	await expect(button('Отправить')).toBeVisible();
	const [copy, run, send] = await Promise.all(['Скопировать код', 'Запустить тесты', 'Отправить'].map(name => button(name).boundingBox()));
	expect([run!.y, send!.y]).toEqual([copy!.y, copy!.y]);
	expect(copy!.x).toBeLessThan(run!.x);
	expect(run!.x).toBeLessThan(send!.x);
	const own = (await page.locator('section', { has: page.getByRole('heading', { name: 'Мои тесты', exact: true }) }).boundingBox())!;
	expect((await button('Нужно потренироваться').boundingBox())!.y).toBeGreaterThanOrEqual(own.y + own.height);
});
