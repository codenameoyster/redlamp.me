import type { LearningSetContent } from '..';
import lesson from './chapter1.html';

export default {
	slug: 'complexity',
	title: 'Как понять O(n): время и память',
	summary: 'Короткий урок на 15 минут. Считаем действия и дополнительную память на знакомых решениях. Восемь заданий с проверкой ответа прямо в уроке.',
	topics: ['Array', 'Two Pointers'],
	chapters: [{
		title: 'Как понять O(n): время и память',
		summary: 'Максимум, копия списка, два прохода и Two Sum. От точного числа действий к O(1), O(n) и O(n²).',
		lesson,
		tasks: [],
		cards: [
			{ id: 'complexity-scan', type: 'short', prompt: 'Поиск максимума начинает с best = a[0], затем сравнивает каждый оставшийся элемент с best. Во входе 6 чисел. Сколько сравнений выполнится?', answer: '5', explain: 'Первое число задаёт best. Остаются 6 - 1 = 5 сравнений. Для n чисел время O(n).' },
			{ id: 'complexity-memory', type: 'choice', prompt: 'Поиск максимума читает n чисел по индексам и хранит только i и best. Какова дополнительная память при росте n?', options: ['O(1)', 'O(n)', 'O(n²)'], answer: 0, explain: 'Два рабочих значения перезаписываются. Их количество не растёт. Вход уже существует, результат содержит одно число.' },
			{ id: 'complexity-copy', type: 'choice', prompt: 'Дан список a из n чисел. Код выполняет b = a[:]. Как растут время и дополнительная память этой строки?', options: ['Время O(1), память O(1)', 'Время O(n), память O(n)', 'Время O(n), память O(1)'], answer: 1, explain: 'Нужно скопировать n ссылок в новый список. Одна строка кода делает O(n) работы и занимает O(n) дополнительной памяти.' },
			{ id: 'complexity-passes', type: 'choice', prompt: 'Программа проходит n чисел, затем проходит их ещё раз. На каждом шаге постоянное число действий. Какова наиболее точная оценка времени из списка?', options: ['O(1)', 'O(n²)', 'O(n)'], answer: 2, explain: 'Два последовательных прохода дают 2n посещений. При удвоении n их тоже вдвое больше: O(n).' },
			{ id: 'complexity-pairs', type: 'short', prompt: 'В списке 5 чисел. Проверяем каждую пару индексов i < j без раннего выхода. Сколько пар проверим?', answer: '10', explain: '4 + 3 + 2 + 1 = 10. Для n чисел получается n(n - 1)/2 проверок: O(n²) времени.' },
			{ id: 'complexity-pointers', type: 'choice', prompt: 'Two Pointers ищет пару в уже упорядоченном списке. Каждая неудачная проверка сдвигает один край внутрь на одну позицию. Каковы время в худшем случае и дополнительная память?', options: ['O(n²) и O(1)', 'O(n) и O(n)', 'O(n) и O(1)'], answer: 2, explain: 'Расстояние между краями уменьшается с n - 1 до нуля или до найденной пары. Проверок не больше n - 1. Храним только два индекса и сумму; ответ содержит два индекса.' },
		],
		links: [
			{ title: 'Максимум и число вариантов', url: 'https://redlamp.me/leetcode/sets/permutations-and-combinations/1', source: 'Бомжарня' },
			{ title: 'Two Pointers: навстречу', url: 'https://redlamp.me/leetcode/sets/two-pointers/1', source: 'Бомжарня' },
			{ title: 'Queue, Deque и работа внутри pop(0)', url: 'https://redlamp.me/leetcode/sets/heaps-and-queues/1', source: 'Бомжарня' },
		],
	}],
} satisfies LearningSetContent;
