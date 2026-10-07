import { useCallback, useEffect, useRef, useState } from 'react';
import { newApproach, type Approach, type Attempt, type AttemptSummary, type DraftValue, type Homework, type Page, type Problem as ProblemRecord, type SessionUser } from '../shared/leetcode';
import { api, ApiError, message } from './api';
import { useResource } from './useResource';
import { useDraft, type LeaveGuard, type RegisterGuard } from './useDraft';
import { ProblemForm } from './Problems';
import { Discussion, homeworkLabels } from './Homework';
import { LessonLinks } from './Lessons';

export const understandingLabels = { needs_practice: 'Needs practice', with_help: 'With help', independent: 'Independent' };
export const acceptanceLabels = { not_submitted: 'Not submitted', not_accepted: 'Not accepted', accepted: 'Accepted on LeetCode' };

export function AttemptContent({ value, change }: { value: DraftValue; change?: (next: DraftValue) => void }) {
	const [copyState, setCopyState] = useState('');
	function update(id: string, patch: Partial<Approach>) { change?.({ ...value, document: { ...value.document, approaches: value.document.approaches.map(a => a.id === id ? { ...a, ...patch } : a) } }); }
	const fields = [{ key: 'idea', label: 'Key idea' }, { key: 'correctness', label: 'Why it works' }, { key: 'edgeCases', label: 'Edge cases' }, { key: 'mistakes', label: 'Mistakes and learning' }] as const;
	return <div className="stack">
		<div className="row"><label>LeetCode acceptance<select value={value.acceptance} disabled={!change} onChange={event => change?.({ ...value, acceptance: event.target.value as DraftValue['acceptance'] })}>{Object.entries(acceptanceLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Understanding<select value={value.understanding} disabled={!change} onChange={event => change?.({ ...value, understanding: event.target.value as DraftValue['understanding'] })}>{Object.entries(understandingLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
		<label>General notes<textarea aria-label="General notes" value={value.document.notes} readOnly={!change} onChange={event => change?.({ ...value, document: { ...value.document, notes: event.target.value } })} /></label>
		{value.document.approaches.map((approach, index) => <section className="stack" key={approach.id} aria-label={`Approach ${index + 1}`}>
			<div className="row spread"><h2>Approach {index + 1}</h2>{change && value.document.approaches.length > 1 && <button type="button" onClick={() => { if (confirm('Remove this approach from the draft?')) change({ ...value, document: { ...value.document, approaches: value.document.approaches.filter(a => a.id !== approach.id) } }); }}>Remove approach</button>}</div>
			<label>Approach name<input value={approach.label} maxLength={200} readOnly={!change} onChange={event => update(approach.id, { label: event.target.value })} /></label>
			<div className="editor-grid"><div className="card card-pad stack">{fields.map(field => <label key={field.key}>{field.label}<textarea aria-label={field.label} value={approach[field.key]} readOnly={!change} onChange={event => update(approach.id, { [field.key]: event.target.value })} /></label>)}<div className="editor-grid"><label>Time complexity<input value={approach.timeComplexity} readOnly={!change} onChange={event => update(approach.id, { timeComplexity: event.target.value })} /></label><label>Space complexity<input value={approach.spaceComplexity} readOnly={!change} onChange={event => update(approach.id, { spaceComplexity: event.target.value })} /></label></div></div>
				<div className="card card-pad stack"><label>Code language<input value={approach.language} maxLength={40} readOnly={!change} onChange={event => update(approach.id, { language: event.target.value })} /></label><label>Solution code<textarea aria-label="Solution code" className="code" spellCheck={false} value={approach.code} readOnly={!change} onChange={event => update(approach.id, { code: event.target.value })} /></label><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(approach.code); setCopyState('Code copied.'); } catch { setCopyState('Select and copy the code field.'); } }}>Copy code</button></div>
			</div>
		</section>)}
		{copyState && <p role="status">{copyState}</p>}
		{change && value.document.approaches.length < 8 && <button type="button" onClick={() => change({ ...value, document: { ...value.document, approaches: [...value.document.approaches, newApproach()] } })}>Add approach</button>}
	</div>;
}

export function DraftEditor({ initial, user, registerGuard, saved, nextReviewDate, homework }: { initial: Attempt; user: SessionUser; registerGuard: RegisterGuard; saved: (attempt: Attempt) => void; nextReviewDate: string | null; homework?: Homework }) {
	const draft = useDraft(initial, user);
	const [busy, setBusy] = useState(false), [error, setError] = useState(''), [date, setDate] = useState(nextReviewDate ?? '');
	const editable = user.role === 'student' && initial.state === 'draft';
	useEffect(() => { registerGuard(draft); return () => registerGuard(null); }, [draft.flush]);
	async function saveAttempt() {
		setBusy(true); setError('');
		try {
			const persisted = await draft.flush();
			if (persisted) saved(await api<Attempt>(`/problems/${initial.problemId}/attempts/${initial.id}/save`, { method: 'POST', body: JSON.stringify({ version: persisted.version, nextReviewDate: date || null }) }));
		} catch (error) { setError(message(error)); }
		finally { setBusy(false); }
	}
	async function submit() {
		setBusy(true); setError('');
		try {
			const persisted = await draft.flush();
			if (persisted) {
				await api(`/homework/${homework!.id}/submit`, { method: 'POST', body: JSON.stringify({ version: homework!.version, attemptId: persisted.id, attemptVersion: persisted.version, nextReviewDate: date || null }) });
				saved(await api<Attempt>(`/problems/${initial.problemId}/attempts/${initial.id}`));
			}
		} catch (error) { setError(message(error)); } finally { setBusy(false); }
	}
	return <div className="stack">
		{editable && <p role="status" aria-label="Save state" aria-live="polite">{{ saved: 'Saved', saving: 'Saving', unsaved: 'Not saved', conflict: 'Conflicting edits', login_required: 'Sign in to save' }[draft.status]}</p>}
		{draft.storageError && <p className="notice" role="status">{draft.storageError}</p>}
		{draft.recovery && <div className="notice stack"><p>This tab has unsaved work.</p><div className="row"><button onClick={draft.recover}>Restore unsaved work</button><button onClick={draft.reload}>Use server copy</button></div></div>}
		{(error || draft.error) && <div className="error" role="alert">{error || draft.error}<div className="row">{draft.status === 'login_required' ? <button onClick={draft.signIn}>Sign in again</button> : !draft.conflict && <button onClick={() => void draft.flush()}>Retry save</button>}<button onClick={async () => { try { await navigator.clipboard.writeText(JSON.stringify(draft.value, null, 2)); } catch { setError('Select and copy your text from the editor.'); } }}>Copy unsaved work</button></div></div>}
		{draft.conflict && <section className="notice stack"><h2>Server copy</h2><p>Your editor still contains your local copy. Copy it before replacing it.</p><pre>{JSON.stringify(draft.conflict.document, null, 2)}</pre><button onClick={draft.reload}>Use server copy</button></section>}
		<fieldset disabled={busy || Boolean(draft.recovery)}><AttemptContent value={draft.value} change={editable ? draft.change : undefined} /></fieldset>
		{editable && <div className="card card-pad row spread"><label>Next review<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label><button className="primary" disabled={busy || Boolean(draft.recovery)} onClick={saveAttempt}>Save attempt</button></div>}
		{editable && homework && ['assigned', 'in_progress', 'changes_requested'].includes(homework.state) && <button className="primary" disabled={busy || Boolean(draft.recovery)} onClick={submit}>Submit for review</button>}
	</div>;
}

export function Problem({ id, user, registerGuard }: { id: string; user: SessionUser; registerGuard: RegisterGuard }) {
	const problem = useResource<ProblemRecord>(`/problems/${id}`);
	const attempts = useResource<Page<AttemptSummary>>(`/problems/${id}/attempts`);
	const homework = useResource<Page<Homework>>(`/homework?problemId=${id}&active=1`);
	const [selected, setSelected] = useState<string | null>(new URLSearchParams(location.search).get('attempt'));
	const attemptId = selected ?? attempts.data?.items[0]?.id;
	const current = useResource<Attempt>(attemptId ? `/problems/${id}/attempts/${attemptId}` : null);
	const [editing, setEditing] = useState(false), [error, setError] = useState('');
	const guard = useRef<LeaveGuard | null>(null);
	const register = useCallback<RegisterGuard>(value => { guard.current = value; registerGuard(value); }, [registerGuard]);
	async function choose(value: string) { if (guard.current && !(await guard.current.flush())) return; setSelected(value); }
	async function start(copyAttemptId?: string) {
		try {
			if (guard.current && !(await guard.current.flush())) return;
			const attempt = await api<Attempt>(`/problems/${id}/attempts`, { method: 'POST', body: JSON.stringify(copyAttemptId ? { copyAttemptId } : {}) });
			setSelected(attempt.id); attempts.reload();
		} catch (error) { setError(message(error)); if (error instanceof ApiError && error.fields?.attemptId) setSelected(error.fields.attemptId); }
	}
	async function archive() {
		if (guard.current && !(await guard.current.flush())) return;
		if (!confirm('Archive this problem? Its history will remain available.')) return;
		try { await api(`/problems/${id}/archive`, { method: 'POST', body: JSON.stringify({ version: problem.data!.version }) }); problem.reload(); } catch (error) { setError(message(error)); }
	}
	const record = problem.data;
	if (!record) return <p role="status">{problem.error || 'Opening problem...'}</p>;
	return <div className="stack"><div className="heading"><div><h1>{record.title}</h1><div className="tags"><span className={`tag ${record.difficulty}`}>{record.difficulty}</span>{record.topics.map(topic => <span className="tag" key={topic}>{topic}</span>)}{record.archivedAt && <span className="tag">Archived</span>}</div></div><div className="row"><a className="button" href={record.url} target="_blank" rel="noopener noreferrer">Open LeetCode</a><button onClick={() => setEditing(true)}>Edit problem</button></div></div>
		<p className="prose">{record.summary}</p><div className="row"><a href={`/leetcode/problems/${id}/review`}>Recall this problem</a>{!record.archivedAt && <button onClick={archive}>Archive problem</button>}</div>
		{(error || attempts.error || current.error) && <p className="error" role="alert">{error || attempts.error || current.error}</p>}
		<div className="row spread"><label>Attempt history<select value={attemptId ?? ''} onChange={event => void choose(event.target.value)}><option value="" disabled>Select an attempt</option>{attempts.data?.items.map((attempt, index) => <option key={attempt.id} value={attempt.id}>{attempt.state === 'draft' ? 'Current draft' : `Saved attempt ${attempts.data!.items.length - index}`} - {new Date(attempt.createdAt).toLocaleString()}</option>)}</select></label>{user.role === 'student' && current.data?.state !== 'draft' && <div className="row"><button onClick={() => void start()}>Start another attempt</button>{current.data && <button onClick={() => void start(current.data!.id)}>Copy into new draft</button>}</div>}</div>
		{homework.data?.items.map(h => <article className="card card-pad stack" key={h.id}><h2><a href={`/leetcode/homework/${h.id}`}>Homework: {homeworkLabels[h.state]}</a></h2><p className="prose">{h.instructions}</p></article>)}
		{current.data ? <DraftEditor key={`${current.data.id}:${current.data.state}`} initial={current.data} user={user} registerGuard={register} nextReviewDate={record.nextReviewDate} homework={homework.data?.items[0]} saved={attempt => { setSelected(attempt.id); current.reload(); attempts.reload(); problem.reload(); homework.reload(); }} /> : <p className="empty">{attemptId ? 'Opening attempt...' : 'No attempts yet. Start an attempt to record your reasoning.'}</p>}
		<Discussion problemId={id} />
		<LessonLinks problemId={id} user={user} />
		{editing && <ProblemForm problem={record} close={() => setEditing(false)} saved={() => { setEditing(false); problem.reload(); }} />}
	</div>;
}
