import { expect, it } from 'vitest';
import { topics } from '../src/leetcode/http';

it.each([
	{ name: 'Hash Table aliases count once', values: [' HashTable ', 'Хеш-таблица', 'hash\t TABLE'], expected: ['Hash Table'] },
	{ name: 'Array aliases count once', values: ['Arrays', 'Массив', 'Массивы', 'array'], expected: ['Array'] },
	{ name: 'String and Two Pointers', values: ['Строка', 'Два указателя', 'two pointers'], expected: ['String', 'Two Pointers'] },
	{ name: 'search and window topics', values: ['Двоичный поиск', 'Скользящее окно'], expected: ['Binary Search', 'Sliding Window'] },
	{ name: 'Heap and Monotonic Queue use LeetCode names', values: ['Heap', 'heap (priority queue)', 'Monotonic deque'], expected: ['Heap (Priority Queue)', 'Monotonic Queue'] },
	{ name: 'linear containers have canonical case', values: ['queue', 'deque', 'stack'], expected: ['Queue', 'Deque', 'Stack'] },
	{ name: 'Russian names of supported containers', values: ['Очередь', 'Дек', 'Двусторонняя очередь', 'Стек'], expected: ['Queue', 'Deque', 'Stack'] },
	{ name: 'Russian and English priority names share one topic', values: ['Куча', 'Priority Queue', 'Очередь с приоритетом', 'Приоритетная очередь'], expected: ['Heap (Priority Queue)'] },
	{ name: 'Russian Monotonic Queue', values: ['Монотонная очередь', 'Монотонный дек'], expected: ['Monotonic Queue'] },
	{ name: 'Russian Dynamic Programming name', values: ['Динамическое программирование'], expected: ['Dynamic Programming'] },
	{ name: 'common Graph and String forms', values: ['Graph', 'Граф', 'Графы', 'Строки'], expected: ['Graph Theory', 'String'] },
	{ name: 'alternate Hash Table and Binary Search spelling', values: ['Хэш-таблица', 'Хеш таблица', 'Hash-Table', 'Бинарный поиск'], expected: ['Hash Table', 'Binary Search'] },
	{ name: 'selection and divide topics', values: ['Быстрый выбор', 'Разделяй и властвуй'], expected: ['Quickselect', 'Divide and Conquer'] },
	{ name: 'Greedy and Simulation', values: ['Жадный алгоритм', 'Моделирование'], expected: ['Greedy', 'Simulation'] },
	{ name: 'mathematical topics', values: ['Математика', 'Комбинаторика', 'Рекурсия', 'Матрица'], expected: ['Math', 'Combinatorics', 'Recursion', 'Matrix'] },
	{ name: 'prefix topics', values: ['Префиксные суммы', 'Префиксное дерево'], expected: ['Prefix Sum', 'Trie'] },
	{ name: 'NFC before alias lookup', values: ['Подсче\u0308т', 'Подсчёт'], expected: ['Counting'] },
	{ name: 'Sorting topics remain distinct', values: ['Сортировка', 'Сортировка подсчётом', 'bucket sort'], expected: ['Sorting', 'Counting Sort', 'Bucket Sort'] },
	{ name: 'ordered and range topics', values: ['Упорядоченное множество', 'Минимум и максимум на отрезке'], expected: ['Ordered Set', 'Range Minimum/Maximum Query'] },
	{ name: 'Graph Theory uses the current name', values: ['Graphs', 'graph theory'], expected: ['Graph Theory'] },
	{ name: 'counting objects', values: ['Перестановки', 'Сочетания', 'Подмножества', 'Факториал'], expected: ['Permutations', 'Combinations', 'Subsets', 'Factorial'] },
	{ name: 'counting rules', values: ['Правило произведения', 'Правило суммы'], expected: ['Product Rule', 'Sum Rule'] },
	{ name: 'order and Pruning', values: ['Словарный порядок', 'Отсечение'], expected: ['Lexicographic Order', 'Pruning'] },
	{ name: 'explicit Backtracking aliases', values: ['перебор с возвратом', 'поиск с возвратом', 'backtracking'], expected: ['Backtracking'] },
	{ name: 'Enumeration and Brute Force stay distinct', values: ['Enumeration', 'Brute Force', 'Backtracking'], expected: ['Enumeration', 'Brute Force', 'Backtracking'] },
	{ name: 'letter case context', values: ['Перебор'], slug: 'letter-case-permutation', expected: ['Backtracking'] },
	{ name: 'subsets context', values: ['Перебор'], slug: 'subsets', expected: ['Backtracking'] },
	{ name: 'permutations context', values: ['Перебор'], slug: 'permutations', expected: ['Backtracking'] },
	{ name: 'combinations context', values: ['Перебор'], slug: 'combinations', expected: ['Backtracking'] },
	{ name: 'phone context', values: ['Перебор'], slug: 'letter-combinations-of-a-phone-number', expected: ['Backtracking'] },
	{ name: 'repeated subsets context', values: ['Перебор'], slug: 'subsets-ii', expected: ['Backtracking'] },
	{ name: 'repeated permutations context', values: ['Перебор'], slug: 'permutations-ii', expected: ['Backtracking'] },
	{ name: 'combination sum context', values: ['Перебор'], slug: 'combination-sum', expected: ['Backtracking'] },
	{ name: 'parentheses context', values: ['Перебор'], slug: 'generate-parentheses', expected: ['Backtracking'] },
	{ name: 'combination lock context', values: ['Перебор'], slug: 'cf-1097-b', expected: ['Backtracking'] },
	{ name: 'queens context', values: ['Перебор'], slug: 'n-queens', expected: ['Backtracking'] },
	{ name: 'Unique Paths table context', values: ['Таблица', 'dynamic programming'], slug: 'unique-paths', expected: ['Dynamic Programming'] },
	{ name: 'Top K Frequent Words correction', values: ['Сортировка подсчётом', 'Bucket Sort'], slug: 'top-k-frequent-words', expected: ['Bucket Sort'] },
	{ name: 'known Counting Sort stays distinct', values: ['Counting Sort', 'Bucket Sort'], slug: 'top-k-frequent-words', expected: ['Counting Sort', 'Bucket Sort'] },
	{ name: 'unknown English topics keep first occurrence order', values: ['  Custom   Technique ', 'HashTable', 'custom technique', 'Хеш-таблица'], expected: ['Custom Technique', 'Hash Table'] },
])('$name', ({ values, slug, expected }) => {
	expect(topics(values, slug)).toEqual(expected);
	expect(topics(expected, slug)).toEqual(expected);
});

it.each([
	{ name: 'unknown Russian topic', values: ['Особая тема'] },
	{ name: 'unknown Chinese topic', values: ['数组'] },
	{ name: 'ambiguous Enumeration without context', values: ['Перебор'] },
	{ name: 'ambiguous Enumeration in an unrelated problem', values: ['Перебор'], slug: 'two-sum' },
	{ name: 'table without context', values: ['Таблица'] },
	{ name: 'table in an unrelated problem', values: ['Таблица'], slug: 'two-sum' },
])('rejects $name with an English-name instruction', ({ values, slug }) => {
	expect(() => topics(values, slug)).toThrow('Укажите название темы на английском языке.');
});

it.each([
	{ name: 'too many aliases before deduplication', values: Array(13).fill('Array') },
	{ name: 'topic longer than 40 characters', values: ['a'.repeat(41)] },
	{ name: 'blank topic', values: ['  '] },
	{ name: 'non-string topic', values: [1] },
])('keeps validation for $name', ({ values }) => {
	expect(() => topics(values)).toThrow();
});
