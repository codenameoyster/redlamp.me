import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import type { Homework, HomeworkSummary, LearningSetDetails, LearningSetSummary, Page, Problem, SessionUser } from '../shared/leetcode';
import { api, message } from './api';
import { useResource } from './useResource';
import { homeworkLabels } from './Homework';
import { Tutor } from './Tutor';

type SetTask = LearningSetDetails['tasks'][number];
function taskCount(count: number) { return `${count} ${count === 1 ? 'task' : 'tasks'}`; }

export function Sets({ user, slug }: { user: SessionUser; slug?: string }) { return slug ? <SetView key={slug} slug={slug} user={user} /> : <SetList />; }
function SetList() {
	const sets = useResource<LearningSetSummary[]>('/sets');
	return <div className="stack"><div className="heading"><div><h1>Sets</h1><p>Read the lesson. Then solve its problems in order.</p></div></div>
		{sets.error && <p className="error" role="alert">{sets.error}</p>}
		<div className="lesson-grid">{sets.data?.map(s => <article className="card card-pad stack" key={s.slug}><h2><a href={`/leetcode/sets/${s.slug}`}>{s.title}</a></h2><p>{s.summary}</p><div className="tags">{s.topics.map(t => <span className="tag" key={t}>{t}</span>)}</div><div className="row small"><span>{taskCount(s.taskCount)}</span><span>{s.acceptedCount} accepted</span></div></article>)}</div>
	</div>;
}

function SetView({ slug, user }: { slug: string; user: SessionUser }) {
	const details = useResource<LearningSetDetails>(`/sets/${slug}`);
	const [adding, setAdding] = useState<SetTask | null>(null);
	const set = details.data;
	if (!set) return <p role="status">{details.error || 'Opening set...'}</p>;
	const lesson = `/leetcode/api/sets/${slug}/lesson`;
	return <div className="stack"><div className="heading"><div><h1>{set.title}</h1><p>{set.summary}</p></div><div className="row"><a className="button" href={lesson} target="_blank" rel="noopener noreferrer">Full-page display</a><Tutor context={{ kind: 'set', id: slug }} title={set.title} user={user} /></div></div>
		{details.error && <p className="error" role="alert">{details.error}</p>}
		<iframe title={set.title} src={lesson} sandbox="allow-scripts" className="lesson-frame" />
		<section className="card card-pad stack"><h2>Reading</h2><ul>{set.links.map(link => <li key={link.url}><a href={link.url} target="_blank" rel="noopener noreferrer">{link.title}</a> <small>{link.source}</small></li>)}</ul></section>
		{[...new Set(set.tasks.map(t => t.stage))].map(stage => <section className="card" key={stage}><header className="card-head"><h2>{stage}</h2></header>{set.tasks.filter(t => t.stage === stage).map(t => <article className="list-row" key={t.slug}><span className="small">#{t.number}</span><div className="grow"><h3>{t.problemId ? <a href={`/leetcode/problems/${t.problemId}`}>{t.title}</a> : <a href={`https://leetcode.com/problems/${t.slug}/`} target="_blank" rel="noopener noreferrer">{t.title}</a>}</h3><p className="small">{t.note}</p></div><span className={`tag ${t.difficulty}`}>{t.difficulty}</span>{t.accepted && <span className="tag good">Accepted</span>}{t.activeTask && <a className="tag" href={`/leetcode/tasks/${t.activeTask.id}`}>{homeworkLabels[t.activeTask.state]}</a>}{user.role === 'parent' && !t.activeTask && <button onClick={() => setAdding(t)}>Add to homework</button>}</article>)}</section>)}
		{adding && <AddToHomework task={adding} title={set.title} close={() => setAdding(null)} added={() => { setAdding(null); details.reload(); }} />}
	</div>;
}

function AddToHomework({ task, title, close, added }: { task: SetTask; title: string; close: () => void; added: () => void }) {
	const dialog = useRef<HTMLDialogElement>(null);
	const [search, setSearch] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
	const bundles = useResource<Page<HomeworkSummary>>(`/homework?active=1&q=${encodeURIComponent(search)}`), [shown, setShown] = useState(bundles.data);
	if (bundles.data && bundles.data !== shown) setShown(bundles.data);
	useEffect(() => {
		const previous = document.activeElement, element = dialog.current;
		element?.showModal();
		return () => { element?.close(); if (previous instanceof HTMLElement) previous.focus(); };
	}, []);
	async function assign(homeworkId: () => Promise<string>) {
		setBusy(true); setError('');
		try {
			const problem = await api<Problem>('/problems', { method: 'POST', body: JSON.stringify({ url: `https://leetcode.com/problems/${task.slug}/`, number: task.number, title: task.title, difficulty: task.difficulty, topics: task.topics, summary: task.note }) });
			if (problem.archivedAt) throw new Error('Restore this problem before you assign homework.');
			await api('/tasks', { method: 'POST', body: JSON.stringify({ homeworkId: await homeworkId(), problemId: problem.id }) });
			added();
		} catch (error) { setError(message(error)); setBusy(false); bundles.reload(); }
	}
	function create(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		void assign(async () => (await api<Homework>('/homework', { method: 'POST', body: JSON.stringify({ title: form.get('title'), instructions: '', dueDate: form.get('dueDate') || null }) })).id);
	}
	return <dialog ref={dialog} onCancel={close} aria-labelledby="add-homework-title"><div className="stack">
		<h2 id="add-homework-title">Add {task.title} to homework</h2>
		<label>Find homework<input type="search" value={search} onChange={event => setSearch(event.target.value)} maxLength={200} /></label>
		{(error || bundles.error) && <p className="error" role="alert">{error || bundles.error}</p>}
		<div>{shown?.items.map(h => <article className="list-row" key={h.id}><div className="grow"><h3>{h.title}</h3><p className="small">{h.dueDate ? `Due ${h.dueDate}` : 'No due date'}</p></div><span className="small">{taskCount(h.taskCount)}</span><button disabled={busy} onClick={() => void assign(async () => h.id)}>Assign</button></article>)}{shown?.items.length === 0 && <p className="empty">No active homework matches.</p>}</div>
		<form className="stack" onSubmit={create}><h3>New homework</h3><label>Title<input name="title" required maxLength={200} defaultValue={title} /></label><label>Due date<input type="date" name="dueDate" /></label><button className="primary" disabled={busy}>Create and assign</button></form>
		<div className="row"><button type="button" onClick={close}>Close</button></div>
	</div></dialog>;
}
