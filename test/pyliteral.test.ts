import { expect, it } from 'vitest';
import { parsePy, reprPy } from '../src/leetcode/pyliteral';

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
