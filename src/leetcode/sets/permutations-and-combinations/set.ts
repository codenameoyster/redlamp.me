import type { LearningSet } from '../../../../shared/leetcode';

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
	tasks: [
		{ slug: 'sum-of-all-subset-xor-totals', number: 1863, title: 'Sum of All Subset XOR Totals', difficulty: 'easy', topics: ['Array', 'Math', 'Backtracking', 'Bit Manipulation', 'Combinatorics', 'Enumeration'], stage: 'Warm-up', note: 'Visit all 2^n subsets and add the XOR of each subset. Make a take or skip choice for each item.' },
		{ slug: 'letter-case-permutation', number: 784, title: 'Letter Case Permutation', difficulty: 'medium', topics: ['String', 'Backtracking', 'Bit Manipulation'], stage: 'Warm-up', note: 'Each letter gives two choices: lower case or upper case. Count the results before you write code: a string with k letters gives 2^k results.' },
		{ slug: 'letter-combinations-of-a-phone-number', number: 17, title: 'Letter Combinations of a Phone Number', difficulty: 'medium', topics: ['Hash Table', 'String', 'Backtracking'], stage: 'Warm-up', note: 'Each digit is one level of the tree, and each letter is one branch. The result count is the product of the letter counts (product rule).' },
		{ slug: 'permutations', number: 46, title: 'Permutations', difficulty: 'medium', topics: ['Array', 'Backtracking'], stage: 'Core', note: 'Use a used[] array to mark the items on the path. Expect n! results and undo each choice after the recursive call.' },
		{ slug: 'combinations', number: 77, title: 'Combinations', difficulty: 'medium', topics: ['Backtracking'], stage: 'Core', note: 'Use a start index so that each group appears only once, in increasing order. Expect C(n, k) results and stop the loop when too few numbers remain.' },
		{ slug: 'subsets', number: 78, title: 'Subsets', difficulty: 'medium', topics: ['Array', 'Backtracking', 'Bit Manipulation'], stage: 'Core', note: 'Save the path at every node of the tree, not only at the leaves. Expect 2^n results and save a copy with path[:].' },
		{ slug: 'combination-sum', number: 39, title: 'Combination Sum', difficulty: 'medium', topics: ['Array', 'Backtracking'], stage: 'Core', note: 'You can use a number again, so the recursive call keeps index i. Sort the input and use break when the value is larger than the remaining sum.' },
		{ slug: 'subsets-ii', number: 90, title: 'Subsets II', difficulty: 'medium', topics: ['Array', 'Backtracking', 'Bit Manipulation'], stage: 'Duplicates and pruning', note: 'Sort the input, then skip a value that is equal to the previous value at the same tree level. Use i > start, not i > 0.' },
		{ slug: 'permutations-ii', number: 47, title: 'Permutations II', difficulty: 'medium', topics: ['Array', 'Backtracking', 'Sorting'], stage: 'Duplicates and pruning', note: 'Sort the input and skip nums[i] when it is equal to nums[i - 1] and nums[i - 1] is not used. The input [1,1,2] must give 3 results: 3!/2!.' },
		{ slug: 'combination-sum-ii', number: 40, title: 'Combination Sum II', difficulty: 'medium', topics: ['Array', 'Backtracking'], stage: 'Duplicates and pruning', note: 'Use each number one time when the input has duplicates. Combine the skip rule from Subsets II with the break rule from Combination Sum.' },
		{ slug: 'combination-sum-iii', number: 216, title: 'Combination Sum III', difficulty: 'medium', topics: ['Array', 'Backtracking'], stage: 'Duplicates and pruning', note: 'Choose k different digits from 1 to 9 with the sum n. Stop a branch when the sum is too large or the path is full.' },
		{ slug: 'generate-parentheses', number: 22, title: 'Generate Parentheses', difficulty: 'medium', topics: ['String', 'Dynamic Programming', 'Backtracking', 'Bracket Sequences'], stage: 'Duplicates and pruning', note: 'Add \'(\' when open < n and add \')\' when close < open. These two rules remove all bad branches, and the result count is a Catalan number.' },
		{ slug: 'next-permutation', number: 31, title: 'Next Permutation', difficulty: 'medium', topics: ['Array', 'Two Pointers'], stage: 'Order and counting', note: 'Find the next permutation in lexicographic order without a list of all permutations. Find the pivot from the right, swap it with the rightmost value that is larger than the pivot, then reverse the suffix.' },
		{ slug: 'unique-paths', number: 62, title: 'Unique Paths', difficulty: 'medium', topics: ['Math', 'Dynamic Programming', 'Combinatorics'], stage: 'Order and counting', note: 'Each path has m - 1 down moves and n - 1 right moves. Count the paths with C(m + n - 2, m - 1), then check the result with a dynamic programming (DP) table.' },
		{ slug: 'permutation-sequence', number: 60, title: 'Permutation Sequence', difficulty: 'hard', topics: ['Math', 'Recursion'], stage: 'Challenge', note: 'Find the k-th permutation without a list of all permutations. Each block of (n - 1)! permutations starts with the same digit, so (k - 1) // (n - 1)! gives the index of the first digit.' },
		{ slug: 'n-queens', number: 51, title: 'N-Queens', difficulty: 'hard', topics: ['Array', 'Backtracking', 'Algorithm X'], stage: 'Challenge', note: 'Put one queen in each row and keep sets for the columns and the two diagonals. Prune a branch when the cell is under attack.' },
	],
} satisfies LearningSet;
