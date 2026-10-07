import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { LoaderCircle } from 'lucide-react';
import type { Page, Problem, ProblemDetails } from '../shared/leetcode';
import { api, message } from './api';
import { useResource } from './useResource';

export function ProblemForm({ problem, close, saved }: { problem?: Problem; close: () => void; saved: (problem: Problem) => void }) {
	const dialog = useRef<HTMLDialogElement>(null);
	const [error, setError] = useState(''), [busy, setBusy] = useState(false), [lookup, setLookup] = useState(''), looked = useRef('');
	useEffect(() => {
		const previous = document.activeElement, element = dialog.current;
		element?.showModal();
		return () => { element?.close(); if (previous instanceof HTMLElement) previous.focus(); };
	}, []);
	async function fill(input: HTMLInputElement) {
		const url = input.value.trim();
		looked.current = url; setLookup('loading');
		try {
			const details = await api<ProblemDetails>(`/problem-details?url=${encodeURIComponent(url)}`);
			if (looked.current !== url) return;
			const set = (name: string, value: string) => { (input.form!.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement).value = value; };
			set('title', details.title); set('number', details.number?.toString() ?? ''); set('difficulty', details.difficulty); set('topics', details.topics.join(', '));
			setLookup('');
		} catch (error) { if (looked.current === url) setLookup(message(error)); }
	}
	async function submit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault(); setBusy(true); setError('');
		const form = new FormData(event.currentTarget);
		const value = { url: form.get('url'), number: form.get('number') ? Number(form.get('number')) : null, title: form.get('title'), difficulty: form.get('difficulty'), topics: String(form.get('topics')).split(',').map(s => s.trim()).filter(Boolean), summary: form.get('summary'), ...(problem ? { version: problem.version } : {}) };
		try { saved(await api<Problem>(problem ? `/problems/${problem.id}` : '/problems', { method: problem ? 'PATCH' : 'POST', body: JSON.stringify(value) })); }
		catch (error) { setError(message(error)); setBusy(false); }
	}
	return <dialog ref={dialog} onCancel={close} aria-labelledby="problem-form-title"><form onSubmit={submit} className="stack">
		<h2 id="problem-form-title">{problem ? 'Edit problem' : 'Add a problem'}</h2>
		<label>LeetCode URL<input name="url" type="url" required maxLength={2000} defaultValue={problem?.url} onChange={event => { if (!problem && (event.nativeEvent as InputEvent).inputType === 'insertFromPaste') void fill(event.currentTarget); }} /></label>
		{lookup && <p className="small lookup" role="status">{lookup === 'loading' ? <><LoaderCircle size={16} className="spin" />Filling in details from LeetCode</> : lookup}</p>}
		<label>Title<input name="title" required maxLength={200} defaultValue={problem?.title} /></label>
		<div className="editor-grid"><label>Problem number<input name="number" type="number" min="1" defaultValue={problem?.number ?? ''} /></label><label>Difficulty<select name="difficulty" defaultValue={problem?.difficulty ?? 'medium'}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label></div>
		<div><label>Topics<input name="topics" aria-describedby="topics-help" defaultValue={problem?.topics.join(', ')} placeholder="Arrays, Sliding window" /></label><small id="topics-help">Separate topics with commas. Use at most 12.</small></div>
		<label>Summary<textarea aria-label="Summary" name="summary" maxLength={8000} defaultValue={problem?.summary} /></label>
		{error && <p className="error" role="alert">{error}</p>}<div className="row spread"><button type="button" onClick={close}>Cancel</button><button className="primary" disabled={busy}>Save problem</button></div>
	</form></dialog>;
}

export function Problems() {
	const { data, error, reload } = useResource<Page<Problem>>(`/problems${location.search}`);
	const [adding, setAdding] = useState(false);
	const query = new URLSearchParams(location.search);
	function filter(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		const params = new URLSearchParams();
		for (const [key, value] of new FormData(event.currentTarget)) if (value) params.set(key, String(value));
		location.assign(`/leetcode/problems?${params}`);
	}
	return <div className="stack"><div className="heading"><div><h1>Problems</h1><p>Keep the reasoning, the code, and what you learned.</p></div><button className="primary" onClick={() => setAdding(true)}>Add a problem</button></div>
		<form onSubmit={filter} className="card card-pad stack"><label>Search problems and notes<input name="q" type="search" maxLength={100} defaultValue={query.get('q') ?? ''} /></label><div className="filters">
			<label>Difficulty<select name="difficulty" defaultValue={query.get('difficulty') ?? ''}><option value="">All levels</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
			<label>Topic<input name="topic" maxLength={40} defaultValue={query.get('topic') ?? ''} /></label>
			<label>Acceptance<select name="solved" defaultValue={query.get('solved') ?? ''}><option value="">All problems</option><option value="1">Accepted on LeetCode</option><option value="0">Not yet accepted</option></select></label>
			<label>Understanding<select name="understanding" defaultValue={query.get('understanding') ?? ''}><option value="">All understanding</option><option value="needs_practice">Needs practice</option><option value="with_help">With help</option><option value="independent">Independent</option></select></label>
			<label>Homework<select name="homework" defaultValue={query.get('homework') ?? ''}><option value="">All problems</option><option value="1">Active homework</option><option value="0">No active homework</option></select></label>
			<label>Review due by<input type="date" name="due" defaultValue={query.get('due') ?? ''} /></label>
			<label>Library<select name="archived" defaultValue={query.get('archived') ?? ''}><option value="">Active problems</option><option value="1">Archived problems</option></select></label>
		</div><div className="row"><button>Apply filters</button><a href="/leetcode/problems">Clear filters</a></div></form>
		{error && <p className="error" role="alert">{error} <button onClick={reload}>Retry</button></p>}
		{data && <section className="card" aria-label="Problem library">{data.items.length ? data.items.map(problem => <article className="list-row" key={problem.id}><span className="small">{problem.number ? `#${problem.number}` : ''}</span><div className="grow"><h2><a href={`/leetcode/problems/${problem.id}`}>{problem.title}</a></h2><p>{problem.topics.join(', ')}</p></div><span className={`tag ${problem.difficulty}`}>{problem.difficulty}</span><span className="tag">{problem.solved ? 'Accepted' : 'Not yet accepted'}</span></article>) : <p className="empty">No problems match. Add a problem or change the filters.</p>}</section>}
		{data?.nextOffset !== null && data?.nextOffset !== undefined && <a className="button" href={`?${new URLSearchParams({ ...Object.fromEntries(query), offset: String(data.nextOffset) })}`}>More problems</a>}
		{adding && <ProblemForm close={() => setAdding(false)} saved={problem => location.assign(`/leetcode/problems/${problem.id}`)} />}
	</div>;
}
