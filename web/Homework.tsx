import { useState, type SubmitEvent } from 'react';
import type { Attempt, AttemptSummary, Feedback, Homework as Bundle, HomeworkDetails, HomeworkSummary, Page, Problem, SessionUser, TaskDetails } from '../shared/leetcode';
import { api, message } from './api';
import { useResource } from './useResource';
import { AttemptContent, attemptLabel } from './Problem';
import { LessonLinks } from './Lessons';

export const homeworkLabels = { assigned: 'Assigned', in_progress: 'In progress', submitted: 'Submitted for review', changes_requested: 'Another attempt requested', completed: 'Completed', cancelled: 'Cancelled' };
export function Discussion({ problemId, taskId, submissionId, taskVersion }: { problemId: string; taskId?: string; submissionId?: string | null; taskVersion?: number }) {
	const [offset, setOffset] = useState(0), [shownVersion, setShownVersion] = useState(taskVersion);
	if (shownVersion !== taskVersion) { setShownVersion(taskVersion); setOffset(0); }
	const comments = useResource<Page<Feedback>>(`/problems/${problemId}/feedback?offset=${offset}`, taskVersion);
	const [body, setBody] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
	async function reply(event: SubmitEvent) {
		event.preventDefault(); setBusy(true); setError('');
		try { await api(`/problems/${problemId}/feedback`, { method: 'POST', body: JSON.stringify({ body, taskId, submissionId }) }); setBody(''); setOffset(0); comments.reload(); }
		catch (error) { setError(message(error)); } finally { setBusy(false); }
	}
	return <section className="card card-pad stack"><h2>Discussion</h2>{(error || comments.error) && <p className="error" role="alert">{error || comments.error}</p>}
		{comments.data?.items.length === 0 && <p>No feedback yet. Add a question or a learning note.</p>}
		{comments.data?.items.map(comment => <article className={`feedback ${comment.author}`} key={comment.id}><small>{comment.author} - {new Date(comment.createdAt).toLocaleString()}{comment.kind !== 'reply' && ` - ${homeworkLabels[comment.kind]}`}</small><p className="prose">{comment.body}</p>{comment.submissionId && <small>Submission: {comment.submissionId.slice(0, 8)}</small>}</article>)}
		<div className="row">{offset > 0 && <button onClick={() => setOffset(Math.max(0, offset - 50))}>Newer replies</button>}{comments.data?.nextOffset != null && <button onClick={() => setOffset(comments.data!.nextOffset!)}>Older replies</button>}</div>
		<form className="stack" onSubmit={reply}><label>Reply<textarea aria-label="Reply" value={body} onChange={event => setBody(event.target.value)} required maxLength={8000} /></label><button disabled={busy}>Add reply</button></form>
	</section>;
}

export function Homework({ user, id }: { user: SessionUser; id?: string }) {
	return id ? <BundleDetail key={id} id={id} user={user} /> : <HomeworkList user={user} />;
}
function HomeworkList({ user }: { user: SessionUser }) {
	const list = useResource<Page<HomeworkSummary>>(`/homework${location.search}`);
	const [error, setError] = useState(''), [busy, setBusy] = useState(false);
	async function create(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault(); setBusy(true); setError('');
		const form = new FormData(event.currentTarget);
		try {
			const homework = await api<Bundle>('/homework', { method: 'POST', body: JSON.stringify({ title: form.get('title'), instructions: form.get('instructions'), dueDate: form.get('dueDate') || null }) });
			location.assign(`/leetcode/homework/${homework.id}`);
		} catch (error) { setError(message(error)); setBusy(false); }
	}
	const parent = user.role === 'parent';
	return <div className="stack"><div className="heading"><div><h1>Homework</h1><p>{parent ? 'Group problems into homework. Review the reasoning behind each solution.' : 'Work on each task, then submit an attempt for review.'}</p></div></div>
		{(error || list.error) && <p className="error" role="alert">{error || list.error}</p>}
		<section className="card">{list.data?.items.map(h => { const waiting = parent ? h.submittedCount : h.requestedCount; return <article key={h.id} className="list-row"><div className="grow"><h2>{h.unread && <span className="unread" role="img" aria-label="New message" />}<a href={`/leetcode/homework/${h.id}`}>{h.title}</a></h2><p>{h.dueDate ? `Due ${h.dueDate}` : 'No due date'}</p></div><span className="small">{h.completedCount} of {h.taskCount} completed</span>{waiting > 0 && <span className={`tag ${parent ? 'good' : 'medium'}`}>{waiting} {parent ? 'waiting for review' : 'to revise'}</span>}</article>; })}{list.data?.items.length === 0 && <p className="empty">No homework yet. {parent ? 'Create homework below.' : 'Your parent can add homework.'}</p>}</section>
		{list.data?.nextOffset != null && <a href={`?offset=${list.data.nextOffset}`}>Older homework</a>}
		{parent && <form className="card card-pad stack" onSubmit={create}><h2>New homework</h2><label>Title<input name="title" required maxLength={200} /></label><label>Instructions<textarea aria-label="Instructions" name="instructions" maxLength={8000} /></label><label>Due date<input type="date" name="dueDate" /></label><button className="primary" disabled={busy}>Create homework</button></form>}
	</div>;
}

function BundleDetail({ id, user }: { id: string; user: SessionUser }) {
	const details = useResource<HomeworkDetails>(`/homework/${id}`);
	const h = details.data?.homework;
	const [editing, setEditing] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false);
	async function save(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault(); setBusy(true); setError('');
		const form = new FormData(event.currentTarget);
		try { await api(`/homework/${id}`, { method: 'PATCH', body: JSON.stringify({ version: h!.version, title: form.get('title'), instructions: form.get('instructions'), dueDate: form.get('dueDate') || null }) }); setEditing(false); details.reload(); }
		catch (error) { setError(message(error)); } finally { setBusy(false); }
	}
	if (!h) return <p role="status">{details.error || 'Opening homework...'}</p>;
	const parent = user.role === 'parent', tasks = details.data!.tasks;
	return <div className="stack"><div className="heading"><div><h1>{h.title}</h1><p>{h.dueDate ? `Due ${h.dueDate}` : 'No due date'}</p></div>{parent && <button onClick={() => setEditing(!editing)}>Edit homework</button>}</div><p className="prose">{h.instructions}</p>
		{(error || details.error) && <p className="error" role="alert">{error || details.error}</p>}
		{editing && <form className="card card-pad stack" onSubmit={save}><label>Title<input name="title" defaultValue={h.title} required maxLength={200} /></label><label>Instructions<textarea aria-label="Instructions" name="instructions" defaultValue={h.instructions} maxLength={8000} /></label><label>Due date<input type="date" name="dueDate" defaultValue={h.dueDate ?? ''} /></label><button disabled={busy}>Save homework</button></form>}
		<section className="card" aria-label="Tasks">{tasks.map(t => <article key={t.id} className="list-row"><div className="grow"><h2>{t.unread && <span className="unread" role="img" aria-label="New message" />}<a href={`/leetcode/tasks/${t.id}`}>{t.problemTitle}</a></h2></div><span className={`tag ${t.difficulty}`}>{t.difficulty}</span><span className="tag">{homeworkLabels[t.state]}</span></article>)}{!tasks.length && <p className="empty">No tasks yet. {parent ? 'Add a problem below.' : 'Your parent can add a task.'}</p>}</section>
		{parent && <AddTask homeworkId={id} added={details.reload} />}
		<LessonLinks homework={h} user={user} changed={details.reload} />
	</div>;
}

function AddTask({ homeworkId, added }: { homeworkId: string; added: () => void }) {
	const [search, setSearch] = useState(''), [chosen, setChosen] = useState<Problem>();
	const problems = useResource<Page<Problem>>(`/problems?q=${encodeURIComponent(search)}`);
	const [error, setError] = useState(''), [busy, setBusy] = useState(false);
	async function add(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault(); setBusy(true); setError('');
		try { await api('/tasks', { method: 'POST', body: JSON.stringify({ homeworkId, problemId: new FormData(event.currentTarget).get('problemId') }) }); setChosen(undefined); added(); }
		catch (error) { setError(message(error)); } finally { setBusy(false); }
	}
	return <form className="card card-pad stack" onSubmit={add}><h2>Add a task</h2>{error && <p className="error" role="alert">{error}</p>}<label>Find a problem<input type="search" value={search} onChange={event => setSearch(event.target.value)} maxLength={100} /></label><label>Problem<select name="problemId" required value={chosen?.id ?? ''} onChange={event => setChosen(problems.data?.items.find(p => p.id === event.target.value))}><option value="" disabled>Select a problem</option>{chosen && !problems.data?.items.some(p => p.id === chosen.id) && <option value={chosen.id}>{chosen.title}</option>}{problems.data?.items.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label><button className="primary" disabled={busy}>Add task</button></form>;
}

export function Task({ id, user }: { id: string; user: SessionUser }) {
	const details = useResource<TaskDetails>(`/tasks/${id}`);
	const t = details.data?.task;
	const attempts = useResource<Page<AttemptSummary>>(t && user.role === 'student' ? `/problems/${t.problemId}/attempts` : null);
	const [selected, setSelected] = useState(''), [submission, setSubmission] = useState(''), [feedback, setFeedback] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
	const submitted = details.data?.submissions.find(s => s.id === (submission || t?.submissionId));
	const work = useResource<Attempt>(t && submitted ? `/problems/${t.problemId}/attempts/${submitted.attemptId}` : null);
	const editable = t && ['assigned', 'in_progress', 'changes_requested'].includes(t.state);
	async function action(name: string, extra: Record<string, unknown> = {}) {
		setBusy(true); setError('');
		try { await api(`/tasks/${id}/${name}`, { method: 'POST', body: JSON.stringify({ version: t!.version, ...extra }) }); details.reload(); }
		catch (error) { setError(message(error)); } finally { setBusy(false); }
	}
	if (!t) return <p role="status">{details.error || 'Opening task...'}</p>;
	return <div className="stack"><div className="heading"><div><p className="small"><a href={`/leetcode/homework/${t.homeworkId}`}>{t.homeworkTitle}</a></p><h1>{t.problemTitle}</h1><p><span className="tag">{homeworkLabels[t.state]}</span> {t.dueDate ? `Due ${t.dueDate}` : 'No due date'}</p></div><a className="button" href={`/leetcode/problems/${t.problemId}`}>Open notebook</a></div><p className="prose">{t.instructions}</p>
		{(error || details.error || work.error) && <p className="error" role="alert">{error || details.error || work.error}</p>}
		{user.role === 'parent' && !['completed', 'cancelled'].includes(t.state) && <div className="row"><button disabled={busy} onClick={() => { if (confirm('Cancel this task?')) void action('cancel'); }}>Cancel task</button></div>}
		{user.role === 'student' && editable && <div className="card card-pad stack">{t.state === 'assigned' && <button disabled={busy} onClick={() => void action('start')}>Start task</button>}<label>Attempt to submit<select value={selected || attempts.data?.items[0]?.id || ''} onChange={event => setSelected(event.target.value)}>{attempts.data?.items.map((a, i, items) => <option key={a.id} value={a.id}>{attemptLabel(items, i)}</option>)}</select></label><button className="primary" disabled={busy || !attempts.data?.items.length} onClick={() => { const a = attempts.data!.items.find(a => a.id === selected) ?? attempts.data!.items[0]; void action('submit', { attemptId: a.id, attemptVersion: a.version }); }}>Submit for review</button></div>}
		{details.data!.submissions.length > 0 && <section className="stack"><label>Submission history<select value={submission || t.submissionId || ''} onChange={event => setSubmission(event.target.value)}>{details.data!.submissions.map((s, i) => <option key={s.id} value={s.id}>{i === 0 ? 'Latest submission' : 'Earlier submission'} - {new Date(s.createdAt).toLocaleString()}</option>)}</select></label>{work.data && <AttemptContent value={work.data} />}</section>}
		{user.role === 'parent' && t.state === 'submitted' && (!submission || submission === t.submissionId) && <section className="card card-pad stack"><h2>Review this submission</h2><label>Review feedback<textarea aria-label="Review feedback" value={feedback} onChange={event => setFeedback(event.target.value)} maxLength={8000} /></label><div className="row"><button disabled={busy} onClick={() => void action('review', { submissionId: t.submissionId, decision: 'changes_requested', body: feedback })}>Request another attempt</button><button className="primary" disabled={busy} onClick={() => void action('review', { submissionId: t.submissionId, decision: 'completed', body: feedback })}>Complete task</button></div></section>}
		<LessonLinks homework={details.data!.homework} user={user} changed={details.reload} />
		<Discussion problemId={t.problemId} taskId={t.id} submissionId={submitted?.id} taskVersion={t.version} />
	</div>;
}
