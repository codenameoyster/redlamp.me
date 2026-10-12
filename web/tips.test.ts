/// <reference types="vite/client" />
import { expect, it } from 'vitest';

const sources = import.meta.glob<string>('./*.tsx', { query: '?raw', import: 'default', eager: true });

// The '>' of an arrow function or of a generic call such as api<T>() does not end the tag.
it.each(Object.entries(sources).map(([file, source]) => ({ name: file.replace('./', 'web/'), source })))('$name: every button has a tip', ({ name, source }) => {
	const missing = [...source.matchAll(/<(?:button|a)\b(?:=>|>\(|[^>])*>/g)].filter(([tag]) => (tag.startsWith('<button') || tag.includes('className="button')) && !tag.includes('data-tip=')).map(tag => `${name}:${source.slice(0, tag.index).split('\n').length}`);
	expect(missing).toEqual([]);
});
