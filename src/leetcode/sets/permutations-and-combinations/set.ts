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
	title: 'Перестановки и сочетания',
	summary: 'Вы учитесь считать варианты: перестановки, сочетания и подмножества. Потом один шаблон перебора выписывает их, убирает повторы и останавливает лишние ветки.',
	topics: ['Комбинаторика', 'Рекурсия', 'Перебор'],
	chapters: [{ ...chapter1, lesson: lesson1 }, { ...chapter2, lesson: lesson2 }, { ...chapter3, lesson: lesson3 }, { ...chapter4, lesson: lesson4 }],
} satisfies LearningSetContent;
