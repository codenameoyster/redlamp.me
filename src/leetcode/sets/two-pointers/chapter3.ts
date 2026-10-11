import type { Chapter } from '../../../../shared/leetcode';

export default {
	title: 'Две последовательности',
	summary: 'У каждого массива или каждой строки свой указатель, и оба идут только вперёд. Слияние, подсчёт и поиск общего делают одно сравнение на шаг.',
	tasks: [
		{ url: 'https://leetcode.com/problems/merge-sorted-array/', number: 88, title: 'Merge Sorted Array', difficulty: 'easy', topics: ['Массив', 'Два указателя', 'Сортировка'], note: 'LeetCode, easy. Если сливать слева направо, запись затрёт непрочитанные числа nums1. Подумайте, с какого конца заполнять nums1.' },
		{ url: 'https://leetcode.com/problems/is-subsequence/', number: 392, title: 'Is Subsequence', difficulty: 'easy', topics: ['Строка', 'Два указателя'], note: 'LeetCode, easy. Указатель i идёт по s, j идёт по t. Буквы совпали: сдвиньте i. Указатель j двигается всегда.' },
		{ url: 'https://leetcode.com/problems/merge-strings-alternately/', number: 1768, title: 'Merge Strings Alternately', difficulty: 'easy', topics: ['Строка', 'Два указателя'], note: 'LeetCode, easy. Берите по одной букве из каждого слова по очереди. Когда одно слово закончилось, допишите остаток другого.' },
		{ url: 'https://leetcode.com/problems/intersection-of-two-arrays/', number: 349, title: 'Intersection of Two Arrays', difficulty: 'easy', topics: ['Массив', 'Два указателя', 'Сортировка'], note: 'LeetCode, easy. Отсортируйте оба массива. Двигайте указатель там, где число меньше. Числа равны: запишите число, если его ещё нет в ответе.' },
	],
	cards: [
		{ id: 'tp3-one-compare', type: 'flip', prompt: 'Почему при слиянии хватает одного сравнения на шаг?', back: 'a[i] самое маленькое из оставшихся чисел a, b[j] самое маленькое из оставшихся чисел b. Меньшее из них самое маленькое из всех оставшихся.', explain: 'Дальше a[i] и b[j] смотреть не нужно: там числа не меньше.' },
		{ id: 'tp3-code-take', type: 'code', language: 'python', prompt: 'Дополните сравнение при слиянии двух отсортированных массивов.', code: 'i = j = 0\nout = []\nwhile i < len(a) and j < len(b):\n    ___\n        out.append(a[i])\n        i += 1\n    else:\n        out.append(b[j])\n        j += 1\nout += a[i:] + b[j:]', options: ['if a[i] <= b[j]:', 'if a[i] >= b[j]:', 'if i <= j:'], answer: 0, explain: 'Берём меньшее из a[i] и b[j]. Если a[i] не больше b[j], берём из a.' },
		{ id: 'tp3-steps', type: 'short', prompt: 'Сливаем массив из 4 чисел и массив из 5 чисел. Сколько шагов вперёд сделают i и j вместе, считая дописывание остатка?', answer: '9', explain: 'Каждое число попадает в ответ ровно один раз, и каждый раз один указатель делает шаг. 4 + 5 = 9.' },
		{ id: 'tp3-count-smaller', type: 'short', prompt: 'a = [1, 3, 5, 8]. Для каждого b[j] считаем, сколько чисел в a строго меньше него. Чему равен ответ для b[j] = 6?', answer: '3', explain: 'Меньше 6 числа 1, 3 и 5. В момент, когда берём 6 из b, указатель i стоит на 8, то есть i = 3.' },
		{ id: 'tp3-equal-first', type: 'choice', prompt: 'Считаем, сколько чисел в a строго меньше b[j]. При каком условии берём число из a?', options: ['a[i] < b[j]', 'a[i] <= b[j]', 'a[i] > b[j]'], answer: 0, explain: 'При равенстве сначала берём из b. Иначе равное число из a попадёт в счёт, а оно не строго меньше.' },
		{ id: 'tp3-merge-back', type: 'choice', prompt: 'LeetCode 88: свободное место в nums1 лежит справа. С какого конца заполнять nums1?', options: ['С конца, начиная с самого большого числа', 'С начала, начиная с самого маленького числа', 'С середины'], answer: 0, explain: 'Запись в самую правую свободную ячейку не затрёт непрочитанные числа nums1: они лежат левее.' },
		{ id: 'tp3-subsequence', type: 'choice', prompt: 'LeetCode 392: s = "axc", t = "ahbgdc". Можно ли получить s из t вычёркиванием букв?', options: ['Да', 'Нет'], answer: 1, explain: 'Указатель j пройдёт всю t и не найдёт x. Указатель i остановится на x, значит, не все буквы s нашлись.' },
		{ id: 'tp3-common-move', type: 'flip', prompt: 'Ищем общие числа двух отсортированных массивов. a[i] = 4, b[j] = 7. Какой указатель двигать?', back: 'i. В b с номера j и дальше все числа не меньше 7, поэтому числа 4 там нет.', explain: 'Двигаем указатель на меньшем числе: у него пары уже не будет.' },
	],
	links: [
		{ title: 'Сортировки: слияние двух отсортированных массивов', url: 'https://algorithmica.org/ru/sorting', source: 'Алгоритмика' },
		{ title: 'Сортировка слиянием', url: 'https://ru.wikipedia.org/wiki/Сортировка_слиянием', source: 'Википедия' },
		{ title: 'Гид по алгоритмам: два указателя по разным массивам', url: 'https://habr.com/ru/articles/883030/', source: 'Хабр' },
	],
} satisfies Chapter;
