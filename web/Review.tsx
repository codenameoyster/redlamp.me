import { useState } from 'react';
import type { Attempt, AttemptSummary, Page, Problem, Revision, SessionUser, Understanding } from '../shared/leetcode';
import { addCalendarDays, localDate } from '../shared/dates';
import { api, message } from './api';
import { useResource } from './useResource';
import { AttemptContent, understandingLabels } from './Problem';

const results: { value: Understanding; label: string; days: number }[] = [{ value: 'needs_practice', label: 'Need another attempt', days: 1 }, { value: 'with_help', label: 'Solved with help', days: 3 }, { value: 'independent', label: 'Solved independently', days: 7 }];
export function Review({ id, user }: { id: string; user: SessionUser }) {
	const problem = useResource<Problem>(`/problems/${id}`);
	const [revealed, setRevealed] = useState(false), [result, setResult] = useState<Understanding | null>(null), [date, setDate] = useState(''), [note, setNote] = useState(''), [error, setError] = useState(''), [saved, setSaved] = useState(false), [busy, setBusy] = useState(false);
	const [offset, setOffset] = useState(0);
	const history = useResource<Page<Revision>>(`/problems/${id}/reviews?offset=${offset}`);
	async function save() {
		setBusy(true); setError(''); setSaved(false);
		try { await api(`/problems/${id}/reviews`, { method: 'POST', body: JSON.stringify({ version: problem.data!.progressVersion, result, note, reviewedOn: localDate(), nextReviewDate: date || null }) }); setSaved(true); problem.reload(); history.reload(); }
		catch (error) { setError(message(error)); } finally { setBusy(false); }
	}
	const record = problem.data;
	if (!record) return <p role="status">{problem.error || 'Opening review...'}</p>;
	return <div className="stack"><div className="heading"><div><p className="small">Recall practice</p><h1>{record.title}</h1><div className="tags">{record.topics.map(topic => <span className="tag" key={topic}>{topic}</span>)}</div></div><a className="button" href={record.url} target="_blank" rel="noopener noreferrer">Open LeetCode</a></div><p className="prose">{record.summary}</p>
		<section className="card card-pad stack"><h2>Explain it before you look.</h2><p>State the key idea, why it works, and its time and space complexity. Try the problem on LeetCode.</p>{revealed ? <SavedWork problemId={id} /> : <button onClick={() => setRevealed(true)}>Reveal saved work</button>}</section>
		{user.role === 'student' && <section className="card card-pad stack"><h2>How did it go?</h2><div className="row">{results.map(item => <button key={item.value} aria-pressed={result === item.value} onClick={() => { setResult(item.value); setDate(addCalendarDays(localDate(), item.days)); setSaved(false); }}>{item.label}</button>)}</div><label>Review note<textarea aria-label="Review note" maxLength={8000} value={note} onChange={event => setNote(event.target.value)} /></label><label>Next review<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label><p className="small">Choose a date or leave it empty to clear the reminder.</p>{error && <p className="error" role="alert">{error}</p>}{saved && <p role="status">Review saved.</p>}<button className="primary" disabled={!result || busy} onClick={save}>Save review</button></section>}
		<section className="card card-pad stack"><h2>Review history</h2>{history.error && <p className="error" role="alert">{history.error}</p>}{history.data?.items.map(review => <article key={review.id}><strong>{review.reviewedOn} - {understandingLabels[review.result]}</strong><p className="prose">{review.note}</p><small>{review.nextReviewDate ? `Next review: ${review.nextReviewDate}` : 'No reminder'}</small></article>)}{history.data?.items.length === 0 && <p>No review results yet.</p>}<div className="row">{offset > 0 && <button onClick={() => setOffset(offset - 50)}>Newer reviews</button>}{history.data?.nextOffset != null && <button onClick={() => setOffset(history.data!.nextOffset!)}>Older reviews</button>}</div></section><a href={`/leetcode/problems/${id}`}>Back to notebook</a>
	</div>;
}
function SavedWork({ problemId }: { problemId: string }) {
	const attempts = useResource<Page<AttemptSummary>>(`/problems/${problemId}/attempts`);
	const [selected, setSelected] = useState('');
	const saved = attempts.data?.items.filter(a => a.state === 'saved');
	const id = selected || saved?.[0]?.id;
	const work = useResource<Attempt>(id ? `/problems/${problemId}/attempts/${id}` : null);
	return <div className="stack">{(attempts.error || work.error) && <p className="error" role="alert">{attempts.error || work.error}</p>}{saved?.length === 0 ? <p>No saved work yet. Save an attempt from the notebook first.</p> : <><label>Saved attempt<select aria-label="Saved attempt" value={id ?? ''} onChange={event => setSelected(event.target.value)}>{saved?.map((a, i) => <option key={a.id} value={a.id}>Attempt {saved.length - i} - {new Date(a.savedAt!).toLocaleString()}</option>)}</select></label>{work.data && <AttemptContent value={work.data} />}</>}</div>;
}
