import { useEffect, useRef } from 'react';
import { acceptCompletion, autocompletion, closeCompletion, completeFromList, ifNotIn, selectedCompletion, type CompletionContext, type CompletionSource } from '@codemirror/autocomplete';
import { Compartment, countColumn, EditorSelection, EditorState, Prec, Transaction } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentLess, indentMore, temporarilySetTabFocusMode } from '@codemirror/commands';
import { getIndentUnit, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { localCompletionSource, python } from '@codemirror/lang-python';
import { classHighlighter } from '@lezer/highlight';
import { highlight } from './highlight';
import { completeCode, pythonWords } from './python';

// highlight.js escapes the code and emits only span elements, so its output is safe to insert as HTML.
export function Code({ language, text, blank }: { language: string; text: string; blank?: boolean }) {
	const value = highlight(language, text).html;
	return <pre><code dangerouslySetInnerHTML={{ __html: blank ? value.replaceAll('___', '<mark>___</mark>') : value }} /></pre>;
}

const hint = 'code-hint', lock = new Compartment(), past = new Compartment();

const name = /[\w\xa1-\uffff]*/, member = /\.[\w\xa1-\uffff]*/, prose = ['String', 'FormatString', 'Comment'];
// A source with no result runs again after each letter, and the open list is disabled until it answers. So a source keeps an empty result while the student types a name for the other sources.
const empty = (context: CompletionContext) => ({ from: context.matchBefore(name)!.from, options: [], validFor: name });
const localSource: CompletionSource = context => context.matchBefore(member) ? empty(context) : localCompletionSource(context);
// The keywords, the built-in names and the names of the prelude come from Python once.
let words: Promise<CompletionSource> | null = null;
const wordSource: CompletionSource = context => context.matchBefore(member) ? empty(context) : (words ??= pythonWords().then(completeFromList)).then(source => source(context), () => { words = null; return null; });
// jedi completes at the start of the name, so the list keeps all members while the student types the name. jedi counts the column in code points.
const memberSource: CompletionSource = async context => {
	if (!context.matchBefore(member)) return empty(context);
	const from = context.matchBefore(name)!.from, line = context.state.doc.lineAt(from);
	const names = await completeCode(context.state.doc.toString(), line.number, [...line.text.slice(0, from - line.from)].length).catch(() => null);
	return names && { from, options: names.map(label => ({ label })), validFor: name };
};
const completion = [
	// This keymap comes before the keymap of autocompletion(). Enter after a name typed in full closes the list, so the Enter of the editor adds a new line. Escape closes the list and goes on to the Escape binding of the editor, so Escape and then Tab moves the focus out also while a list shows or loads.
	Prec.highest(keymap.of([
		{ key: 'Tab', run: acceptCompletion },
		{ key: 'Enter', run: view => { const head = view.state.selection.main.head, word = view.state.wordAt(head); if (word && view.state.sliceDoc(word.from, head) === selectedCompletion(view.state)?.label) closeCompletion(view); return false; } },
		{ key: 'Escape', run: view => { closeCompletion(view); return false; } },
	])),
	autocompletion({ override: [localSource, ifNotIn(prose, wordSource), ifNotIn(prose, memberSource)] }),
	EditorState.phrases.of({ Completions: 'Подсказки' }),
];

// Tab over several lines indents them. Otherwise Tab replaces each selection with spaces up to the next stop of the indent unit.
const tab = ({ state, dispatch }: EditorView) => {
	if (state.readOnly) return false;
	if (state.selection.ranges.some(({ from, to }) => state.doc.lineAt(from).number !== state.doc.lineAt(to).number)) return indentMore({ state, dispatch });
	const unit = getIndentUnit(state);
	dispatch(state.update(state.changeByRange(({ from, to }) => {
		const insert = ' '.repeat(unit - countColumn(state.sliceDoc(state.doc.lineAt(from).from, from), state.tabSize) % unit);
		return { changes: { from, to, insert }, range: EditorSelection.cursor(from + insert.length) };
	}), { scrollIntoView: true, userEvent: 'input' }));
	return true;
};

// A read-only field keeps a Tab stop, and the commands of a read-only state do not catch Tab. A locked field is out of the Tab order, as a disabled control. The hint stays while the field is locked.
const access = (readOnly: boolean, locked: boolean) => [EditorState.readOnly.of(readOnly || locked), EditorView.editable.of(!readOnly && !locked), EditorView.contentAttributes.of(readOnly ? { tabindex: '0' } : { 'aria-describedby': hint }), readOnly || locked ? [] : completion];

// Python 3.14 raises TabError for a tab under a block with 4 spaces, so Tab inserts spaces up to the next stop of 4 columns and Shift+Tab removes 4 spaces. Escape and then Tab moves the focus out: https://codemirror.net/examples/tab/
export function CodeField({ value, readOnly, locked = false, onChange }: { value: string; readOnly: boolean; locked?: boolean; onChange: (value: string) => void }) {
	const parent = useRef<HTMLDivElement>(null), view = useRef<EditorView>(null), change = useRef(onChange);
	change.current = onChange;
	useEffect(() => {
		const editor = new EditorView({ parent: parent.current!, state: EditorState.create({ doc: value, extensions: [
			lineNumbers(), past.of(history()), EditorView.lineWrapping, indentUnit.of('    '), python(), syntaxHighlighting(classHighlighter),
			// The Escape binding of defaultKeymap collapses a selection and stops the built-in Escape handler, so Escape sets the Tab focus mode first.
			keymap.of([{ key: 'Escape', run: temporarilySetTabFocusMode }, ...defaultKeymap, ...historyKeymap, { key: 'Tab', run: tab, shift: indentLess }]),
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
	return <><div ref={parent} className="code-field" />{!readOnly && <small id={hint}>Tab или Enter при открытом списке: вставить выбранное имя. Tab: вставить пробелы. Tab при нескольких выделенных строках: сдвинуть их вправо. Shift+Tab: сдвинуть влево. Esc и сразу Tab: выйти из поля.</small>}</>;
}
