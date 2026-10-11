import type { LearningSet } from '../../../../shared/leetcode';
import chapter1 from './chapter1';
import chapter2 from './chapter2';
import chapter3 from './chapter3';
import chapter4 from './chapter4';

export default {
	slug: 'two-pointers',
	title: 'Два указателя',
	summary: 'Два указателя проходят массив один раз вместо перебора всех пар. Вы учите три формы приёма, инвариант каждой формы и два закона, общие для всех форм.',
	topics: ['Два указателя', 'Массив', 'Сортировка'],
	chapters: [chapter1, chapter2, chapter3, chapter4],
} satisfies LearningSet;
