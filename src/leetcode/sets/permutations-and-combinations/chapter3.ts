import type { Chapter } from '../../../../shared/leetcode';

export default {
	title: 'Duplicates and pruning',
	summary: 'If the input has equal values, the search makes equal answers.',
	tasks: [
		{ url: 'https://leetcode.com/problems/subsets-ii/', number: 90, title: 'Subsets II', difficulty: 'medium', topics: ['Array', 'Backtracking', 'Bit Manipulation'], note: 'Sort the input, then skip a value that is equal to the previous value at the same tree level. Use i > start, not i > 0.' },
		{ url: 'https://leetcode.com/problems/permutations-ii/', number: 47, title: 'Permutations II', difficulty: 'medium', topics: ['Array', 'Backtracking', 'Sorting'], note: 'Sort the input and skip nums[i] when it is equal to nums[i - 1] and nums[i - 1] is not used. The input [1,1,2] must give 3 results: 3!/2!.' },
		{ url: 'https://leetcode.com/problems/combination-sum-ii/', number: 40, title: 'Combination Sum II', difficulty: 'medium', topics: ['Array', 'Backtracking'], note: 'Use each number one time when the input has duplicates. Combine the skip rule from Subsets II with the break rule from Combination Sum.' },
		{ url: 'https://leetcode.com/problems/combination-sum-iii/', number: 216, title: 'Combination Sum III', difficulty: 'medium', topics: ['Array', 'Backtracking'], note: 'Choose k different digits from 1 to 9 with the sum n. Stop a branch when the sum is too large or the path is full.' },
		{ url: 'https://leetcode.com/problems/generate-parentheses/', number: 22, title: 'Generate Parentheses', difficulty: 'medium', topics: ['String', 'Dynamic Programming', 'Backtracking', 'Bracket Sequences'], note: 'Add \'(\' when open < n and add \')\' when close < open. These two rules remove all bad branches, and the result count is a Catalan number.' },
	],
	cards: [
		{ id: 'pc-dup-skip', type: 'code', language: 'python', prompt: 'Complete the rule that skips duplicate values in Subsets II. The input is sorted.', code: 'for i in range(start, len(nums)):\n    ___\n        continue\n    path.append(nums[i])\n    dfs(i + 1, path)\n    path.pop()', options: ['if nums[i] == nums[i - 1]:', 'if i > start and nums[i] == nums[i - 1]:', 'if i > 0 and nums[i] == nums[i - 1]:'], answer: 1, explain: 'i > start allows the first copy at each tree level and skips the later copies. i > 0 would also skip the first copy on deeper levels.' },
		{ id: 'pc-sort-first', type: 'flip', prompt: 'Why do you sort the input before you skip duplicates?', back: 'Equal values become neighbors, so nums[i] == nums[i - 1] finds every duplicate.', explain: 'Without a sort, equal values can sit apart and the neighbor check misses them.' },
		{ id: 'pc-perm-ii-count', type: 'short', prompt: 'Permutations II with nums = [1, 1, 2]. How many different results?', answer: '3', explain: '3! / 2! = 3. The two 1s are equal, so a swap of them gives the same result.' },
		{ id: 'pc-prune', type: 'flip', prompt: 'In Combination Sum with sorted input, when can the loop stop with break?', back: 'When nums[i] > remaining. Every later value is larger, so no later branch can reach the target.', explain: 'The sort makes break safe. Without the sort you can only continue, not break.' },
		{ id: 'pc-catalan', type: 'short', prompt: 'Generate Parentheses with n = 3. How many valid strings?', answer: '5', explain: 'The count is the Catalan number C(3) = 5: ((())), (()()), (())(), ()(()), ()()().' },
		{ id: 'pc-paren-rule', type: 'choice', prompt: 'In Generate Parentheses, when can you add a closing bracket?', options: ['When close < n', 'When close < open', 'At any time'], answer: 1, explain: 'A closing bracket needs an open bracket before it. close < open keeps every prefix valid.' },
	],
} satisfies Chapter;
