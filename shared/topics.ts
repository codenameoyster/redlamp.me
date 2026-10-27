const aliases: Record<string, string[]> = {
	'Hash Table': ['HashTable', 'Hash-Table', 'Хеш-таблица', 'Хэш-таблица', 'Хеш таблица', 'Хэш таблица'],
	Array: ['Arrays', 'Массив', 'Массивы'],
	String: ['Строка', 'Строки'],
	'Two Pointers': ['Два указателя'],
	'Binary Search': ['Двоичный поиск', 'Бинарный поиск'],
	'Sliding Window': ['Скользящее окно'],
	Sorting: ['Сортировка'],
	'Heap (Priority Queue)': ['Heap', 'Priority Queue', 'Куча', 'Очередь с приоритетом', 'Приоритетная очередь'],
	'Monotonic Queue': ['Monotonic deque', 'Монотонная очередь', 'Монотонный дек'],
	Queue: ['Очередь'], Deque: ['Дек', 'Двусторонняя очередь'], Stack: ['Стек'],
	Quickselect: ['Быстрый выбор'],
	'Divide and Conquer': ['Разделяй и властвуй'],
	Greedy: ['Жадный алгоритм'],
	Simulation: ['Моделирование'],
	Math: ['Математика'],
	Combinatorics: ['Комбинаторика'],
	Recursion: ['Рекурсия'],
	Matrix: ['Матрица'],
	'Prefix Sum': ['Префиксные суммы'],
	Trie: ['Префиксное дерево'],
	Counting: ['Подсчёт'],
	'Counting Sort': ['Сортировка подсчётом'],
	'Bucket Sort': [],
	'Ordered Set': ['Упорядоченное множество'],
	'Range Minimum/Maximum Query': ['Минимум и максимум на отрезке'],
	'Graph Theory': ['Graph', 'Graphs', 'Граф', 'Графы'],
	Permutations: ['Перестановки'],
	Combinations: ['Сочетания'],
	Subsets: ['Подмножества'],
	Factorial: ['Факториал'],
	'Product Rule': ['Правило произведения'],
	'Sum Rule': ['Правило суммы'],
	'Lexicographic Order': ['Словарный порядок'],
	Pruning: ['Отсечение'],
	Backtracking: ['перебор с возвратом', 'поиск с возвратом'],
	'Dynamic Programming': ['Динамическое программирование'],
	Enumeration: [], 'Brute Force': [],
};
const names = new Map(Object.entries(aliases).flatMap(([name, values]) => [name, ...values].map(value => [value.toLowerCase(), name])));
const backtrackingProblems = new Set(['letter-case-permutation', 'subsets', 'permutations', 'combinations', 'letter-combinations-of-a-phone-number', 'subsets-ii', 'permutations-ii', 'combination-sum', 'generate-parentheses', 'cf-1097-b', 'n-queens']);

export function normalizeTopic(value: string, slug?: string): string {
	const name = value.normalize('NFC').trim().replace(/\s+/g, ' '), key = name.toLowerCase();
	if (key === 'перебор' && backtrackingProblems.has(slug ?? '')) return 'Backtracking';
	if (key === 'таблица' && slug === 'unique-paths') return 'Dynamic Programming';
	if (key === 'сортировка подсчётом' && slug === 'top-k-frequent-words') return 'Bucket Sort';
	return names.get(key) ?? name;
}

export function normalizeTopics(values: string[], slug?: string): string[] {
	const seen = new Set<string>();
	return values.map(value => normalizeTopic(value, slug)).filter(value => {
		const key = value.toLowerCase();
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}
