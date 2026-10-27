import { expect, it } from 'vitest';
import { splitTerms } from '../shared/glossary';

// Shows each term as [word]. The texts are the text nodes of one page and share seen, so a word marked in an earlier text stays plain in a later one.
function marked(texts: string[]) {
	const seen = new Set<number>();
	return texts.map(text => splitTerms(text, seen).map(part => typeof part === 'string' ? part : `[${part.term}]`).join(''));
}

it.each([
	{ name: 'inflected form gets the tip', texts: ['Держите по инварианту.'], expected: ['Держите по [инварианту].'] },
	{ name: 'only the first match of a word', texts: ['Инвариант и снова инвариант.'], expected: ['[Инвариант] и снова инвариант.'] },
	{ name: 'each word has its own first match', texts: ['Кортеж в heap, кортеж в deque.'], expected: ['[Кортеж] в [heap], кортеж в [deque].'] },
	{ name: 'word marked in an earlier text stays plain', texts: ['Кортеж в heap.', 'Кортеж и deque.'], expected: ['[Кортеж] в [heap].', 'Кортеж и [deque].'] },
	{ name: 'word that only overlaps an earlier word stays free for a later text', texts: ['Время O(log n).', 'Память O(1).'], expected: ['Время O([log] n).', 'Память [O(1)].'] },
	{ name: 'capital at the sentence start', texts: ['Кортежи сравниваются по первому элементу.'], expected: ['[Кортежи] сравниваются по первому элементу.'] },
	{ name: 'English name at the sentence start', texts: ['Heap хранит наименьший элемент в h[0].'], expected: ['[Heap] хранит наименьший элемент в h[0].'] },
	{ name: 'heapq is not heap', texts: ['Модуль heapq и heap.'], expected: ['Модуль heapq и [heap].'] },
	{ name: 'dequeue is not deque or queue', texts: ['Слово dequeue, потом deque и queue.'], expected: ['Слово dequeue, потом [deque] и [queue].'] },
	{ name: 'code name is not a term', texts: ['collections.deque, deque([1]), deque.popleft() и queue.Queue.'], expected: ['collections.deque, deque([1]), deque.popleft() и queue.Queue.'] },
	{ name: 'deque at the sentence end', texts: ['pop from an empty deque.'], expected: ['pop from an empty [deque].'] },
	{ name: 'priority queue is one term', texts: ['Это priority queue, а не queue.'], expected: ['Это [priority queue], а не [queue].'] },
	{ name: 'monotonic deque is one term', texts: ['В monotonic deque, а потом в deque.'], expected: ['В [monotonic deque], а потом в [deque].'] },
	{ name: 'canonical hash table and array terms', texts: ['Hash Table хранит значения Array.'], expected: ['[Hash Table] хранит значения [Array].'] },
	{ name: 'full canonical heap topic', texts: ['Heap (Priority Queue) и Queue.'], expected: ['[Heap (Priority Queue)] и [Queue].'] },
	{ name: 'specific heap names before generic heap', texts: ['Min-Heap, Max-Heap и Heap.'], expected: ['[Min-Heap], [Max-Heap] и [Heap].'] },
	{ name: 'call stack before stack', texts: ['Call Stack и Stack.'], expected: ['[Call Stack] и [Stack].'] },
	{ name: 'monotonic queue before queue', texts: ['Monotonic Queue и Queue.'], expected: ['[Monotonic Queue] и [Queue].'] },
	{ name: 'algorithm names in Russian prose', texts: ['Сравните Linear Scan и Binary Search.'], expected: ['Сравните [Linear Scan] и [Binary Search].'] },
	{ name: 'pointer and window techniques', texts: ['Two Pointers и Sliding Window.'], expected: ['[Two Pointers] и [Sliding Window].'] },
	{ name: 'enumeration and recursion terms', texts: ['Backtracking строит Subsets через Recursion.'], expected: ['[Backtracking] строит [Subsets] через [Recursion].'] },
	{ name: 'next permutation before permutations', texts: ['Next Permutation и Permutations.'], expected: ['[Next Permutation] и [Permutations].'] },
	{ name: 'merge variants before merge', texts: ['K-Way Merge, Merge Sort и Merge.'], expected: ['[K-Way Merge], [Merge Sort] и [Merge].'] },
	{ name: 'code identifiers stay plain for new terms', texts: ['hash_table, array.array, dict(), set.add, nextPermutation и Array.'], expected: ['hash_table, array.array, dict(), set.add, nextPermutation и [Array].'] },
	{ name: 'dynamic programming and pruning', texts: ['Dynamic Programming и Pruning.'], expected: ['[Dynamic Programming] и [Pruning].'] },
	{ name: 'repeated phrase keeps its full meaning', texts: ['Next Permutation, Next Permutation и Permutations.'], expected: ['[Next Permutation], Next Permutation и [Permutations].'] },
	{ name: 'repeated phrase across nodes keeps the generic term available', texts: ['Min-Heap и Merge Sort.', 'Min-Heap, Merge Sort, Heap и Merge.'], expected: ['[Min-Heap] и [Merge Sort].', 'Min-Heap, Merge Sort, [Heap] и [Merge].'] },
	{ name: 'English aliases exclude calls and dotted identifiers', texts: ['subsets([1]), itertools.permutations(a), obj.recursion, my_backtracking, permutations_count и Subsets.'], expected: ['subsets([1]), itertools.permutations(a), obj.recursion, my_backtracking, permutations_count и [Subsets].'] },
	{ name: 'distinct graph structures have separate tips', texts: ['Graph, Tree и Trie.'], expected: ['[Graph], [Tree] и [Trie].'] },
	{ name: 'distinct counting rules have separate tips', texts: ['Product Rule и Sum Rule.'], expected: ['[Product Rule] и [Sum Rule].'] },
	{ name: 'методика is not метод', texts: ['Методика урока.'], expected: ['Методика урока.'] },
	{ name: 'регистрация is not регистр', texts: ['Регистрация на сайте.'], expected: ['Регистрация на сайте.'] },
	{ name: 'регистрах is a form of регистр', texts: ['Буквы в разных регистрах.'], expected: ['Буквы в разных [регистрах].'] },
	{ name: 'регистрами is a form of регистр', texts: ['Буквы с разными регистрами.'], expected: ['Буквы с разными [регистрами].'] },
	{ name: 'линейное время', texts: ['Решите задачу за линейное время.'], expected: ['Решите задачу за [линейное время].'] },
	{ name: 'переполнение', texts: ['Целые числа не переполняются.'], expected: ['Целые числа не [переполняются].'] },
	{ name: 'log inside O(n log n)', texts: ['Время O(n log n).'], expected: ['Время O(n [log] n).'] },
	{ name: 'log before its base', texts: ['Около n · log2 n шагов.'], expected: ['Около n · [log]2 n шагов.'] },
	{ name: 'O and log in one text', texts: ['За O(1) или за O(log n).'], expected: ['За [O(1)] или за O([log] n).'] },
	{ name: 'O with brackets inside', texts: ['Время O(n log(k)), память O(n log(k)).'], expected: ['Время O(n [log](k)), память [O(n log(k))].'] },
	{ name: 'lower-case o is not O', texts: ['Вызов foo(1) и o(n).'], expected: ['Вызов foo(1) и o(n).'] },
	{ name: 'phrase term', texts: ['Метод класса Solution: def f(self).'], expected: ['[Метод класса] Solution: def f(self).'] },
	{ name: 'word of a phrase term alone', texts: ['Четыре метода работают за O(1).'], expected: ['Четыре [метода] работают за [O(1)].'] },
	{ name: 'phrase across a line break', texts: ['Это перебор\nс возвратом.'], expected: ['Это [перебор\nс возвратом].'] },
	{ name: 'ambiguous корень stays plain', texts: ['Корень это пустой список.'], expected: ['Корень это пустой список.'] },
	{ name: 'ambiguous место stays plain', texts: ['Число стоит на месте 2.'], expected: ['Число стоит на месте 2.'] },
	{ name: 'ambiguous сочетание stays plain', texts: ['Любое сочетание двух разных букв.'], expected: ['Любое сочетание двух разных букв.'] },
	{ name: 'text without hard words', texts: ['Два указателя идут навстречу.'], expected: ['Два указателя идут навстречу.'] },
	{ name: 'empty text', texts: [''], expected: [''] },
])('$name', ({ texts, expected }) => {
	expect(marked(texts)).toEqual(expected);
});
