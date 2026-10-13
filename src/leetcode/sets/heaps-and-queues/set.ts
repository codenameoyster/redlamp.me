import type { LearningSet } from '../../../../shared/leetcode';
import chapter1 from './chapter1';

export default {
	slug: 'heaps-and-queues',
	title: 'Куча и очереди',
	summary: 'Очередь, дек и куча отдают нужный элемент за O(1) или за O(log n). Вы моделируете процессы на collections.deque, находите максимум в окне монотонным деком и решаете на heapq задачи про k лучших, слияние списков и жадный выбор.',
	topics: ['Очередь', 'Дек', 'Куча', 'Скользящее окно'],
	chapters: [chapter1],
} satisfies LearningSet;
