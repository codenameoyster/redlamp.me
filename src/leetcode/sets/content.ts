import type { Chapter, LearningSet } from '../../../shared/leetcode';
import complexity from './complexity/set';
import permutationsAndCombinations from './permutations-and-combinations/set';
import twoPointers from './two-pointers/set';
import heapsAndQueues from './heaps-and-queues/set';

export type LearningSetContent = Omit<LearningSet, 'chapters'> & { chapters: (Chapter & { lesson: string })[] };
export const sets: LearningSetContent[] = [complexity, permutationsAndCombinations, twoPointers, heapsAndQueues];
