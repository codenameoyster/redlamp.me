import type { Chapter } from '../../../../shared/leetcode';

export default {
	title: 'Counting rules',
	summary: 'Before you write a search, count the answers.',
	tasks: [
		{ url: 'https://leetcode.com/problems/sum-of-all-subset-xor-totals/', number: 1863, title: 'Sum of All Subset XOR Totals', difficulty: 'easy', topics: ['Array', 'Math', 'Backtracking', 'Bit Manipulation', 'Combinatorics', 'Enumeration'], note: 'Visit all 2^n subsets and add the XOR of each subset. Make a take or skip choice for each item.' },
		{ url: 'https://leetcode.com/problems/letter-case-permutation/', number: 784, title: 'Letter Case Permutation', difficulty: 'medium', topics: ['String', 'Backtracking', 'Bit Manipulation'], note: 'Each letter gives two choices: lower case or upper case. Count the results before you write code: a string with k letters gives 2^k results.' },
		{ url: 'https://leetcode.com/problems/letter-combinations-of-a-phone-number/', number: 17, title: 'Letter Combinations of a Phone Number', difficulty: 'medium', topics: ['Hash Table', 'String', 'Backtracking'], note: 'Each digit is one level of the tree, and each letter is one branch. The result count is the product of the letter counts (product rule).' },
	],
	cards: [
		{ id: 'pc-product-rule', type: 'choice', prompt: 'You choose one shirt from 3 and one pair of trousers from 4. How many outfits are there?', options: ['7', '12', '81'], answer: 1, explain: 'The product rule: independent choices multiply. 3 x 4 = 12.' },
		{ id: 'pc-sum-rule', type: 'choice', prompt: 'You take one bus from 3 routes or one tram from 2 routes. How many ways can you travel?', options: ['5', '6', '9'], answer: 0, explain: 'The sum rule: choices that exclude each other add. 3 + 2 = 5.' },
		{ id: 'pc-factorial', type: 'short', prompt: 'How many ways can you order 5 different books on a shelf?', answer: '120', explain: 'An order of n different items is a permutation: 5! = 5 x 4 x 3 x 2 x 1 = 120.' },
		{ id: 'pc-perm-k', type: 'short', prompt: 'How many 3-letter codes use different letters from A, B, C, D, E?', answer: '60', explain: 'P(5, 3) = 5 x 4 x 3 = 60. Order matters and no letter repeats.' },
		{ id: 'pc-choose', type: 'short', prompt: 'In how many ways can you pick 2 students from 5 for a team?', answer: '10', explain: 'C(5, 2) = 5! / (2! x 3!) = 10. The order inside the team does not matter.' },
		{ id: 'pc-symmetry', type: 'flip', prompt: 'C(10, 3) is equal to C(10, ?)', back: 'C(10, 7). To choose 3 items to take is the same as to choose 7 items to leave: C(n, k) = C(n, n - k).', explain: 'Each group of 3 that you take leaves a group of 7, so the two counts are equal.' },
		{ id: 'pc-subsets-count', type: 'short', prompt: 'How many subsets does a set with 4 items have? Count the empty set too.', answer: '16', explain: 'Each item is in or out: 2 choices per item, 2^4 = 16.' },
		{ id: 'pc-order-matters', type: 'choice', prompt: 'Which question needs permutations, not combinations?', options: ['Pick 3 toppings for a pizza', 'Pick a gold, a silver and a bronze winner from 8 runners', 'Pick 2 students for a team'], answer: 1, explain: 'The medals are different, so the order of the 3 runners matters. Toppings and team members have no order.' },
	],
} satisfies Chapter;
