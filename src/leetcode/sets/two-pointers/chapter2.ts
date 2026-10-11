import type { Chapter } from '../../../../shared/leetcode';

export default {
	title: 'Читатель и писатель',
	summary: 'Оба указателя идут слева направо: read читает каждое число, write пишет только нужные. Так задачи «на месте» решаются за один проход без нового списка.',
	tasks: [
		{ url: 'https://leetcode.com/problems/remove-duplicates-from-sorted-array/', number: 26, title: 'Remove Duplicates from Sorted Array', difficulty: 'easy', topics: ['Массив', 'Два указателя'], note: 'LeetCode, easy. Модель этой главы. Оставляйте число, если оно не равно последнему оставленному.' },
		{ url: 'https://leetcode.com/problems/remove-element/', number: 27, title: 'Remove Element', difficulty: 'easy', topics: ['Массив', 'Два указателя'], note: 'LeetCode, easy. Тот же шаблон, условие «нужно оставить»: число не равно val. Верните write.' },
		{ url: 'https://leetcode.com/problems/move-zeroes/', number: 283, title: 'Move Zeroes', difficulty: 'easy', topics: ['Массив', 'Два указателя'], note: 'LeetCode, easy. Нужно оставить любое число, кроме нуля. Нули не должны теряться: они должны сами уехать вправо.' },
		{ url: 'https://leetcode.com/problems/remove-duplicates-from-sorted-array-ii/', number: 80, title: 'Remove Duplicates from Sorted Array II', difficulty: 'medium', topics: ['Массив', 'Два указателя'], note: 'LeetCode, medium. Каждому числу можно остаться два раза. Подумайте, с какой ячейкой слева от write сравнивать число.' },
		{ url: 'https://leetcode.com/problems/sort-colors/', number: 75, title: 'Sort Colors', difficulty: 'medium', topics: ['Массив', 'Два указателя', 'Сортировка'], note: 'LeetCode, medium. Задача-вызов: один читатель и два писателя, три зоны. Сначала запишите инвариант словами, потом код.' },
	],
	cards: [
		{ id: 'tp2-zones', type: 'flip', prompt: 'Что лежит слева от write, между write и read и справа от read?', back: 'Слева от write готовый ответ. Между write и read мусор: прочитано и больше не нужно. Справа от read ещё не прочитано.', explain: 'Эти три зоны верны перед каждым шагом цикла. Это инвариант формы.' },
		{ id: 'tp2-no-overtake', type: 'choice', prompt: 'Почему запись nums[write] = nums[read] не портит непрочитанные числа?', options: ['write никогда не правее read', 'read никогда не правее write', 'Массив отсортирован'], answer: 0, explain: 'write растёт только вместе с read и не быстрее него. Запись идёт в ячейку, которую read уже прочитал.' },
		{ id: 'tp2-what-changes', type: 'choice', prompt: 'В шаблоне читателя и писателя от задачи к задаче меняется одна часть. Какая?', options: ['Условие «нужно оставить»', 'Направление движения read', 'То, что функция возвращает'], answer: 0, explain: 'Цикл по read, запись в nums[write] и возврат write остаются теми же. Меняется только условие в if.' },
		{ id: 'tp2-code-remove', type: 'code', language: 'python', prompt: 'Дополните условие для LeetCode 27: убрать все числа, равные val.', code: 'write = 0\nfor read in range(len(nums)):\n    ___\n        nums[write] = nums[read]\n        write += 1\nreturn write', options: ['if nums[read] != val:', 'if nums[read] == val:', 'if nums[write] != val:'], answer: 0, explain: 'Нужно оставить все числа, кроме val. Проверяем число, которое читает read.' },
		{ id: 'tp2-code-dedup', type: 'code', language: 'python', prompt: 'Дополните условие для LeetCode 26. Первое число уже оставлено, поэтому write = 1.', code: 'write = 1\nfor read in range(1, len(nums)):\n    ___\n        nums[write] = nums[read]\n        write += 1\nreturn write', options: ['if nums[read] != nums[write - 1]:', 'if nums[read] == nums[write - 1]:', 'if read != write:'], answer: 0, explain: 'nums[write - 1] это последнее оставленное число. Новое число не равно ему, значит, это не повтор.' },
		{ id: 'tp2-dedup-count', type: 'short', prompt: 'LeetCode 26: nums = [1, 1, 1, 2, 2, 3]. Какое k вернёт функция?', answer: '3', explain: 'Разных чисел три: 1, 2 и 3. В начале массива будет [1, 2, 3].' },
		{ id: 'tp2-remove-count', type: 'short', prompt: 'LeetCode 27: nums = [0, 1, 2, 2, 3, 0, 4, 2], val = 2. Сколько чисел останется?', answer: '5', explain: 'Остаются 0, 1, 3, 0, 4. Это 5 чисел.' },
	],
	links: [
		{ title: 'Метод двух указателей: краткий конспект', url: 'https://server.179.ru/wiki/files/global/two_pointers.pdf', source: 'Школа 179' },
		{ title: 'Топовые подходы к решению алгоритмических задач', url: 'https://habr.com/ru/companies/avito/articles/806711/', source: 'Хабр' },
		{ title: 'Два указателя в массивах: быстрый и медленный указатели', url: 'https://labuladong.online/en/algo/essential-technique/array-two-pointers-summary/', source: 'labuladong (англ.)' },
	],
} satisfies Chapter;
