import type { Chapter } from '../../../../shared/leetcode';

export default {
	title: 'Перебор: подмножества, перестановки, сочетания',
	summary: 'Один шаблон на Python выписывает все варианты: выбрать, пойти глубже, отменить. Индекс start даёт наборы без порядка, список used даёт перестановки.',
	tasks: [
		{ url: 'https://leetcode.com/problems/letter-case-permutation/', number: 784, title: 'Letter Case Permutation', difficulty: 'medium', topics: ['Строка', 'Перебор'], note: 'LeetCode, medium. Каждая буква это уровень дерева с двумя ветками: строчная или заглавная. Цифра даёт одну ветку.' },
		{ url: 'https://leetcode.com/problems/subsets/', number: 78, title: 'Subsets', difficulty: 'medium', topics: ['Массив', 'Перебор'], note: 'LeetCode, medium. Шаблон с индексом start. Сохраняйте копию path[:] при каждом вызове, ответов будет 2 в степени n.' },
		{ url: 'https://leetcode.com/problems/permutations/', number: 46, title: 'Permutations', difficulty: 'medium', topics: ['Массив', 'Перебор'], note: 'LeetCode, medium. Цикл с нуля и список used. Отмена из двух строк: path.pop() и used[i] = False. Ответов n!.' },
		{ url: 'https://leetcode.com/problems/combinations/', number: 77, title: 'Combinations', difficulty: 'medium', topics: ['Перебор'], note: 'LeetCode, medium. Шаблон подмножеств, но сохраняйте только пути длины k. Ответов C(n, k).' },
		{ url: 'https://leetcode.com/problems/letter-combinations-of-a-phone-number/', number: 17, title: 'Letter Combinations of a Phone Number', difficulty: 'medium', topics: ['Строка', 'Перебор'], note: 'LeetCode, medium. Одна цифра это один уровень дерева. Пустая строка даёт пустой список.' },
	],
	cards: [
		{ id: 'pc2-template', type: 'flip', prompt: 'Назовите три шага шаблона внутри цикла.', back: 'Выбрать: path.append(x). Пойти глубже: dfs(...). Отменить: path.pop().', explain: 'Без отмены path хранит старый выбор, и следующая ветка начинается с неверного состояния.' },
		{ id: 'pc2-undo', type: 'code', language: 'python', prompt: 'Дополните шаг отмены.', code: 'for i in range(len(nums)):\n    if used[i]:\n        continue\n    used[i] = True\n    path.append(nums[i])\n    dfs(path)\n    path.pop()\n    ___', options: ['used[i] = False', 'used[i] = True', 'path.clear()'], answer: 0, explain: 'Отмена возвращает used в состояние до выбора, и следующий шаг цикла снова может взять nums[i].' },
		{ id: 'pc2-start', type: 'code', language: 'python', prompt: 'Дополните цикл так, чтобы каждый набор появился один раз.', code: 'def dfs(start, path):\n    res.append(path[:])\n    ___\n        path.append(nums[i])\n        dfs(i + 1, path)\n        path.pop()', options: ['for i in range(len(nums)):', 'for i in range(start, len(nums)):', 'for i in range(start):'], answer: 1, explain: 'Цикл от start смотрит только вперёд, поэтому [1, 2] появится, а [2, 1] нет.' },
		{ id: 'pc2-copy', type: 'choice', prompt: 'Почему шаблон сохраняет path[:], а не path?', options: ['path[:] работает быстрее', 'path меняется дальше, поэтому нужна копия', 'path[:] убирает повторы'], answer: 1, explain: 'Без копии все строки ответа указывают на один список. В конце он пустой.' },
		{ id: 'pc2-used', type: 'choice', prompt: 'В Permutations (LeetCode 46) что запрещает used[i]?', options: ['Одно и то же значение дважды в пути', 'Один и тот же индекс дважды в пути', 'Путь длиннее n'], answer: 1, explain: 'used помечает индекс. Два равных числа с разными индексами разрешены, поэтому для повторов нужно отдельное правило.' },
		{ id: 'pc2-perm-count', type: 'short', prompt: 'Permutations (LeetCode 46), nums = [1, 2, 3, 4]. Сколько ответов?', answer: '24', explain: '4! = 4 · 3 · 2 · 1 = 24 порядка.' },
		{ id: 'pc2-save-where', type: 'choice', prompt: 'В Subsets (LeetCode 78) где шаблон сохраняет ответ?', options: ['Только в листьях', 'В каждой точке дерева', 'Только когда path пустой'], answer: 1, explain: 'Каждый путь это подмножество, поэтому сохраняем при каждом вызове, включая пустой путь.' },
		{ id: 'pc2-phone', type: 'short', prompt: 'Letter Combinations (LeetCode 17), digits = "23". Сколько строк в ответе?', answer: '9', explain: 'На кнопке 2 три буквы, на кнопке 3 три буквы: 3 · 3 = 9.' },
	],
} satisfies Chapter;
