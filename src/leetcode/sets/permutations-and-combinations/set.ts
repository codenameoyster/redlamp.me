import type { LearningSetContent } from '..';
import chapter1 from './chapter1';
import chapter2 from './chapter2';
import chapter3 from './chapter3';
import chapter4 from './chapter4';
import lesson1 from './chapter1.html';
import lesson2 from './chapter2.html';
import lesson3 from './chapter3.html';
import lesson4 from './chapter4.html';

export default {
	slug: 'permutations-and-combinations',
	title: 'Permutations и Combinations',
	summary: 'Вы учитесь считать варианты: Permutations, Combinations и Subsets. Затем Backtracking строит ответы, убирает повторы и применяет Pruning. Считаем операции, рабочую память и размер ответа.',
	topics: ['Combinatorics', 'Recursion', 'Backtracking'],
	chapters: [{ ...chapter1, lesson: lesson1 }, { ...chapter2, lesson: lesson2 }, { ...chapter3, lesson: lesson3 }, { ...chapter4, lesson: lesson4 }],
} satisfies LearningSetContent;
