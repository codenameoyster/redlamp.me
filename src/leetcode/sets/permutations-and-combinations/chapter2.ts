import type { Chapter } from '../../../../shared/leetcode';

export default {
	title: 'The backtracking template',
	summary: 'A backtracking search builds an answer one decision at a time.',
	tasks: [
		{ url: 'https://leetcode.com/problems/permutations/', number: 46, title: 'Permutations', difficulty: 'medium', topics: ['Array', 'Backtracking'], note: 'Use a used[] array to mark the items on the path. Expect n! results and undo each choice after the recursive call.' },
		{ url: 'https://leetcode.com/problems/combinations/', number: 77, title: 'Combinations', difficulty: 'medium', topics: ['Backtracking'], note: 'Use a start index so that each group appears only once, in increasing order. Expect C(n, k) results and stop the loop when too few numbers remain.' },
		{ url: 'https://leetcode.com/problems/subsets/', number: 78, title: 'Subsets', difficulty: 'medium', topics: ['Array', 'Backtracking', 'Bit Manipulation'], note: 'Save the path at every node of the tree, not only at the leaves. Expect 2^n results and save a copy with path[:].' },
		{ url: 'https://leetcode.com/problems/combination-sum/', number: 39, title: 'Combination Sum', difficulty: 'medium', topics: ['Array', 'Backtracking'], note: 'You can use a number again, so the recursive call keeps index i. Sort the input and use break when the value is larger than the remaining sum.' },
	],
	cards: [
		{ id: 'pc-template', type: 'flip', prompt: 'What are the three steps of the backtracking template inside the loop?', back: 'Choose: path.append(x). Explore: dfs(...). Undo: path.pop().', explain: 'Without the undo step, the path keeps the old choice and the next branch starts from a wrong state.' },
		{ id: 'pc-undo', type: 'code', language: 'python', prompt: 'Complete the undo step.', code: 'for i in range(len(nums)):\n    if used[i]:\n        continue\n    used[i] = True\n    path.append(nums[i])\n    dfs(path)\n    path.pop()\n    ___', options: ['used[i] = False', 'used[i] = True', 'path.clear()'], answer: 0, explain: 'The undo step returns the state to what it was before the choice, so the next loop step can use nums[i] again.' },
		{ id: 'pc-start-index', type: 'code', language: 'python', prompt: 'Complete the loop so that each combination appears one time.', code: 'def dfs(start, path):\n    res.append(path[:])\n    ___\n        path.append(nums[i])\n        dfs(i + 1, path)\n        path.pop()', options: ['for i in range(len(nums)):', 'for i in range(start, len(nums)):', 'for i in range(start):'], answer: 1, explain: 'The start index only looks forward, so [1, 2] appears but [2, 1] does not.' },
		{ id: 'pc-copy', type: 'choice', prompt: 'Why does the template save path[:] and not path?', options: ['path[:] is faster', 'path changes later, so the result needs a copy', 'path[:] removes duplicates'], answer: 1, explain: 'res keeps a reference. Without a copy, every saved result points to the same list, which is empty at the end.' },
		{ id: 'pc-used-array', type: 'choice', prompt: 'In Permutations (LeetCode 46), what does used[i] prevent?', options: ['The same value twice in one path', 'The same index twice in one path', 'Paths longer than n'], answer: 1, explain: 'used marks the index. Two equal values at different indexes are both allowed, which is why Permutations II needs an extra rule.' },
		{ id: 'pc-perm-count', type: 'short', prompt: 'Permutations (LeetCode 46) with nums = [1, 2, 3, 4]. How many results?', answer: '24', explain: '4! = 24 orders.' },
		{ id: 'pc-subsets-tree', type: 'choice', prompt: 'In Subsets (LeetCode 78), where does the template save a result?', options: ['Only at the leaves', 'At every node of the tree', 'Only when the path is empty'], answer: 1, explain: 'Every path is a subset, so the template saves at every call, including the empty path.' },
		{ id: 'pc-reuse', type: 'choice', prompt: 'In Combination Sum (LeetCode 39) a number can be used again. What does the recursive call pass as the next start?', options: ['i', 'i + 1', '0'], answer: 0, explain: 'i allows the same index again. i + 1 would use each number at most one time.' },
	],
} satisfies Chapter;
