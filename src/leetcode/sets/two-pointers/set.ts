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
	title: 'Два указателя',
	summary: 'Два указателя проходят массив один раз вместо перебора всех пар. Вы учите три формы приёма, инвариант каждой формы и два закона, общие для всех форм.',
	topics: ['Два указателя', 'Массив', 'Сортировка'],
	chapters: [{ ...chapter1, lesson: lesson1 }, { ...chapter2, lesson: lesson2 }, { ...chapter3, lesson: lesson3 }, { ...chapter4, lesson: lesson4 }],
} satisfies LearningSetContent;
