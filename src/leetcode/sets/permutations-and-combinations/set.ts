import type { LearningSet } from '../../../../shared/leetcode';
import chapter1 from './chapter1';
import chapter2 from './chapter2';
import chapter3 from './chapter3';
import chapter4 from './chapter4';

export default {
	slug: 'permutations-and-combinations',
	title: 'Permutations and combinations',
	summary: 'This set teaches you how to count permutations, combinations and subsets. Then you use one backtracking template to list them, remove duplicates and stop bad branches early.',
	topics: ['Backtracking', 'Recursion', 'Combinatorics', 'Math'],
	links: [
		{ title: 'Recursion cheatsheet', url: 'https://www.techinterviewhandbook.org/algorithms/recursion/', source: 'Tech Interview Handbook' },
		{ title: 'Math cheatsheet', url: 'https://www.techinterviewhandbook.org/algorithms/math/', source: 'Tech Interview Handbook' },
		{ title: 'Backtracking overview', url: 'https://www.hellointerview.com/learn/code/backtracking/overview', source: 'Hello Interview' },
		{ title: 'Solution space trees', url: 'https://www.hellointerview.com/learn/code/backtracking/solution-space-trees', source: 'Hello Interview' },
		{ title: 'Subsets', url: 'https://www.hellointerview.com/learn/code/backtracking/subsets', source: 'Hello Interview' },
		{ title: 'Combination Sum', url: 'https://www.hellointerview.com/learn/code/backtracking/combination-sum', source: 'Hello Interview' },
	],
	chapters: [chapter1, chapter2, chapter3, chapter4],
} satisfies LearningSet;
