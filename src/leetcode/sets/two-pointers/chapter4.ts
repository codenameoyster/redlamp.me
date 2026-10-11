import type { Chapter } from '../../../../shared/leetcode';

const forms = ['Навстречу', 'Читатель и писатель', 'Две последовательности', 'Другое'];

export default {
	title: 'Карта приёма',
	summary: 'Три формы на одной карте и два закона для всех форм. В задачах этой главы форму выбираете вы сами, без подсказок.',
	tasks: [
		{ url: 'https://codeforces.com/problemset/problem/1538/C', title: 'Number of Pairs', difficulty: 'medium', topics: ['Массив', 'Два указателя', 'Сортировка'], note: 'Codeforces, рейтинг 1300. Условие не называет форму. Сначала скажите, какая форма подходит и почему, потом пишите код. Читайте весь вход сразу.' },
		{ url: 'https://leetcode.com/problems/3sum/', number: 15, title: '3Sum', difficulty: 'medium', topics: ['Массив', 'Два указателя', 'Сортировка'], note: 'LeetCode, medium. Форму выберите сами. Тройки в ответе не должны повторяться.' },
		{ url: 'https://leetcode.com/problems/string-compression/', number: 443, title: 'String Compression', difficulty: 'medium', topics: ['Строка', 'Два указателя'], note: 'LeetCode, medium. Форму выберите сами. Ответ пишется на месте, в тот же массив chars.' },
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
