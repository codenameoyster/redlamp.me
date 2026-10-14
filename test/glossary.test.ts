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
	{ name: 'each word has its own first match', texts: ['Кортеж в куче, кортеж в деке.'], expected: ['[Кортеж] в [куче], кортеж в [деке].'] },
	{ name: 'word marked in an earlier text stays plain', texts: ['Кортеж в куче.', 'Кортеж и дек.'], expected: ['[Кортеж] в [куче].', 'Кортеж и [дек].'] },
	{ name: 'word that only overlaps an earlier word stays free for a later text', texts: ['Время O(log n).', 'Память O(1).'], expected: ['Время O([log] n).', 'Память [O(1)].'] },
	{ name: 'capital at the sentence start', texts: ['Кортежи сравниваются по первому элементу.'], expected: ['[Кортежи] сравниваются по первому элементу.'] },
	{ name: 'стекло is not стек', texts: ['Стекло и стек.'], expected: ['Стекло и [стек].'] },
	{ name: 'декабрь is not дек', texts: ['В декабре дек пуст.'], expected: ['В декабре [дек] пуст.'] },
	{ name: 'декартов is not дек', texts: ['Декартово произведение.'], expected: ['Декартово произведение.'] },
	{ name: 'кучка is not куча', texts: ['Кучка камней.'], expected: ['Кучка камней.'] },
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
