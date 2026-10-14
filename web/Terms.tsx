import { glossary, splitTerms, type Part } from '../shared/glossary';

// A term shows its tip on hover, on keyboard focus and after a tap (.term in web/style.css). Screen readers get the tip as the description from TermTips.
// aria-describedby can point to a hidden element: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-describedby
const tipId = (index: number) => `term-tip-${index}`;

// Each text marks its own first uses, so a summary and the lesson below it both show the tip.
export function Terms({ text }: { text: string }) {
	return splitTerms(text).map((part, i) => typeof part === 'string' ? part : <dfn key={i} className="term" tabIndex={0} data-tip={glossary[part.index].tip} aria-describedby={tipId(part.index)}>{part.term}</dfn>);
}

export function TermTips() {
	return <div hidden>{glossary.map((entry, index) => <span key={index} id={tipId(index)}>{entry.tip}</span>)}</div>;
}

// Marks the first use of each glossary word in the lesson HTML. Code stays plain, and a focusable word is invalid inside a link or a summary.
// The pass runs before React draws the figures and the samples, so it sees only the lesson HTML.
export function markTerms(root: HTMLElement) {
	const seen = new Set<number>(), walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), texts: Text[] = [];
	for (let n; (n = walker.nextNode() as Text | null);) if (!n.parentElement!.closest('pre,code,a,summary')) texts.push(n);
	for (const text of texts) {
		const parts = splitTerms(text.data, seen);
		if (parts.some(part => typeof part !== 'string')) text.replaceWith(...parts.map(part => typeof part === 'string' ? part : dfn(part)));
	}
}

function dfn({ term, index }: Exclude<Part, string>) {
	const element = Object.assign(document.createElement('dfn'), { className: 'term', tabIndex: 0, textContent: term });
	element.dataset.tip = glossary[index].tip;
	element.setAttribute('aria-describedby', tipId(index));
	return element;
}
