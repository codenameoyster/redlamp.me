import { useEffect, useRef } from 'react';
import { Compartment, EditorState, Transaction } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab, temporarilySetTabFocusMode } from '@codemirror/commands';
import { indentUnit, syntaxHighlighting } from '@codemirror/language';
import { python } from '@codemirror/lang-python';
import { classHighlighter } from '@lezer/highlight';
import { highlight } from './highlight';

// highlight.js escapes the code and emits only span elements, so its output is safe to insert as HTML.
export function Code({ language, text, blank }: { language: string; text: string; blank?: boolean }) {
	const value = highlight(language, text).html;
	return <pre><code dangerouslySetInnerHTML={{ __html: blank ? value.replaceAll('___', '<mark>___</mark>') : value }} /></pre>;
}

const hint = 'code-hint', lock = new Compartment(), past = new Compartment();

// A read-only field keeps a Tab stop, and the commands of a read-only state do not catch Tab. A locked field is out of the Tab order, as a disabled control. The hint stays while the field is locked.
const access = (readOnly: boolean, locked: boolean) => [EditorState.readOnly.of(readOnly || locked), EditorView.editable.of(!readOnly && !locked), EditorView.contentAttributes.of(readOnly ? { tabindex: '0' } : { 'aria-describedby': hint })];

// Python 3.14 raises TabError for a tab under a block with 4 spaces, so Tab and Shift+Tab add and remove 4 spaces. Escape and then Tab moves the focus out: https://codemirror.net/examples/tab/
export function CodeField({ value, readOnly, locked = false, onChange }: { value: string; readOnly: boolean; locked?: boolean; onChange: (value: string) => void }) {
	const parent = useRef<HTMLDivElement>(null), view = useRef<EditorView>(null), change = useRef(onChange);
	change.current = onChange;
	useEffect(() => {
		const editor = new EditorView({ parent: parent.current!, state: EditorState.create({ doc: value, extensions: [
			lineNumbers(), past.of(history()), EditorView.lineWrapping, indentUnit.of('    '), python(), syntaxHighlighting(classHighlighter),
			// The Escape binding of defaultKeymap collapses a selection and stops the built-in Escape handler, so Escape sets the Tab focus mode first.
			keymap.of([{ key: 'Escape', run: temporarilySetTabFocusMode }, ...defaultKeymap, ...historyKeymap, indentWithTab]),
			EditorView.contentAttributes.of({ 'aria-label': 'Код решения' }),
			// The browser hides the nonce attribute, and the nonce property keeps the value: https://html.spec.whatwg.org/multipage/urls-and-fetching.html#nonce-attributes
			EditorView.cspNonce.of(document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]')!.nonce!),
			// A value from the props comes in as a remote change, so it does not go back to onChange: https://codemirror.net/docs/ref/#state.Transaction^remote
			EditorView.updateListener.of(update => { if (update.transactions.some(tr => tr.docChanged && !tr.annotation(Transaction.remote))) change.current(update.state.doc.toString()); }),
			lock.of(access(readOnly, locked)),
		] }) });
		view.current = editor;
		return () => editor.destroy();
	}, []);
	// A value from outside starts a new undo history, so Ctrl+Z does not undo it. A history field that a transaction adds also records the changes of that transaction, so the field comes back in a second transaction.
	useEffect(() => {
		const editor = view.current!;
		if (value === editor.state.doc.toString()) return;
		editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value }, effects: past.reconfigure([]), annotations: Transaction.remote.of(true) });
		editor.dispatch({ effects: past.reconfigure(history()) });
	}, [value]);
	useEffect(() => { view.current!.dispatch({ effects: lock.reconfigure(access(readOnly, locked)) }); }, [readOnly, locked]);
	return <><div ref={parent} className="code-field" />{!readOnly && <small id={hint}>Tab: сдвинуть строку на 4 пробела вправо. Shift+Tab: сдвинуть влево. Esc и сразу Tab: выйти из поля.</small>}</>;
}
