// The hard words of the sets, each with a plain tip for a student of the 10th class. A pattern finds the word in its inflected forms, but not a longer word with the same start.
// A word with two meanings in the sets, such as "корень" or "на месте", has no entry.
// log comes before O(...): a match that overlaps the match of an earlier entry stays plain, so O(log n) gives the tip of log. For the same reason, priority queue and monotonic deque come before queue and deque.
// An English name of a data structure is a word of its own: heapq, dequeue, collections.deque, deque(...) and deque.popleft are code and stay plain.
export const glossary: { pattern: RegExp; tip: string }[] = [
	{ pattern: /(?<!\p{L})log(?!\p{L})/giu, tip: 'Сколько раз число можно делить пополам, пока не останется 1. Для 100 000 это около 17.' },
	{ pattern: /(?<!\p{L})O\((?:[^()]|\([^()]*\))*\)/gu, tip: 'Так записывают, как растут время или память, когда растёт n. O(1): не растут, O(n): растут так же, как n.' },
	{ pattern: /(?<!\p{L})инвариант\p{L}*/giu, tip: 'Утверждение, которое верно перед каждым шагом цикла.' },
	{ pattern: /(?<!\p{L})метод(?:а|е|у|ом|ы|ов|ам|ами|ах)?(?:\s+класса)?(?!\p{L})/giu, tip: 'Функция, которую вызывают через точку, например q.append(x). В задаче это функция внутри class Solution.' },
	{ pattern: /(?<![\p{L}\p{N}_.])priority\s+queue(?![\p{L}\p{N}_(]|\.\p{L})/giu, tip: 'Ряд элементов, из которого первым берут самый маленький, а не тот, что пришёл раньше. В Python его делают на модуле heapq.' },
	{ pattern: /(?<![\p{L}\p{N}_.])monotonic\s+deque(?![\p{L}\p{N}_(]|\.\p{L})/giu, tip: 'Ряд с двумя концами, в котором числа идут только по убыванию или только по возрастанию.' },
	{ pattern: /(?<![\p{L}\p{N}_.])heap(?![\p{L}\p{N}_(]|\.\p{L})/giu, tip: 'Список, в котором самый маленький элемент всегда стоит первым. Взять его и положить новый можно быстро.' },
	{ pattern: /(?<![\p{L}\p{N}_.])deque(?![\p{L}\p{N}_(]|\.\p{L})/giu, tip: 'Ряд элементов с двумя концами: класть и брать можно и в начале, и в конце.' },
	{ pattern: /(?<![\p{L}\p{N}_.])queue(?![\p{L}\p{N}_(]|\.\p{L})/giu, tip: 'Ряд элементов, как очередь в магазине: новый встаёт в конец, а берут из начала.' },
	{ pattern: /(?<![\p{L}\p{N}_.])stack(?![\p{L}\p{N}_(]|\.\p{L})/giu, tip: 'Стопка элементов: взять можно только тот, что положили последним.' },
	{ pattern: /(?<!\p{L})жадн\p{L}*/giu, tip: 'На каждом шаге берут то, что лучше всего сейчас, и не возвращаются назад.' },
	{ pattern: /(?<!\p{L})моделир\p{L}*/giu, tip: 'Повторить в программе шаг за шагом процесс из условия.' },
	{ pattern: /(?<!\p{L})кортеж\p{L}*/giu, tip: "Несколько значений в круглых скобках, например (3, 'a'). Его нельзя изменить." },
	{ pattern: /(?<!\p{L})рекурс\p{L}*/giu, tip: 'Функция вызывает сама себя, чтобы решить меньшую часть задачи.' },
	{ pattern: /(?<!\p{L})перебор\p{L}*\s+с\s+возврат\p{L}*/giu, tip: 'Идут по варианту до конца, потом делают шаг назад и пробуют следующий.' },
	{ pattern: /(?<!\p{L})отсеч\p{L}*/giu, tip: 'Перебор бросает ветку заранее, если в ней точно нет ответа.' },
	{ pattern: /(?<!\p{L})трассир\p{L}*/giu, tip: 'Пройти код вручную по шагам и записать значения переменных.' },
	{ pattern: /(?<!\p{L})подмассив\p{L}*/giu, tip: 'Кусок массива подряд, без пропусков.' },
	{ pattern: /(?<!\p{L})подпоследовательност\p{L}*/giu, tip: 'То, что останется, если вычеркнуть часть элементов и не менять порядок остальных.' },
	{ pattern: /(?<!\p{L})лексикографическ\p{L}*/giu, tip: 'Порядок как в словаре: сначала сравнивают первые элементы, при равенстве вторые и так дальше.' },
	{ pattern: /(?<!\p{L})ленив\p{L}*\s+удалени\p{L}*/giu, tip: 'Ненужный элемент не удаляют сразу. Его выбрасывают позже, когда он окажется наверху.' },
	{ pattern: /(?<!\p{L})индекс\p{L}*/giu, tip: 'Номер элемента в списке. В списке Python счёт идёт с 0, а в условии номера могут идти с 1.' },
	{ pattern: /(?<!\p{L})факториал\p{L}*/giu, tip: 'n! это произведение всех чисел от 1 до n. Например, 4! = 1 · 2 · 3 · 4 = 24.' },
	{ pattern: /(?<!\p{L})перестановк\p{L}*/giu, tip: 'Все элементы, выписанные в каком-то порядке. Например, 2, 3, 1 для чисел 1, 2, 3.' },
	{ pattern: /(?<!\p{L})подмножеств\p{L}*/giu, tip: 'Любой набор из данных элементов: можно пустой, можно все.' },
	{ pattern: /(?<!\p{L})скользящ\p{L}*\s+окн\p{L}*/giu, tip: 'Отрезок соседних элементов. Оба его конца идут только вправо.' },
	{ pattern: /(?<!\p{L})ASCII(?!\p{L})/gu, tip: 'Таблица из 128 символов: латинские буквы, цифры, пробел и знаки препинания.' },
	{ pattern: /(?<!\p{L})регистр(?:а|е|у|ом|ы|ов|ам|ами|ах)?(?!\p{L})/giu, tip: 'Какая буква: заглавная (A) или строчная (a).' },
	{ pattern: /(?<!\p{L})слияни\p{L}*/giu, tip: 'Из нескольких отсортированных списков собрать один отсортированный.' },
	{ pattern: /(?<!\d)32-битн\p{L}*/giu, tip: 'Целое число, под которое отводят 32 бита памяти. Самое большое такое число 2 147 483 647.' },
	{ pattern: /(?<!\p{L})переполн\p{L}*/giu, tip: 'Число не помещается в отведённую ему память, и его значение портится.' },
	{ pattern: /(?<!\p{L})линейн\p{L}*\s+врем\p{L}*/giu, tip: 'Время растёт так же, как n: вдвое больше n, вдвое больше шагов.' },
];

export type Part = string | { term: string; index: number };

// Splits the text at the first match of each glossary entry. The entries in seen stay plain. The function adds each entry that it marks to seen, so the texts of one page can share it.
export function splitTerms(text: string, seen = new Set<number>()): Part[] {
	const found: { from: number; to: number; index: number }[] = [];
	glossary.forEach(({ pattern }, index) => {
		const match = seen.has(index) ? undefined : [...text.matchAll(pattern)].find(m => !found.some(f => f.from < m.index + m[0].length && m.index < f.to));
		if (match) { found.push({ from: match.index, to: match.index + match[0].length, index }); seen.add(index); }
	});
	const parts: Part[] = [];
	let at = 0;
	for (const { from, to, index } of found.sort((a, b) => a.from - b.from)) { parts.push(text.slice(at, from), { term: text.slice(from, to), index }); at = to; }
	return [...parts, text.slice(at)].filter(part => part !== '');
}
