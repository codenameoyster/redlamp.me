import { expect, it } from 'vitest';
import type { TestSpec } from '../shared/leetcode';
import { parsePy, reprPy, same } from '../shared/answers';

// The values are the results of Python ast.literal_eval and repr.
it.each([
	{ name: 'arguments with a nested list', text: '[[2, 7, 11, 15], 9]', value: [[2, 7, 11, 15], 9] },
	{ name: 'negative numbers', text: '[-1, -100, 0]', value: [-1, -100, 0] },
	{ name: 'floats', text: '[1.5, -0.25, .5, 2e3]', value: [1.5, -0.25, 0.5, 2000] },
	{ name: 'True, False and None', text: '[True, False, None]', value: [true, false, null] },
	{ name: 'double quote in single quotes', text: `['a"b']`, value: ['a"b'] },
	{ name: 'escaped quotes', text: `["a\\"b", 'c\\'d']`, value: ['a"b', "c'd"] },
	{ name: 'escaped backslash, line break and tab', text: `'a\\\\b\\nc\\td'`, value: 'a\\b\nc\td' },
	{ name: 'Cyrillic string', text: '"привет"', value: 'привет' },
	{ name: 'tuples as lists', text: '((1, 2), (3,), ())', value: [[1, 2], [3], []] },
	{ name: 'parentheses without a comma', text: '(5)', value: 5 },
	{ name: 'empty containers', text: '[[], {}, ""]', value: [[], {}, ''] },
	{ name: 'dict with string keys', text: `{'a': [1], "b": None}`, value: { a: [1], b: null } },
	{ name: 'trailing commas and line breaks', text: '[\n  [1, 2,],\n  3,\n]\n', value: [[1, 2], 3] },
])('parses $name', ({ text, value }) => {
	expect(parsePy(text)).toEqual(value);
});

it.each([
	{ name: 'empty text', text: ' ' },
	{ name: 'unclosed list', text: '[1, 2' },
	{ name: 'two commas', text: '[1,, 2]' },
	{ name: 'text after the value', text: '[1] 2' },
	{ name: 'JSON literal', text: '[true]' },
	{ name: 'dict with a number key', text: '{1: 2}' },
	{ name: 'set', text: '{1, 2}' },
	{ name: 'unclosed string', text: "'abc" },
	{ name: 'unsupported escape', text: "'\\x41'" },
	{ name: 'expression', text: '1 + 2' },
])('does not parse $name', ({ text }) => {
	expect(() => parsePy(text)).toThrow(SyntaxError);
});

it.each([
	{ name: 'nested list', value: [[1, 2], [3]], text: '[[1, 2], [3]]' },
	{ name: 'negative number', value: -5, text: '-5' },
	{ name: 'float', value: 0.5, text: '0.5' },
	{ name: 'True, False and None', value: [true, false, null], text: '[True, False, None]' },
	{ name: 'string', value: 'abc', text: "'abc'" },
	{ name: 'string with a single quote', value: "it's", text: `"it's"` },
	{ name: 'string with both quotes', value: `it's "x"`, text: `'it\\'s "x"'` },
	{ name: 'string with a backslash and a line break', value: 'a\\b\nc', text: "'a\\\\b\\nc'" },
	{ name: 'string with a tab and a control character', value: '\t\x01', text: "'\\t\\x01'" },
	{ name: 'Cyrillic string', value: 'да', text: "'да'" },
	{ name: 'empty containers', value: [[], {}, ''], text: "[[], {}, '']" },
	{ name: 'dict', value: { a: 1, b: [true] }, text: "{'a': 1, 'b': [True]}" },
])('prints $name', ({ value, text }) => {
	expect(reprPy(value)).toBe(text);
});

it('does not print a value without a Python literal', () => {
	expect(() => reprPy(undefined)).toThrow(TypeError);
});

const comparisons: { name: string; spec: TestSpec; expected: string; output: string; equal: boolean }[] = [
	{ name: 'same list in another format', spec: { mode: 'call', method: 'solve' }, expected: '[1, 2]', output: '[1,2]', equal: true },
	{ name: 'exact order with another order', spec: { mode: 'call', method: 'solve' }, expected: '[1, 2]', output: '[2, 1]', equal: false },
	{ name: 'tuple for a list', spec: { mode: 'call', method: 'solve' }, expected: '[1, 2]', output: '(1, 2)', equal: true },
	{ name: 'float with a zero fraction for an int', spec: { mode: 'call', method: 'solve' }, expected: '2', output: '2.0', equal: true },
	{ name: 'string for a boolean', spec: { mode: 'call', method: 'solve' }, expected: 'True', output: "'True'", equal: false },
	{ name: 'number for a boolean', spec: { mode: 'call', method: 'solve' }, expected: 'True', output: '1', equal: false },
	{ name: 'number for a boolean in a dictionary', spec: { mode: 'call', method: 'solve' }, expected: "{'a': True}", output: "{'a': 1}", equal: false },
	{ name: 'any order with another outer order', spec: { mode: 'call', method: 'solve', order: 'any' }, expected: '[[1, 2], [3]]', output: '[[3], [1, 2]]', equal: true },
	{ name: 'any order with another inner order', spec: { mode: 'call', method: 'solve', order: 'any' }, expected: '[[1, 2], [3]]', output: '[[3], [2, 1]]', equal: false },
	{ name: 'any order with other duplicates', spec: { mode: 'call', method: 'solve', order: 'any' }, expected: '[1, 1, 2]', output: '[1, 2, 2]', equal: false },
	{ name: 'any order with None', spec: { mode: 'call', method: 'solve', order: 'any' }, expected: '[1]', output: 'None', equal: false },
	{ name: 'any order with mixed output types', spec: { mode: 'call', method: 'solve', order: 'any' }, expected: '[0, 1]', output: '[0, None]', equal: false },
	{ name: 'any order with a set', spec: { mode: 'call', method: 'solve', order: 'any' }, expected: '[1, 2]', output: '{1, 2}', equal: false },
	{ name: 'any-nested order with other inner and outer orders', spec: { mode: 'call', method: 'solve', order: 'any-nested' }, expected: '[[1, 2], [3]]', output: '[[3], [2, 1]]', equal: true },
	{ name: 'any-nested order with a missing list', spec: { mode: 'call', method: 'solve', order: 'any-nested' }, expected: '[[1, 2], [3]]', output: '[[1, 2]]', equal: false },
	{ name: 'output that is not a Python literal', spec: { mode: 'call', method: 'solve' }, expected: '[1]', output: '<object at 0x1>', equal: false },
	{ name: 'stdio with other white space', spec: { mode: 'stdio' }, expected: '1 2\n3\n', output: '1  2 3', equal: true },
	{ name: 'stdio with joined tokens', spec: { mode: 'stdio' }, expected: '1 2\n', output: '12\n', equal: false },
];
it.each(comparisons)('compares $name', ({ spec, expected, output, equal }) => {
	expect(same(spec, expected, output)).toBe(equal);
});
