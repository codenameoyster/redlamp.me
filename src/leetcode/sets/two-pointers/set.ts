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
	slug: 'two-pointers',
	title: 'Two Pointers',
	summary: 'Two Pointers сокращает число проверок в Array. Вы учите три формы приёма, доказываете каждый ход и считаете время, дополнительную память и стоимость Sorting.',
	topics: ['Two Pointers', 'Array', 'Sorting'],
	chapters: [{ ...chapter1, lesson: lesson1 }, { ...chapter2, lesson: lesson2 }, { ...chapter3, lesson: lesson3 }, { ...chapter4, lesson: lesson4 }],
} satisfies LearningSetContent;
