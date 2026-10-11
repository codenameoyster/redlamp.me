import type { Chapter } from '../../../../shared/leetcode';

export default {
	title: 'Order and counting',
	summary: 'Some tasks ask for one permutation, or only for a count.',
	tasks: [
		{ url: 'https://leetcode.com/problems/next-permutation/', number: 31, title: 'Next Permutation', difficulty: 'medium', topics: ['Array', 'Two Pointers'], note: 'Find the next permutation in lexicographic order without a list of all permutations. Find the pivot from the right, swap it with the rightmost value that is larger than the pivot, then reverse the suffix.' },
		{ url: 'https://leetcode.com/problems/unique-paths/', number: 62, title: 'Unique Paths', difficulty: 'medium', topics: ['Math', 'Dynamic Programming', 'Combinatorics'], note: 'Each path has m - 1 down moves and n - 1 right moves. Count the paths with C(m + n - 2, m - 1), then check the result with a dynamic programming (DP) table.' },
		{ url: 'https://leetcode.com/problems/permutation-sequence/', number: 60, title: 'Permutation Sequence', difficulty: 'hard', topics: ['Math', 'Recursion'], note: 'Find the k-th permutation without a list of all permutations. Each block of (n - 1)! permutations starts with the same digit, so (k - 1) // (n - 1)! gives the index of the first digit.' },
		{ url: 'https://leetcode.com/problems/n-queens/', number: 51, title: 'N-Queens', difficulty: 'hard', topics: ['Array', 'Backtracking', 'Algorithm X'], note: 'Put one queen in each row and keep sets for the columns and the two diagonals. Prune a branch when the cell is under attack.' },
	],
	cards: [
		{ id: 'pc-next-perm', type: 'flip', prompt: 'What are the three steps of Next Permutation?', back: '1. From the right, find the first i with nums[i] < nums[i + 1]. 2. Swap nums[i] with the rightmost value that is larger than it. 3. Reverse the suffix after i.', explain: 'If no such i exists, the array is the last permutation: reverse the whole array.' },
		{ id: 'pc-unique-paths', type: 'short', prompt: 'A grid has 3 rows and 3 columns. You move only right or down. How many paths go from the top left to the bottom right?', answer: '6', explain: 'Each path has 2 down moves and 2 right moves: C(4, 2) = 6.' },
		{ id: 'pc-kth-block', type: 'choice', prompt: 'Permutation Sequence with n = 4. How many permutations start with the same first digit?', options: ['4', '6', '24'], answer: 1, explain: 'The other 3 digits give (n - 1)! = 3! = 6 permutations per first digit. (k - 1) // 6 gives the index of the first digit.' },
		{ id: 'pc-queens', type: 'choice', prompt: 'N-Queens: which sets make the attack check O(1)?', options: ['Columns, diagonals r - c, anti-diagonals r + c', 'Rows and columns', 'A copy of the board per row'], answer: 0, explain: 'One queen per row comes from the recursion. The columns and the two diagonal sets cover every attack.' },
	],
} satisfies Chapter;
