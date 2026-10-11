import type { Chapter } from '../../../../shared/leetcode';

export default {
	title: 'Повторы и отсечения',
	summary: 'Если во входе есть одинаковые числа, перебор даёт одинаковые ответы. Сортировка и пропуск убирают повторы, а отсечение останавливает бесполезные ветки.',
	tasks: [
		{ url: 'https://leetcode.com/problems/subsets-ii/', number: 90, title: 'Subsets II', difficulty: 'medium', topics: ['Массив', 'Перебор', 'Сортировка'], note: 'LeetCode, medium. Отсортируйте список и пропускайте число, равное предыдущему, на одном уровне. Условие i > start, а не i > 0.' },
		{ url: 'https://leetcode.com/problems/permutations-ii/', number: 47, title: 'Permutations II', difficulty: 'medium', topics: ['Массив', 'Перебор', 'Сортировка'], note: 'LeetCode, medium. Отсортируйте список и пропускайте nums[i], если nums[i - 1] такое же и ещё не использовано. Для [1, 1, 2] должно получиться 3 ответа.' },
		{ url: 'https://leetcode.com/problems/combination-sum/', number: 39, title: 'Combination Sum', difficulty: 'medium', topics: ['Массив', 'Перебор'], note: 'LeetCode, medium. Число можно брать снова, поэтому глубже передавайте start = i. После сортировки делайте break, когда число больше остатка.' },
		{ url: 'https://leetcode.com/problems/generate-parentheses/', number: 22, title: 'Generate Parentheses', difficulty: 'medium', topics: ['Строка', 'Перебор'], note: 'LeetCode, medium. Добавляйте "(" пока opened < n и ")" пока closed < opened. При n = 3 получается 5 строк.' },
		{ url: 'https://codeforces.com/problemset/problem/1097/B', title: 'Petr and a Combination Lock', difficulty: 'medium', topics: ['Перебор', 'Подмножества'], note: 'Codeforces, рейтинг 1200. Каждому повороту дайте знак плюс или минус: 2 в степени n вариантов, при n = 15 это 32768. Проверьте, делится ли сумма на 360.' },
	],
	cards: [
		{ id: 'pc3-dup-skip', type: 'code', language: 'python', prompt: 'Дополните правило пропуска одинаковых чисел в Subsets II. Список отсортирован.', code: 'for i in range(start, len(nums)):\n    ___\n        continue\n    path.append(nums[i])\n    dfs(i + 1, path)\n    path.pop()', options: ['if nums[i] == nums[i - 1]:', 'if i > start and nums[i] == nums[i - 1]:', 'if i > 0 and nums[i] == nums[i - 1]:'], answer: 1, explain: 'i > start разрешает первую копию на каждом уровне и пропускает следующие. С i > 0 первая копия на глубоком уровне тоже пропадёт, и [2, 2] не получится.' },
		{ id: 'pc3-sort-first', type: 'flip', prompt: 'Зачем сортировать список перед пропуском одинаковых чисел?', back: 'Одинаковые числа становятся соседями, и проверка nums[i] == nums[i - 1] находит каждый повтор.', explain: 'Без сортировки одинаковые числа могут стоять далеко друг от друга, и проверка соседа их не заметит.' },
		{ id: 'pc3-perm-ii-count', type: 'short', prompt: 'Permutations II со списком [1, 1, 2]. Сколько разных ответов?', answer: '3', explain: 'Ответы: [1, 1, 2], [1, 2, 1], [2, 1, 1]. Две единицы одинаковые, их обмен даёт тот же список.' },
		{ id: 'pc3-reuse-start', type: 'choice', prompt: 'В Combination Sum одно число можно взять много раз. Какой вызов сделать глубже?', options: ['dfs(i + 1, remain - candidates[i], path)', 'dfs(i, remain - candidates[i], path)', 'dfs(0, remain - candidates[i], path)'], answer: 1, explain: 'start = i: это число и большие можно взять снова, меньшие нет. Поэтому [2, 2, 3] появится один раз, а [3, 2, 2] не появится.' },
		{ id: 'pc3-prune', type: 'flip', prompt: 'В Combination Sum список отсортирован. Когда цикл можно остановить через break?', back: 'Когда candidates[i] > remain. Все следующие числа больше, и ни одна ветка дальше не дойдёт до цели.', explain: 'break безопасен только после сортировки. Без сортировки можно делать только continue.' },
		{ id: 'pc3-catalan', type: 'short', prompt: 'Generate Parentheses при n = 3. Сколько правильных строк?', answer: '5', explain: 'Строки: ((())), (()()), (())(), ()(()), ()()().' },
		{ id: 'pc3-paren-rule', type: 'choice', prompt: 'В Generate Parentheses когда можно добавить закрывающую скобку?', options: ['Пока closed < n', 'Пока closed < opened', 'В любой момент'], answer: 1, explain: 'Закрывающей скобке нужна открытая перед ней. Правило closed < opened держит каждую строку правильной.' },
	],
	links: [
		{ title: 'Перебор с возвратом: отсечения', url: 'https://notes.algoprog.ru/ru/backtrack/01_2_cuts.html', source: 'Заметки П. Калинина (algoprog)' },
		{ title: 'Правильная скобочная последовательность', url: 'https://ru.wikipedia.org/wiki/Правильная_скобочная_последовательность', source: 'Википедия' },
		{ title: 'Как устроен алгоритм поиска с возвратом', url: 'https://thecode.media/backtracking/', source: 'Журнал «Код»' },
		{ title: 'Правильные скобочные последовательности', url: 'https://cp-algorithms.com/combinatorics/bracket_sequences.html', source: 'cp-algorithms (англ.)' },
	],
} satisfies Chapter;
