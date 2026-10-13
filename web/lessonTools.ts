import type { RefObject } from 'react';

const skip = /[\s­​]/, low = (c: string) => c.toLowerCase()[0];

// Shows "Объяснить с ИИ" below a text selection in the root element. Ctrl+Enter or Cmd+Enter does the same. Returns the cleanup.
// The root element can change while the watch runs: the work window shows the lesson again for each new draft.
export function watchSelection(root: RefObject<HTMLElement | null>, explain: (text: string) => void): () => void {
	const button = Object.assign(document.createElement('button'), { type: 'button', className: 'primary lesson-ai', hidden: true, ariaKeyShortcuts: 'Control+Enter Meta+Enter', textContent: 'Объяснить с ИИ' });
	button.dataset.tip = 'Попросить ИИ объяснить выделенный текст (Ctrl+Enter).';
	document.body.append(button);
	let picked = '', pressing = false;
	const hide = () => { button.hidden = true; picked = ''; };
	const send = () => { if (picked) explain(picked); hide(); };
	// A tap on the button can clear the selection before the click.
	const press = (e: PointerEvent) => { pressing = e.target === button; };
	const key = (e: KeyboardEvent) => { if (picked && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } };
	const select = () => {
		const sel = getSelection(), text = sel?.rangeCount && root.current?.contains(sel.getRangeAt(0).commonAncestorContainer) ? sel.toString().replace(/\s+/g, ' ').trim() : '';
		if (!text || document.activeElement?.closest('input,textarea,select,[contenteditable]')) { if (!pressing) hide(); return; }
		picked = text.slice(0, 2000);
		const r = sel!.getRangeAt(0).getBoundingClientRect(), gap = matchMedia('(pointer: coarse)').matches ? 32 : 8;
		button.hidden = false;
		button.style.top = `${Math.max(8, Math.min(r.bottom + gap, innerHeight - button.offsetHeight - 8)) + scrollY}px`;
		button.style.left = `${Math.max(8, Math.min(r.left, innerWidth - button.offsetWidth - 8)) + scrollX}px`;
	};
	button.addEventListener('mousedown', e => e.preventDefault()); // Keep the selection visible.
	button.addEventListener('click', send);
	addEventListener('pointerdown', press, true);
	addEventListener('keydown', key);
	document.addEventListener('selectionchange', select);
	return () => { removeEventListener('pointerdown', press, true); removeEventListener('keydown', key); document.removeEventListener('selectionchange', select); button.remove(); };
}

// Marks the longest prefix of the quote that root shows, at least 16 characters or the full quote. Whitespace, soft hyphens, zero-width spaces and case do not count.
// The text of a figure or of a sample run does not count: React draws it, and a <mark> would break its next render.
export function highlightIn(root: HTMLElement, quote: string): boolean {
	for (const mark of root.querySelectorAll('mark')) mark.replaceWith(...mark.childNodes);
	const key = quote.split('').filter(c => !skip.test(c)).map(low).join(''), at: [Text, number][] = [], walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	let text = '';
	for (let n; (n = walker.nextNode() as Text | null);) {
		if (!n.parentElement!.checkVisibility() || n.parentElement!.closest('[data-figure],.sample')) continue;
		for (let i = 0; i < n.data.length; i++) if (!skip.test(n.data[i])) { text += low(n.data[i]); at.push([n, i]); }
	}
	let lo = Math.min(key.length, 16), hi = key.length, from = -1, size = 0;
	while (key && lo <= hi) { const mid = (lo + hi) >> 1, i = text.indexOf(key.slice(0, mid)); if (i < 0) hi = mid - 1; else { from = i; size = mid; lo = mid + 1; } }
	if (from < 0) return false;
	const runs = new Map<Text, [number, number]>();
	for (const [n, i] of at.slice(from, from + size)) { const run = runs.get(n); if (run) run[1] = i + 1; else runs.set(n, [i, i + 1]); }
	const marks = [...runs].map(([n, [a, b]]) => { const range = document.createRange(), mark = document.createElement('mark'); range.setStart(n, a); range.setEnd(n, b); range.surroundContents(mark); return mark; });
	marks[0].scrollIntoView({ block: 'center' });
	return true;
}
