import { useState, type SubmitEvent } from 'react';
import type { Attempt, AttemptSummary, Feedback, Homework as Assignment, HomeworkDetails, Page, Problem, SessionUser } from '../shared/leetcode';
import { api, message } from './api';
import { useResource } from './useResource';
import { AttemptContent, attemptLabel } from './Problem';
import { LessonLinks } from './Lessons';

export const homeworkLabels = { assigned: 'Assigned', in_progress: 'In progress', submitted: 'Submitted for review', changes_requested: 'Another attempt requested', completed: 'Completed', cancelled: 'Cancelled' };
export function Discussion({ problemId, homeworkId, submissionId, homeworkVersion }: { problemId: string; homeworkId?: string; submissionId?: string | null; homeworkVersion?: number }) {
	const [offset, setOffset] = useState(0), [shownVersion, setShownVersion] = useState(homeworkVersion);
	if (shownVersion !== homeworkVersion) { setShownVersion(homeworkVersion); setOffset(0); }
	const comments = useResource<Page<Feedback>>(`/problems/${problemId}/feedback?offset=${offset}`, homeworkVersion);
	const [body, setBody] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
	async function reply(event: SubmitEvent) {
		event.preventDefault(); setBusy(true); setError('');
		try { await api(`/problems/${problemId}/feedback`, { method: 'POST', body: JSON.stringify({ body, homeworkId, submissionId }) }); setBody(''); setOffset(0); comments.reload(); }
		catch (error) { setError(message(error)); } finally { setBusy(false); }
	}
	return <section className="card card-pad stack"><h2>Discussion</h2>{(error || comments.error) && <p className="error" role="alert">{error || comments.error}</p>}
		{comments.data?.items.length === 0 && <p>No feedback yet. Add a question or a learning note.</p>}
		{comments.data?.items.map(comment => <article className="feedback" key={comment.id}><small>{comment.author} - {new Date(comment.createdAt).toLocaleString()}{comment.kind !== 'reply' && ` - ${homeworkLabels[comment.kind]}`}</small><p className="prose">{comment.body}</p>{comment.submissionId && <small>Submission: {comment.submissionId.slice(0, 8)}</small>}</article>)}
		<div className="row">{offset > 0 && <button onClick={() => setOffset(Math.max(0, offset - 50))}>Newer replies</button>}{comments.data?.nextOffset != null && <button onClick={() => setOffset(comments.data!.nextOffset!)}>Older replies</button>}</div>
		<form className="stack" onSubmit={reply}><label>Reply<textarea aria-label="Reply" value={body} onChange={event => setBody(event.target.value)} required maxLength={8000} /></label><button disabled={busy}>Add reply</button></form>
	</section>;
}

export function Homework({ user, id }: { user: SessionUser; id?: string }) {
	return id ? <HomeworkDetail key={id} id={id} user={user} /> : <HomeworkList user={user} />;
}
function HomeworkList({ user }: { user: SessionUser }) {
	const list = useResource<Page<Assignment>>(`/homework${location.search}`);
	const [search, setSearch] = useState(''), [chosen, setChosen] = useState<Problem>();
	const problems = useResource<Page<Problem>>(user.role === 'parent' ? `/problems?q=${encodeURIComponent(search)}` : null);
	const [error, setError] = useState(''), [busy, setBusy] = useState(false);
	async function assign(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault(); setBusy(true); setError('');
		const form = new FormData(event.currentTarget);
		try {
			const homework = await api<Assignment>('/homework', { method: 'POST', body: JSON.stringify({ problemId: form.get('problemId'), instructions: form.get('instructions'), dueDate: form.get('dueDate') || null }) });
			location.assign(`/leetcode/homework/${homework.id}`);
		} catch (error) { setError(message(error)); setBusy(false); }
	}
	return <div className="stack"><div className="heading"><div><h1>Homework</h1><p>{user.role === 'parent' ? 'Set the next goal. Review the reasoning behind each solution.' : 'Work on the assignment, then submit an attempt for review.'}</p></div></div>
		{(error || list.error) && <p className="error" role="alert">{error || list.error}</p>}
		<section className="card">{list.data?.items.map(h => <article key={h.id} className="list-row"><div className="grow"><h2><a href={`/leetcode/homework/${h.id}`}>{h.problemTitle}</a></h2><p>{h.dueDate ? `Due ${h.dueDate}` : 'No due date'}</p></div><span className="tag">{homeworkLabels[h.state]}</span></article>)}{list.data?.items.length === 0 && <p className="empty">No homework yet. {user.role === 'parent' ? 'Assign a problem below.' : 'Your parent can add an assignment.'}</p>}</section>
		{list.data?.nextOffset != null && <a href={`?offset=${list.data.nextOffset}`}>Older assignments</a>}
		{user.role === 'parent' && <form className="card card-pad stack" onSubmit={assign}><h2>Assign homework</h2><label>Find a problem<input type="search" value={search} onChange={event => setSearch(event.target.value)} maxLength={100} /></label><label>Problem<select name="problemId" required value={chosen?.id ?? ''} onChange={event => setChosen(problems.data?.items.find(p => p.id === event.target.value))}><option value="" disabled>Select a problem</option>{chosen && !problems.data?.items.some(p => p.id === chosen.id) && <option value={chosen.id}>{chosen.title}</option>}{problems.data?.items.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label><label>Instructions<textarea aria-label="Instructions" name="instructions" maxLength={8000} /></label><label>Due date<input type="date" name="dueDate" /></label><button className="primary" disabled={busy}>Assign homework</button></form>}
	</div>;
}

function HomeworkDetail({ id, user }: { id: string; user: SessionUser }) {
	const details = useResource<HomeworkDetails>(`/homework/${id}`);
	const h = details.data?.homework;
	const attempts = useResource<Page<AttemptSummary>>(h && user.role === 'student' ? `/problems/${h.problemId}/attempts` : null);
	const [selected, setSelected] = useState(''), [submission, setSubmission] = useState(''), [feedback, setFeedback] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [editing, setEditing] = useState(false);
	const submitted = details.data?.submissions.find(s => s.id === (submission || h?.submissionId));
	const work = useResource<Attempt>(h && submitted ? `/problems/${h.problemId}/attempts/${submitted.attemptId}` : null);
	const editable = h && ['assigned', 'in_progress', 'changes_requested'].includes(h.state);
	async function action(name: string, extra: Record<string, unknown> = {}) {
		setBusy(true); setError('');
		try { await api(`/homework/${id}${name ? `/${name}` : ''}`, { method: name ? 'POST' : 'PATCH', body: JSON.stringify({ version: h!.version, ...extra }) }); setEditing(false); details.reload(); }
		catch (error) { setError(message(error)); } finally { setBusy(false); }
	}
	if (!h) return <p role="status">{details.error || 'Opening homework...'}</p>;
	return <div className="stack"><div className="heading"><div><h1>{h.problemTitle}</h1><p><span className="tag">{homeworkLabels[h.state]}</span> {h.dueDate ? `Due ${h.dueDate}` : 'No due date'}</p></div><a className="button" href={`/leetcode/problems/${h.problemId}`}>Open notebook</a></div><p className="prose">{h.instructions}</p>
		{(error || details.error || work.error) && <p className="error" role="alert">{error || details.error || work.error}</p>}
		{user.role === 'parent' && <div className="row">{editable && <button onClick={() => setEditing(!editing)}>Edit assignment</button>}{!['completed', 'cancelled'].includes(h.state) && <button disabled={busy} onClick={() => { if (confirm('Cancel this assignment?')) void action('cancel'); }}>Cancel assignment</button>}</div>}
		{editing && <form className="card card-pad stack" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void action('', { instructions: form.get('instructions'), dueDate: form.get('dueDate') || null }); }}><label>Instructions<textarea aria-label="Instructions" name="instructions" defaultValue={h.instructions} maxLength={8000} /></label><label>Due date<input type="date" name="dueDate" defaultValue={h.dueDate ?? ''} /></label><button disabled={busy}>Save assignment</button></form>}
		{user.role === 'student' && editable && <div className="card card-pad stack">{h.state === 'assigned' && <button disabled={busy} onClick={() => void action('start')}>Start homework</button>}<label>Attempt to submit<select value={selected || attempts.data?.items[0]?.id || ''} onChange={event => setSelected(event.target.value)}>{attempts.data?.items.map((a, i, items) => <option key={a.id} value={a.id}>{attemptLabel(items, i)}</option>)}</select></label><button className="primary" disabled={busy || !attempts.data?.items.length} onClick={() => { const a = attempts.data!.items.find(a => a.id === selected) ?? attempts.data!.items[0]; void action('submit', { attemptId: a.id, attemptVersion: a.version }); }}>Submit for review</button></div>}
		{details.data!.submissions.length > 0 && <section className="stack"><label>Submission history<select value={submission || h.submissionId || ''} onChange={event => setSubmission(event.target.value)}>{details.data!.submissions.map((s, i) => <option key={s.id} value={s.id}>{i === 0 ? 'Latest submission' : 'Earlier submission'} - {new Date(s.createdAt).toLocaleString()}</option>)}</select></label>{work.data && <AttemptContent value={work.data} />}</section>}
		{user.role === 'parent' && h.state === 'submitted' && (!submission || submission === h.submissionId) && <section className="card card-pad stack"><h2>Review this submission</h2><label>Review feedback<textarea aria-label="Review feedback" value={feedback} onChange={event => setFeedback(event.target.value)} maxLength={8000} /></label><div className="row"><button disabled={busy} onClick={() => void action('review', { submissionId: h.submissionId, decision: 'changes_requested', body: feedback })}>Request another attempt</button><button className="primary" disabled={busy} onClick={() => void action('review', { submissionId: h.submissionId, decision: 'completed', body: feedback })}>Complete homework</button></div></section>}
		<LessonLinks homework={h} user={user} changed={details.reload} />
		<Discussion problemId={h.problemId} homeworkId={h.id} submissionId={submitted?.id} homeworkVersion={h.version} />
	</div>;
}
