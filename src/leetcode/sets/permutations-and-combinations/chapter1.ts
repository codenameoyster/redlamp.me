import type { Chapter } from '../../../../shared/leetcode';

export default {
	title: 'Считаем варианты',
	summary: 'Прежде чем писать перебор, посчитайте варианты. Правило произведения, правило суммы, факториал, выбор по порядку и без порядка, подмножества.',
	tasks: [
		{ url: 'https://codeforces.com/problemset/problem/1821/A', title: 'Matching', difficulty: 'easy', topics: ['Комбинаторика', 'Правило произведения'], note: 'Codeforces, рейтинг 800. Каждый знак ? даёт 10 вариантов, а первая цифра не может быть нулём. Перемножьте варианты по правилу произведения.' },
		{ url: 'https://codeforces.com/problemset/problem/1743/A', title: 'Password', difficulty: 'easy', topics: ['Комбинаторика', 'Сочетания'], note: 'Codeforces, рейтинг 800. Выберите 2 цифры из разрешённых без порядка: C(10 − n, 2), где n это число запрещённых цифр из ввода. Две пары одинаковых цифр стоят в 4 позициях 6 способами.' },
		{ url: 'https://codeforces.com/problemset/problem/629/A', title: "Far Relative's Birthday Cake", difficulty: 'easy', topics: ['Комбинаторика', 'Сочетания'], note: 'Codeforces, рейтинг 800. В ряду с k шоколадками пар k · (k − 1) / 2. Сложите это число по всем строкам и всем столбцам.' },
		{ url: 'https://codeforces.com/problemset/problem/1674/B', title: 'Dictionary', difficulty: 'easy', topics: ['Комбинаторика', 'Правило суммы'], note: 'Codeforces, рейтинг 800. На каждую первую букву приходится 25 слов. Сложите слова до нужной первой буквы, потом место внутри группы.' },
		{ url: 'https://leetcode.com/problems/number-of-good-pairs/', number: 1512, title: 'Number of Good Pairs', difficulty: 'easy', topics: ['Массив', 'Хеш-таблица', 'Сочетания'], note: 'LeetCode, easy. Посчитайте, сколько раз встречается каждое число. Если число встречается k раз, оно даёт k · (k − 1) / 2 пар.' },
	],
	cards: [
		{ id: 'pc1-product-rule', type: 'choice', prompt: 'У вас 3 футболки и 4 пары штанов. Сколько есть разных нарядов?', options: ['7', '12', '81'], answer: 1, explain: 'Футболка и штаны: правило произведения. 3 · 4 = 12.' },
		{ id: 'pc1-sum-rule', type: 'choice', prompt: 'До школы идут 3 автобуса и 2 трамвая. Вы едете или на автобусе, или на трамвае. Сколько есть способов?', options: ['5', '6', '9'], answer: 0, explain: 'Автобус или трамвай: правило суммы. 3 + 2 = 5.' },
		{ id: 'pc1-factorial', type: 'short', prompt: 'Сколько есть способов расставить 5 разных книг в ряд на полке?', answer: '120', explain: 'Перестановки 5 предметов: 5! = 5 · 4 · 3 · 2 · 1 = 120.' },
		{ id: 'pc1-medals', type: 'short', prompt: 'В забеге 8 бегунов. Сколько есть способов раздать золото, серебро и бронзу?', answer: '336', explain: 'Выбор 3 из 8 по порядку: 8 · 7 · 6 = 336.' },
		{ id: 'pc1-team', type: 'short', prompt: 'Сколько есть способов выбрать команду из 2 человек из 5 друзей?', answer: '10', explain: 'По порядку 5 · 4 = 20, каждая команда посчитана 2 раза. 20 / 2 = 10.' },
		{ id: 'pc1-symmetry', type: 'flip', prompt: 'C(10, 3) равно C(10, ?)', back: 'C(10, 7). Выбрать 3 предмета, которые берём, это то же самое, что выбрать 7, которые оставляем. Оба числа равны 120.', explain: 'Каждой тройке, которую берём, соответствует одна семёрка, которую оставляем. C(n, k) = C(n, n - k).' },
		{ id: 'pc1-subsets', type: 'short', prompt: 'Сколько подмножеств у набора из 4 предметов? Пустой набор тоже считается.', answer: '16', explain: 'Каждый предмет берём или нет: 2 варианта на предмет. 2 · 2 · 2 · 2 = 16.' },
		{ id: 'pc1-order-matters', type: 'choice', prompt: 'В каком вопросе порядок важен?', options: ['Выбрать 3 начинки для пиццы', 'Раздать золото, серебро и бронзу 8 бегунам', 'Выбрать 2 человек в команду'], answer: 1, explain: 'Медали разные, поэтому порядок трёх бегунов важен. У начинок и у команды порядка нет.' },
	],
	links: [
		{ title: 'Перестановки, сочетания и размещения: стартер-пак по комбинаторике для IT', url: 'https://skillbox.ru/media/code/perestanovki-sochetaniya-i-razmeshcheniya-starterpak-po-kombinatorike-dlya-it/', source: 'Skillbox Медиа' },
		{ title: 'Правило умножения', url: 'https://ru.wikipedia.org/wiki/Правило_умножения_(комбинаторика)', source: 'Википедия' },
		{ title: 'Сочетание', url: 'https://ru.wikipedia.org/wiki/Сочетание', source: 'Википедия' },
		{ title: 'Комбинаторика в Python', url: 'https://habr.com/ru/articles/479816/', source: 'Хабр' },
	],
} satisfies Chapter;
