import { test, expect, signIn, type TestEnv } from './fixtures';
import { sha256, type Problem, type TestCase, type TestSpec } from '../shared/leetcode';

test('loads Python and Ruff from the notebook assets under the page CSP', async ({ page, notebook, baseURL }) => {
	test.slow();
	const requests: string[] = [], loaded: string[] = [];
	page.on('request', request => requests.push(request.url()));
	page.on('response', response => { if (response.ok()) loaded.push(new URL(response.url()).pathname); });
	const shell = await page.goto(`/leetcode/problems/${notebook.problem.id}`);
	expect(shell!.headers()['content-security-policy']).toBe("default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; media-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
	await page.getByLabel('Код решения', { exact: true }).fill('class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        return nums2\n');
	await expect(page.getByRole('list', { name: 'Замечания к коду' }).getByRole('listitem')).toHaveText(['Строка 3: неизвестное имя `nums2`.'], { timeout: 30_000 });
	expect(loaded).toEqual(expect.arrayContaining(['/leetcode/assets/python.worker.js', '/leetcode/assets/pyodide/pyodide.asm.mjs', '/leetcode/assets/pyodide/pyodide.asm.wasm', '/leetcode/assets/pyodide/python_stdlib.zip', '/leetcode/assets/pyodide/pyodide-lock.json', '/leetcode/assets/ruff/ruff_wasm_bg.wasm']));
	expect(requests.filter(url => new URL(url).origin !== new URL(baseURL!).origin)).toEqual([]);
});

test('shows no run button to the parent on the student code', async ({ page, notebook }) => {
	await page.route('**/leetcode/api/problems/*/tests', route => route.fulfill({ json: { spec: { mode: 'call', method: 'twoSum' }, source: 'set', standard: [{ input: '[[2, 7, 11, 15], 9]', expected: '[0, 1]' }], own: [] } }));
	await signIn(page, 'parent');
	await page.goto(`/leetcode/problems/${notebook.problem.id}`);
	await expect(page.getByRole('heading', { name: 'Мои тесты', exact: true })).toBeVisible();
	await expect(page.getByLabel('Код решения', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Запустить тесты', exact: true })).toHaveCount(0);
});

const storedRuns = [
	{ name: 'shows the passed mark of the stored run to the parent', passed: 1, text: 'Тесты пройдены' },
	{ name: 'shows the count of the stored run to the parent', passed: 0, text: 'Последний запуск: пройдено 0 из 1' },
];
for (const row of storedRuns) {
	test(row.name, async ({ page, notebook, server }) => {
		const { DB } = await server.getWorker<TestEnv>().getEnv(), { id, problemId, document } = notebook.attempt;
		await DB.prepare("INSERT INTO test_runs (id,problem_id,attempt_id,approach_id,code_hash,passed,total,run_on,created_at) VALUES (?,?,?,?,?,?,1,'2026-10-12','now')").bind(crypto.randomUUID(), problemId, id, document.approaches[0].id, await sha256(document.approaches[0].code), row.passed).run();
		await signIn(page, 'parent');
		await page.goto(`/leetcode/problems/${problemId}`);
		await expect(page.getByText(row.text, { exact: true })).toBeVisible();
	});
}

const twoSum = 'class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n';
const runs: { name: string; spec: TestSpec; code: string; cases: TestCase[]; results: string[]; summary: string | null; diagnostics: string[] }[] = [
	{ name: 'compares the return value', spec: { mode: 'call', method: 'twoSum' }, code: `${twoSum}        return [0, 1]\n`, cases: [{ input: '[[2, 7, 11, 15], 9]', expected: '[0, 1]' }, { input: '[[3, 3], 6]', expected: '[1, 0]' }, { input: '[[1, 2], 3]', expected: null }], results: ['Тест 1: ✓ Ввод: [[2, 7, 11, 15], 9] Верный ответ: [0, 1] Ваш ответ: [0, 1]', 'Тест 2: ✗ Ввод: [[3, 3], 6] Верный ответ: [1, 0] Ваш ответ: [0, 1]', 'Тест 3: без проверки Ввод: [[1, 2], 3] Ваш ответ: [0, 1]'], summary: 'Пройдено 1 из 2', diagnostics: [] },
	{ name: 'accepts a tuple for a list', spec: { mode: 'call', method: 'twoSum' }, code: `${twoSum}        return 0, 1\n`, cases: [{ input: '[[2, 7, 11, 15], 9]', expected: '[0, 1]' }], results: ['Тест 1: ✓ Ввод: [[2, 7, 11, 15], 9] Верный ответ: [0, 1] Ваш ответ: (0, 1)'], summary: 'Пройдено 1 из 1', diagnostics: [] },
	{ name: 'accepts inner tuples in any order', spec: { mode: 'call', method: 'permute', order: 'any' }, code: 'class Solution:\n    def permute(self, nums: List[int]) -> List[List[int]]:\n        return list(itertools.permutations(nums))\n', cases: [{ input: '[[1, 2]]', expected: '[[2, 1], [1, 2]]' }], results: ['Тест 1: ✓ Ввод: [[1, 2]] Верный ответ: [[2, 1], [1, 2]] Ваш ответ: [(1, 2), (2, 1)]'], summary: 'Пройдено 1 из 1', diagnostics: [] },
	{ name: 'shows why the expected value does not parse', spec: { mode: 'call', method: 'containsDuplicate' }, code: 'class Solution:\n    def containsDuplicate(self, nums: List[int]) -> bool:\n        return len(set(nums)) < len(nums)\n', cases: [{ input: '[[1, 2, 1]]', expected: 'true' }], results: ["Тест 1: ✗ Ввод: [[1, 2, 1]] Верный ответ: true Ваш ответ: True ValueError: malformed node or string on line 1: Name(id='true', ctx=Load())"], summary: 'Пройдено 0 из 1', diagnostics: [] },
	{ name: 'compares the first argument after an in-place change', spec: { mode: 'call', method: 'moveZeroes', check: 'arg0' }, code: 'class Solution:\n    def moveZeroes(self, nums: List[int]) -> None:\n        nums.sort(key=lambda x: x == 0)\n', cases: [{ input: '[[0, 1, 0, 3, 12]]', expected: '[1, 3, 12, 0, 0]' }], results: ['Тест 1: ✓ Ввод: [[0, 1, 0, 3, 12]] Верный ответ: [1, 3, 12, 0, 0] Ваш ответ: [1, 3, 12, 0, 0]'], summary: 'Пройдено 1 из 1', diagnostics: [] },
	{ name: 'compares the prefix of the returned length', spec: { mode: 'call', method: 'removeDuplicates', check: 'prefix' }, code: 'class Solution:\n    def removeDuplicates(self, nums: List[int]) -> int:\n        k = len(set(nums))\n        nums[:k] = sorted(set(nums))\n        return k\n', cases: [{ input: '[[1, 1, 2]]', expected: '[1, 2]' }], results: ['Тест 1: ✓ Ввод: [[1, 1, 2]] Верный ответ: [1, 2] Ваш ответ: [1, 2]'], summary: 'Пройдено 1 из 1', diagnostics: [] },
	{ name: 'accepts any order of the list', spec: { mode: 'call', method: 'twoSum', order: 'any' }, code: `${twoSum}        return [1, 0]\n`, cases: [{ input: '[[2, 7, 11, 15], 9]', expected: '[0, 1]' }], results: ['Тест 1: ✓ Ввод: [[2, 7, 11, 15], 9] Верный ответ: [0, 1] Ваш ответ: [1, 0]'], summary: 'Пройдено 1 из 1', diagnostics: [] },
	{ name: 'accepts any order of the inner lists', spec: { mode: 'call', method: 'subsets', order: 'any-nested' }, code: 'class Solution:\n    def subsets(self, nums: List[int]) -> List[List[int]]:\n        return [[2, 1], [1], [], [2]]\n', cases: [{ input: '[[1, 2]]', expected: '[[], [1], [2], [1, 2]]' }], results: ['Тест 1: ✓ Ввод: [[1, 2]] Верный ответ: [[], [1], [2], [1, 2]] Ваш ответ: [[2, 1], [1], [], [2]]'], summary: 'Пройдено 1 из 1', diagnostics: [] },
	{ name: 'compares standard output token by token', spec: { mode: 'stdio' }, code: 'a, b = map(int, input().split())\nprint(a + b)\n', cases: [{ input: '2 3\n', expected: '5' }, { input: '1 1\n', expected: '3' }], results: ['Тест 1: ✓ Ввод: 2 3 Верный ответ: 5 Ваш ответ: 5', 'Тест 2: ✗ Ввод: 1 1 Верный ответ: 3 Ваш ответ: 2'], summary: 'Пройдено 1 из 2', diagnostics: [] },
	{ name: 'reads standard input as bytes', spec: { mode: 'stdio' }, code: 'import sys\na, b = map(int, sys.stdin.buffer.readline().split())\nprint(a + b)\n', cases: [{ input: '2 3\n', expected: '5' }], results: ['Тест 1: ✓ Ввод: 2 3 Верный ответ: 5 Ваш ответ: 5'], summary: 'Пройдено 1 из 1', diagnostics: [] },
	{ name: 'stops a slow test and runs the next test', spec: { mode: 'stdio' }, code: 'n = int(input())\nwhile n:\n    pass\nprint(n)\n', cases: [{ input: '1', expected: '1' }, { input: '0', expected: '0' }], results: ['Тест 1: ✗ Ввод: 1 Верный ответ: 1 Превышено время (2 с)', 'Тест 2: ✓ Ввод: 0 Верный ответ: 0 Ваш ответ: 0'], summary: 'Пройдено 1 из 2', diagnostics: [] },
	{ name: 'shows a syntax error with its line', spec: { mode: 'call', method: 'twoSum' }, code: 'class Solution:\n    def twoSum(self, nums, target)\n        return [0, 1]\n', cases: [{ input: '[[2, 7, 11, 15], 9]', expected: '[0, 1]' }], results: ["Тест 1: ✗ Ввод: [[2, 7, 11, 15], 9] Верный ответ: [0, 1] Строка 2: SyntaxError: expected ':'"], summary: 'Пройдено 0 из 1', diagnostics: ["Строка 2: ошибка синтаксиса. expected ':'"] },
	{ name: 'shows an exception with its line', spec: { mode: 'call', method: 'twoSum' }, code: `${twoSum}        seen = {}\n        return [0, nums[5]]\n`, cases: [{ input: '[[2, 7, 11, 15], 9]', expected: '[0, 1]' }], results: ['Тест 1: ✗ Ввод: [[2, 7, 11, 15], 9] Верный ответ: [0, 1] Строка 4: IndexError: list index out of range'], summary: 'Пройдено 0 из 1', diagnostics: ['Строка 3: переменная `seen` не используется.'] },
	{ name: 'shows the printed output', spec: { mode: 'call', method: 'twoSum' }, code: `${twoSum}        print('сумма', target)\n        return [0, 1]\n`, cases: [{ input: '[[2, 7, 11, 15], 9]', expected: '[0, 1]' }], results: ['Тест 1: ✓ Ввод: [[2, 7, 11, 15], 9] Верный ответ: [0, 1] Ваш ответ: [0, 1] Печать: сумма 9'], summary: 'Пройдено 1 из 1', diagnostics: [] },
];
for (const row of runs) {
	test(row.name, async ({ page, notebook }) => {
		test.slow();
		await page.route('**/leetcode/api/problems/*/tests', route => route.fulfill({ json: { spec: row.spec, source: 'set', standard: row.cases, own: [] } }));
		await page.goto(`/leetcode/problems/${notebook.problem.id}`);
		await page.getByLabel('Код решения', { exact: true }).fill(row.code);
		await page.getByRole('button', { name: 'Запустить тесты', exact: true }).click();
		await expect(page.getByRole('list', { name: 'Результаты тестов' }).getByRole('listitem')).toHaveText(row.results, { useInnerText: true, timeout: 30_000 });
		await expect(page.getByText(/^Пройдено/)).toHaveText(row.summary!);
		await expect(page.getByRole('list', { name: 'Замечания к коду' }).getByRole('listitem')).toHaveText(row.diagnostics);
	});
}

const setRuns = [
	{ name: 'passes the set tests of a call task', url: 'https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/', code: 'class Solution:\n    def twoSum(self, numbers: List[int], target: int) -> List[int]:\n        l, r = 0, len(numbers) - 1\n        while numbers[l] + numbers[r] != target:\n            if numbers[l] + numbers[r] < target:\n                l += 1\n            else:\n                r -= 1\n        return [l + 1, r + 1]\n', summary: 'Пройдено 6 из 6' },
	{ name: 'passes the set tests of an in-place task', url: 'https://leetcode.com/problems/move-zeroes/', code: 'class Solution:\n    def moveZeroes(self, nums: List[int]) -> None:\n        nums.sort(key=lambda x: x == 0)\n', summary: 'Пройдено 5 из 5' },
	{ name: 'passes the set tests of a task with any order', url: 'https://leetcode.com/problems/permutations/', code: 'class Solution:\n    def permute(self, nums: List[int]) -> List[List[int]]:\n        return [list(p) for p in itertools.permutations(nums)]\n', summary: 'Пройдено 5 из 5' },
	{ name: 'passes the set tests of a Codeforces task', url: 'https://codeforces.com/problemset/problem/1821/A', code: "for _ in range(int(input())):\n    s = input()\n    print(0 if s[0] == '0' else (9 if s[0] == '?' else 1) * 10 ** s[1:].count('?'))\n", summary: 'Пройдено 5 из 5' },
];
for (const row of setRuns) {
	test(row.name, async ({ page, baseURL }) => {
		test.slow();
		const headers = { Origin: new URL(baseURL!).origin };
		await signIn(page);
		const problem = await (await page.request.post('/leetcode/api/problems', { headers, data: { url: row.url, number: null, title: 'Task', difficulty: 'easy', topics: [], summary: '' } })).json() as Problem;
		expect((await page.request.post(`/leetcode/api/problems/${problem.id}/attempts`, { headers, data: {} })).status()).toBe(201);
		await page.goto(`/leetcode/problems/${problem.id}`);
		await page.getByLabel('Код решения', { exact: true }).fill(row.code);
		await page.getByRole('button', { name: 'Запустить тесты', exact: true }).click();
		await expect(page.getByText(/^Пройдено/)).toHaveText(row.summary, { timeout: 30_000 });
	});
}

test('runs the own tests without a reference and keeps the results after a delete', async ({ page, baseURL }) => {
	test.slow();
	await signIn(page);
	const headers = { Origin: new URL(baseURL!).origin };
	const problem = await (await page.request.post('/leetcode/api/problems', { headers, data: { url: 'https://codeforces.com/problemset/problem/1/A', number: null, title: 'Task', difficulty: 'easy', topics: [], summary: '' } })).json() as Problem;
	expect((await page.request.post(`/leetcode/api/problems/${problem.id}/attempts`, { headers, data: {} })).status()).toBe(201);
	await page.goto(`/leetcode/problems/${problem.id}`);
	await expect(page.getByText('Тестов для этой задачи пока нет.')).toBeVisible();
	await expect(page.getByLabel('Ввод', { exact: true })).toHaveAttribute('placeholder', 'Входные данные, как в условии');
	for (const input of ['2 3', '1 1']) {
		await page.getByLabel('Ввод', { exact: true }).fill(input);
		await page.getByRole('button', { name: 'Добавить тест', exact: true }).click();
		await expect(page.getByLabel('Ввод', { exact: true })).toHaveValue('');
	}
	await expect(page.getByRole('list', { name: 'Мои тесты' }).getByRole('listitem')).toHaveText(['Тест 1 Ввод: 2 3 Удалить', 'Тест 2 Ввод: 1 1 Удалить'], { useInnerText: true });
	await page.getByLabel('Код решения', { exact: true }).fill('a, b = map(int, input().split())\nprint(a + b)\n');
	await page.getByRole('button', { name: 'Запустить тесты', exact: true }).click();
	const rows = page.getByRole('list', { name: 'Результаты тестов' }).getByRole('listitem');
	const results = ['Тест 1: без проверки Ввод: 2 3 Для этой задачи нет эталонного решения. Ваш ответ: 5', 'Тест 2: без проверки Ввод: 1 1 Для этой задачи нет эталонного решения. Ваш ответ: 2'];
	await expect(rows).toHaveText(results, { useInnerText: true, timeout: 30_000 });
	await expect(rows).toHaveClass(['', '']);
	await page.getByRole('button', { name: 'Удалить тест 2', exact: true }).click();
	await expect(page.getByRole('list', { name: 'Мои тесты' }).getByRole('listitem')).toHaveText(['Тест 1 Ввод: 2 3 Удалить'], { useInnerText: true });
	await expect(rows).toHaveText(results, { useInnerText: true });
	await expect(page.getByText(/^Пройдено/)).toHaveCount(0);
	await page.reload();
	await expect(page.getByRole('list', { name: 'Мои тесты' }).getByRole('listitem')).toHaveText(['Тест 1 Ввод: 2 3 Удалить'], { useInnerText: true });
});

test('compares the own tests of a set task with the reference answer', async ({ page, baseURL }) => {
	test.slow();
	await signIn(page);
	const headers = { Origin: new URL(baseURL!).origin };
	const problem = await (await page.request.post('/leetcode/api/problems', { headers, data: { url: setRuns[0].url, number: null, title: 'Task', difficulty: 'easy', topics: [], summary: '' } })).json() as Problem;
	expect((await page.request.post(`/leetcode/api/problems/${problem.id}/attempts`, { headers, data: {} })).status()).toBe(201);
	await page.goto(`/leetcode/problems/${problem.id}`);
	// The second input is not sorted, so it breaks the constraints of the statement.
	for (const input of ['[[1, 3, 4], 7]', '[[3, 1], 4]']) {
		await page.getByLabel('Ввод', { exact: true }).fill(input);
		await page.getByRole('button', { name: 'Добавить тест', exact: true }).click();
		await expect(page.getByLabel('Ввод', { exact: true })).toHaveValue('');
	}
	// The run takes the own tests of the page, so it waits for the reload of the list. The reload asks LeetCode for the starter code.
	await expect(page.getByRole('list', { name: 'Мои тесты' }).getByRole('listitem')).toHaveText(['Тест 7 Ввод: [[1, 3, 4], 7] Удалить', 'Тест 8 Ввод: [[3, 1], 4] Удалить'], { useInnerText: true, timeout: 15_000 });
	const code = page.getByLabel('Код решения', { exact: true }), run = page.getByRole('button', { name: 'Запустить тесты', exact: true }), rows = page.getByRole('list', { name: 'Результаты тестов' }).getByRole('listitem');
	const constraints = 'Тест 8: без проверки Ввод: [[3, 1], 4] Ввод нарушает ограничения задачи. Ваш ответ: [1, 2]';
	await code.fill(setRuns[0].code);
	await run.click();
	await expect(page.getByText(/^Пройдено/)).toHaveText('Пройдено 7 из 7', { timeout: 30_000 });
	await expect(rows.nth(6)).toHaveText('Тест 7: ✓ Ввод: [[1, 3, 4], 7] Верный ответ: [2, 3] Ваш ответ: [2, 3]', { useInnerText: true });
	await expect(rows.nth(7)).toHaveText(constraints, { useInnerText: true });
	await expect(rows.nth(6)).toHaveClass('pass');
	await expect(rows.nth(7)).toHaveClass('');
	await code.fill('class Solution:\n    def twoSum(self, numbers: List[int], target: int) -> List[int]:\n        return [1, 2]\n');
	await run.click();
	await expect(rows.nth(6)).toHaveText('Тест 7: ✗ Ввод: [[1, 3, 4], 7] Верный ответ: [2, 3] Ваш ответ: [1, 2]', { useInnerText: true, timeout: 30_000 });
	await expect(rows.nth(6)).toHaveClass('fail');
	await expect(rows.nth(7)).toHaveText(constraints, { useInnerText: true });
});

test('compares the own tests with the expected answers', async ({ page, notebook }) => {
	test.slow();
	const own = ['[[3, 3], 6]', '[[1, 2], 4]', '[[1], 5]', '[[1, 2], 3', '[[2, 2], 4]'].map(input => ({ id: crypto.randomUUID(), input, createdAt: 'now' })), sent: unknown[] = [];
	await page.route('**/leetcode/api/problems/*/tests', route => route.fulfill({ json: { spec: { mode: 'call', method: 'twoSum' }, source: 'set', standard: [{ input: '[[2, 7, 11, 15], 9]', expected: '[0, 1]' }], own } }));
	await page.route('**/leetcode/api/problems/*/tests/expected', route => { sent.push(route.request().postDataJSON()); return route.fulfill({ json: { expected: [{ value: '[0, 1]' }, { value: '[1, 0]' }, { error: 'constraints' }, { error: 'input' }, { error: 'size' }] } }); });
	await page.goto(`/leetcode/problems/${notebook.problem.id}`);
	await page.getByLabel('Код решения', { exact: true }).fill(`${twoSum}        return [0, 1]\n`);
	await page.getByRole('button', { name: 'Запустить тесты', exact: true }).click();
	const rows = page.getByRole('list', { name: 'Результаты тестов' }).getByRole('listitem');
	await expect(rows).toHaveText([
		'Тест 1: ✓ Ввод: [[2, 7, 11, 15], 9] Верный ответ: [0, 1] Ваш ответ: [0, 1]',
		'Тест 2: ✓ Ввод: [[3, 3], 6] Верный ответ: [0, 1] Ваш ответ: [0, 1]',
		'Тест 3: ✗ Ввод: [[1, 2], 4] Верный ответ: [1, 0] Ваш ответ: [0, 1]',
		'Тест 4: без проверки Ввод: [[1], 5] Ввод нарушает ограничения задачи. Ваш ответ: [0, 1]',
		'Тест 5: без проверки Ввод: [[1, 2], 3 Эталонное решение не смогло прочитать ввод. SyntaxError: \'[\' was never closed',
		'Тест 6: без проверки Ввод: [[2, 2], 4] Верный ответ слишком большой для проверки. Ваш ответ: [0, 1]',
	], { useInnerText: true, timeout: 30_000 });
	await expect(rows).toHaveClass(['pass', 'pass', 'fail', '', '', '']);
	await expect(page.getByText(/^Пройдено/)).toHaveText('Пройдено 2 из 3');
	expect(sent).toEqual([{ inputs: own.map(test => test.input) }]);
});

test('marks passed tests, keeps the mark after a reload and counts the XP', async ({ page, notebook }) => {
	test.slow();
	await page.route('**/leetcode/api/problems/*/tests', route => route.fulfill({ json: { spec: { mode: 'call', method: 'twoSum' }, source: 'set', standard: [{ input: '[[2, 7, 11, 15], 9]', expected: '[0, 1]' }], own: [] } }));
	await page.goto(`/leetcode/problems/${notebook.problem.id}`);
	const code = page.getByLabel('Код решения', { exact: true }), run = page.getByRole('button', { name: 'Запустить тесты', exact: true }), mark = page.getByText('Тесты пройдены', { exact: true });
	await code.fill(`${twoSum}        return [1, 0]\n`);
	await run.click();
	await expect(page.getByText(/^Пройдено/)).toHaveText('Пройдено 0 из 1', { timeout: 30_000 });
	await code.fill(`${twoSum}        return [0, 1]\n`);
	await run.click();
	await expect(mark).toBeVisible({ timeout: 30_000 });
	await expect(page.getByRole('status', { name: 'Состояние сохранения' })).toHaveText('Сохранено');
	await page.reload();
	await expect(mark).toBeVisible();
	// +10 XP for the first pass and -2 XP for the failed run.
	await expect(page.getByLabel('Прогресс до уровня 2')).toHaveAttribute('value', '8');
	await code.fill(`${twoSum}        return [0, 1]  # done\n`);
	await expect(mark).toHaveCount(0);
});
