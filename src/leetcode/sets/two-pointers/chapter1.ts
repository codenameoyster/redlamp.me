import type { Chapter } from '../../../../shared/leetcode';

export default {
	title: 'Навстречу',
	summary: 'Указатель l идёт с начала отсортированного массива, r идёт с конца. Каждый ход выбрасывает целую строку или целый столбец пар, и вы учитесь доказывать, что ответа там нет.',
	tasks: [
		{ url: 'https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/', number: 167, title: 'Two Sum II - Input Array Is Sorted', difficulty: 'medium', topics: ['Массив', 'Два указателя'], note: 'LeetCode, medium. Модель этой главы: сумма меньше target, двигайте l; сумма больше, двигайте r. Номера в ответе считают с единицы.' },
		{ url: 'https://leetcode.com/problems/valid-palindrome/', number: 125, title: 'Valid Palindrome', difficulty: 'easy', topics: ['Строка', 'Два указателя'], note: 'LeetCode, easy. Сравнивайте символы на краях и идите к центру. Пропускайте всё, что не буква и не цифра, и не смотрите на регистр.' },
		{ url: 'https://leetcode.com/problems/max-number-of-k-sum-pairs/', number: 1679, title: 'Max Number of K-Sum Pairs', difficulty: 'medium', topics: ['Массив', 'Два указателя', 'Сортировка'], note: 'LeetCode, medium. В ответе нужно количество, а не номера, поэтому массив можно отсортировать. Сумма равна k: одна операция, двигайте оба указателя.' },
		{ url: 'https://leetcode.com/problems/container-with-most-water/', number: 11, title: 'Container With Most Water', difficulty: 'medium', topics: ['Массив', 'Два указателя'], note: 'LeetCode, medium. Площадь равна min(h[l], h[r]) · (r − l). Подумайте, какую линию можно выбросить: с ней ни одна более узкая пара не даст площадь больше.' },
		{ url: 'https://leetcode.com/problems/boats-to-save-people/', number: 881, title: 'Boats to Save People', difficulty: 'medium', topics: ['Массив', 'Два указателя', 'Сортировка'], note: 'LeetCode, medium. Отсортируйте веса. Самый тяжёлый человек едет в любом случае. Подумайте, с кем ему ехать.' },
	],
	cards: [
		{ id: 'tp1-less-move', type: 'choice', prompt: 'Массив отсортирован, target = 15, a[l] + a[r] = 13. Какой ход безопасен?', options: ['l += 1', 'r -= 1', 'Сдвинуть оба указателя'], answer: 0, explain: 'Сумма меньше target. В строке l все суммы не больше 13, ответа там нет. Ход l += 1 выбрасывает эту строку.' },
		{ id: 'tp1-why-not-r', type: 'flip', prompt: 'Сумма a[l] + a[r] меньше target. Почему нельзя двигать r?', back: 'Ход r -= 1 выбрасывает столбец r. В нём есть суммы с большими a[i], и одна из них может быть равна target.', explain: 'Пример: [1, 3, 12], target = 15. Сумма 1 + 12 = 13. Ход r -= 1 выбросит пару 3 + 12 = 15.' },
		{ id: 'tp1-invariant', type: 'choice', prompt: 'Какой инвариант у формы «навстречу»?', options: ['Если нужная пара есть, она внутри окна от l до r', 'Слева от l лежит готовый ответ', 'Сумма a[l] + a[r] растёт с каждым ходом'], answer: 0, explain: 'Каждый ход выбрасывает только строку или столбец без ответа. Поэтому ответ всегда остаётся внутри окна.' },
		{ id: 'tp1-code-greater', type: 'code', language: 'python', prompt: 'Дополните ход для суммы больше target.', code: 'l, r = 0, len(a) - 1\nwhile l < r:\n    s = a[l] + a[r]\n    if s == target:\n        return [l + 1, r + 1]\n    if s < target:\n        l += 1\n    else:\n        ___', options: ['r -= 1', 'l -= 1', 'r += 1'], answer: 0, explain: 'Сумма больше target: в столбце r все суммы не меньше текущей. Ход r -= 1 выбрасывает этот столбец.' },
		{ id: 'tp1-trace', type: 'short', prompt: 'a = [2, 7, 11, 15], target = 9. Сколько сумм проверят указатели, считая последнюю, равную 9?', answer: '3', explain: '2 + 15 = 17, больше 9: r -= 1. 2 + 11 = 13, больше 9: r -= 1. 2 + 7 = 9: пара найдена.' },
		{ id: 'tp1-moves', type: 'short', prompt: 'В массиве 8 чисел. Сколько ходов сделают указатели максимум, пока l < r?', answer: '7', explain: 'Каждый ход сужает окно на одно число. Из 8 чисел остаётся одно за 7 ходов.' },
		{ id: 'tp1-sort-allowed', type: 'choice', prompt: 'В какой задаче массив можно отсортировать перед двумя указателями?', options: ['Вернуть исходные номера двух чисел с суммой X', 'Посчитать, сколько пар с суммой k можно убрать из массива', 'Проверить, что строка читается одинаково с двух сторон'], answer: 1, explain: 'Для подсчёта номера не нужны, и сортировка не меняет ответ. В двух других задачах сортировка ломает номера или саму строку.' },
		{ id: 'tp1-container', type: 'choice', prompt: 'LeetCode 11: высоты [1, 8, 6, 2, 5, 4, 8, 3, 7], l = 0, r = 8. Какой указатель двигать?', options: ['l: линия 0 ниже', 'r: линия 8 ниже', 'Оба указателя'], answer: 0, explain: 'Площадь min(1, 7) · 8 = 8. Любая более узкая пара с линией 0 имеет высоту не больше 1, и её площадь не больше 7.' },
	],
	links: [
		{ title: 'Паттерны задач LeetCode: два указателя', url: 'https://habr.com/ru/articles/964104/', source: 'Хабр' },
		{ title: 'Паттерны задач: указатели с двух концов и в одну сторону', url: 'https://habr.com/ru/articles/1020222/', source: 'Хабр' },
		{ title: 'Два указателя: сумма двух чисел и скользящее окно', url: 'https://usaco.guide/silver/two-pointers', source: 'USACO Guide (англ.)' },
	],
} satisfies Chapter;
