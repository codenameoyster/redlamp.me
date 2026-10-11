import type { LearningSet } from '../../../../shared/leetcode';
import chapter1 from './chapter1';
import chapter2 from './chapter2';
import chapter3 from './chapter3';
import chapter4 from './chapter4';

export default {
	slug: 'permutations-and-combinations',
	title: 'Перестановки и сочетания',
	summary: 'Вы учитесь считать варианты: перестановки, сочетания и подмножества. Потом один шаблон перебора выписывает их, убирает повторы и останавливает лишние ветки.',
	topics: ['Комбинаторика', 'Рекурсия', 'Перебор'],
	chapters: [chapter1, chapter2, chapter3, chapter4],
} satisfies LearningSet;
