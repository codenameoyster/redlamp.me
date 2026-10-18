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
	slug: 'heaps-and-queues',
	title: 'Heap, queue и deque',
	summary: 'Queue, deque и heap отдают нужный элемент за O(1) или за O(log n). Вы моделируете процессы на collections.deque, находите максимум в окне через monotonic deque и решаете на heapq задачи про k лучших, слияние списков и жадный выбор.',
	topics: ['Queue', 'Deque', 'Heap', 'Скользящее окно'],
	chapters: [{ ...chapter1, lesson: lesson1 }, { ...chapter2, lesson: lesson2 }, { ...chapter3, lesson: lesson3 }, { ...chapter4, lesson: lesson4 }],
} satisfies LearningSetContent;
