import { test, expect } from './fixtures';
import type { JudgeOutput, Judgement } from '../shared/leetcode';

const code = "class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        if target == 0:\n            raise ValueError('bad')\n        while target == 10:\n            pass\n        return [1, 2]\n";
const rows: { name: string; inputs: string[]; outputs: JudgeOutput[]; progress: string | null; judgement: Judgement; verdict: string }[] = [
	{ name: 'sends the answer, the error and the timeout of the hidden tests', inputs: ['[[1, 2], 3]', '[[0, 0], 0]', '[[5, 5], 10]'], outputs: [{ value: '[1, 2]' }, { error: 'Строка 4: ValueError: bad' }, { timeout: true }], progress: 'Проверяем: 2 из 3', judgement: { verdict: 'timeout', failed: { index: 2, input: '[[5, 5], 10]', expected: '[1, 2]', output: '' } }, verdict: 'Превышено время на тесте 3' },
	{ name: 'shows the input and both answers of a wrong answer', inputs: ['[[1, 2, 3], 5]'], outputs: [{ value: '[1, 2]' }], progress: null, judgement: { verdict: 'wrong', failed: { index: 0, input: '[[1, 2, 3], 5]', expected: '[2, 3]', output: '[1, 2]' } }, verdict: 'Неверный ответ на тесте 1 Ввод: [[1, 2, 3], 5] Верный ответ: [2, 3] Ваш ответ: [1, 2]' },
	{ name: 'shows the message of a runtime error', inputs: ['[[0, 0], 0]'], outputs: [{ error: 'Строка 4: ValueError: bad' }], progress: null, judgement: { verdict: 'error', failed: { index: 0, input: '[[0, 0], 0]', expected: '[1, 2]', output: 'Строка 4: ValueError: bad' } }, verdict: 'Ошибка выполнения на тесте 1: Строка 4: ValueError: bad' },
];
for (const row of rows) {
	test(row.name, async ({ page, notebook }) => {
		test.slow();
		let sent: unknown = null;
		await page.route('**/leetcode/api/problems/*/tests', route => route.fulfill({ json: { spec: { mode: 'call', method: 'twoSum' }, source: 'set', standard: [], own: [], skeleton: '' } }));
		await page.route('**/leetcode/api/problems/*/judge/start', route => route.fulfill({ json: { seed: 7, inputs: row.inputs } }));
		await page.route('**/leetcode/api/problems/*/judge', route => { sent = route.request().postDataJSON(); return route.fulfill({ json: row.judgement }); });
		await page.goto(`/leetcode/problems/${notebook.problem.id}`);
		await page.getByLabel('Код решения', { exact: true }).fill(code);
		await page.getByRole('button', { name: 'Отправить', exact: true }).click();
		if (row.progress) await expect(page.getByText(row.progress, { exact: true })).toBeVisible({ timeout: 30_000 });
		await expect(page.getByRole('alert', { name: 'Результат проверки' })).toHaveText(row.verdict, { useInnerText: true, timeout: 30_000 });
		expect(sent).toEqual({ seed: 7, attemptId: notebook.attempt.id, outputs: row.outputs });
		await expect(page.getByText(/^Проверяем/)).toHaveCount(0);
	});
}
