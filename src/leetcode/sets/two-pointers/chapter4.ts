import type { Chapter } from '../../../../shared/leetcode';

const forms = ['Навстречу', 'Читатель и писатель', 'Две последовательности', 'Другое'];

export default {
	title: 'Карта приёма',
	summary: 'Три формы на одной карте и два закона для всех форм. В задачах этой главы форму выбираете вы сами, без подсказок.',
	tasks: [
		{ url: 'https://codeforces.com/problemset/problem/1538/C', title: 'Number of Pairs', difficulty: 'medium', topics: ['Массив', 'Два указателя', 'Сортировка'], note: 'Codeforces, рейтинг 1300. Условие не называет форму. Сначала скажите, какая форма подходит и почему, потом пишите код. Читайте весь вход сразу.', tests: { mode: 'stdio', cases: [{ input: '4\n3 4 7\n5 1 2\n5 5 8\n5 1 2 4 3\n4 100 1000\n1 1 1 1\n5 9 13\n2 5 5 1 1\n', expected: '2\n7\n0\n1\n' }, { input: '1\n1 1 2\n1\n', expected: '0\n' }, { input: '1\n2 2 2\n1 1\n', expected: '1\n' }, { input: '1\n4 1 1000000000\n1000000000 1 1 1\n', expected: '3\n' }, { input: '1\n5 2 2\n1 1 1 1 1\n', expected: '10\n' }] } },
		{ url: 'https://leetcode.com/problems/3sum/', number: 15, title: '3Sum', difficulty: 'medium', topics: ['Массив', 'Два указателя', 'Сортировка'], note: 'LeetCode, medium. Форму выберите сами. Тройки в ответе не должны повторяться.', tests: { mode: 'call', method: 'threeSum', order: 'any-nested', cases: [{ input: '[[-1,0,1,2,-1,-4]]', expected: '[[-1,-1,2],[-1,0,1]]' }, { input: '[[0,1,1]]', expected: '[]' }, { input: '[[0,0,0]]', expected: '[[0,0,0]]' }, { input: '[[0,0,0,0]]', expected: '[[0,0,0]]' }, { input: '[[-2,0,1,1,2]]', expected: '[[-2,0,2],[-2,1,1]]' }, { input: '[[-4,-2,-2,-2,0,1,2,2,2,3,3,4,4,6,6]]', expected: '[[-4,-2,6],[-4,0,4],[-4,1,3],[-4,2,2],[-2,-2,4],[-2,0,2]]' }] } },
		{ url: 'https://leetcode.com/problems/string-compression/', number: 443, title: 'String Compression', difficulty: 'medium', topics: ['Строка', 'Два указателя'], note: 'LeetCode, medium. Форму выберите сами. Ответ пишется на месте, в тот же массив chars.', tests: { mode: 'call', method: 'compress', check: 'prefix', cases: [{ input: '[["a","a","b","b","c","c","c"]]', expected: '["a","2","b","2","c","3"]' }, { input: '[["a"]]', expected: '["a"]' }, { input: '[["a","b","b","b","b","b","b","b","b","b","b","b","b"]]', expected: '["a","b","1","2"]' }, { input: '[["a","a","a","b","b","a","a"]]', expected: '["a","3","b","2","a","2"]' }, { input: '[["#","#","1"]]', expected: '["#","2","1"]' }, { input: '[["z","z","z","z","z","z","z","z","z","z"]]', expected: '["z","1","0"]' }] } },
	],
	cards: [
		{ id: 'tp4-laws', type: 'flip', prompt: 'Назовите два закона для всех форм двух указателей.', back: 'Указатель не возвращается в ячейку, которую уже прошёл. Каждый ход выбрасывает что-то навсегда, и вы можете сказать почему.', explain: 'Первый закон даёт не больше n или n + m шагов. Второй закон это инвариант формы.' },
		{ id: 'tp4-remove-val', type: 'choice', prompt: 'Какая форма? Убрать из массива все числа, равные val, на месте и вернуть новую длину.', options: forms, answer: 1, explain: 'Слова «на месте» и «убрать»: читатель читает всё, писатель пишет только нужное. Это LeetCode 27.' },
		{ id: 'tp4-palindrome', type: 'choice', prompt: 'Какая форма? Проверить, что строка читается одинаково слева направо и справа налево.', options: forms, answer: 0, explain: 'Сравниваем края и идём к центру. Это LeetCode 125.' },
		{ id: 'tp4-common', type: 'choice', prompt: 'Какая форма? Даны два отсортированных массива, найти числа, которые есть в обоих.', options: forms, answer: 2, explain: 'Каждый указатель идёт по своему массиву, двигаем тот, где число меньше. Это LeetCode 349.' },
		{ id: 'tp4-two-sum', type: 'choice', prompt: 'Какая форма? Массив не отсортирован, вернуть исходные номера двух чисел с суммой X за O(n).', options: forms, answer: 3, explain: 'Сортировка перемешает номера и стоит дороже O(n). Здесь нужен словарь. Это LeetCode 1.' },
		{ id: 'tp4-compress', type: 'choice', prompt: 'Какая форма? Сжать массив букв на месте: a a a b b превратить в a 3 b 2.', options: forms, answer: 1, explain: 'Это LeetCode 443: читатель съедает группу, писатель пишет букву и число.' },
		{ id: 'tp4-count-less', type: 'choice', prompt: 'Какая форма? Массив отсортирован, посчитать пары с суммой меньше X.', options: forms, answer: 0, explain: 'Навстречу, но вместо одной клетки считаем сразу всю строку. Это идея из Codeforces 1538C.' },
		{ id: 'tp4-window', type: 'choice', prompt: 'Какая форма? Все числа положительные, найти самый длинный отрезок подряд с суммой не больше S.', options: forms, answer: 3, explain: 'Оба указателя идут вправо и держат отрезок между собой. Это четвёртая форма, скользящее окно. Она будет следующей темой.' },
	],
	links: [
		{ title: 'Краткая теория про два указателя', url: 'https://informatics.msk.ru/mod/page/view.php?id=16344', source: 'informatics.msk.ru' },
		{ title: '14 шаблонов задач: когда нужны два указателя', url: 'https://tproger.ru/translations/14-templates-to-answer-interview-questions', source: 'Tproger' },
		{ title: 'Задачи с тегом «два указателя», рейтинг от 800 до 1200', url: 'https://codeforces.com/problemset?tags=two+pointers,800-1200', source: 'Codeforces' },
		{ title: 'ITMO Academy: метод двух указателей', url: 'https://codeforces.com/edu/course/2/lesson/9', source: 'Codeforces EDU (нужен вход)' },
	],
} satisfies Chapter;
