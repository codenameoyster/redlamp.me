import { useCallback, useEffect, useRef, useState } from 'react';
import { newApproach, type Approach, type Attempt, type AttemptSummary, type DraftValue, type Homework, type HomeworkDetails, type Page, type Problem as ProblemRecord, type SessionUser } from '../shared/leetcode';
import { api, ApiError, message } from './api';
import { useResource } from './useResource';
import { useDraft, type LeaveGuard, type RegisterGuard } from './useDraft';
import { ProblemForm } from './Problems';
import { Discussion, homeworkLabels } from './Homework';
import { LessonLinks } from './Lessons';
import { addCalendarDays, localDate } from '../shared/dates';

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
	const [dateChanged, setDateChanged] = useState(false);
	const [failure, setFailure] = useState<{ action: 'save' | 'submit'; error: unknown } | null>(null);
	function changeDate(value: string) { setDate(value); setDateChanged(true); }
	const editable = user.role === 'student' && initial.state === 'draft';
	useEffect(() => { registerGuard(draft); return () => registerGuard(null); }, [draft.flush]);
	async function useServerCopy() { const server = await draft.reload(); if (server) saved(server); }
	async function finalize(action: 'save' | 'submit') {
		setBusy(true); setError(''); setFailure(null);
		const path = `/problems/${initial.problemId}/attempts/${initial.id}`;
		let persisted: Attempt | null = null;
		try {
			persisted = await draft.flush();
			if (!persisted) return;
			if (action === 'save') saved(await api<Attempt>(`${path}/save`, { method: 'POST', body: JSON.stringify({ version: persisted.version, ...(dateChanged ? { nextReviewDate: date || null } : {}) }) }));
			else {
				await api(`/homework/${homework!.id}/submit`, { method: 'POST', body: JSON.stringify({ version: homework!.version, attemptId: persisted.id, attemptVersion: persisted.version, ...(dateChanged ? { nextReviewDate: date || null } : {}) }) });
				saved(await api<Attempt>(path));
			}
		} catch (error) {
			if (error instanceof ApiError && error.status === 409 && persisted) {
				try {
					const server = await api<Attempt>(path);
					if (server.state === 'saved' && server.version === persisted.version + 1 && server.acceptance === persisted.acceptance && server.understanding === persisted.understanding && JSON.stringify(server.document) === JSON.stringify(persisted.document)) {
						const details = action === 'submit' ? await api<HomeworkDetails>(`/homework/${homework!.id}`) : null;
						if (!details || details.submissions.some(s => s.attemptId === server.id && s.homeworkVersion === homework!.version + 1)) { saved(server); return; }
					}
				} catch (readError) { error = readError; }
			}
			setFailure({ action, error });
		} finally { setBusy(false); }
	}
	const loginRequired = draft.status === 'login_required' || (failure?.error instanceof ApiError && failure.error.status === 401);
	return <div className="stack">
		{editable && <p role="status" aria-label="Save state" aria-live="polite">{{ saved: 'Saved', saving: 'Saving', unsaved: 'Not saved', conflict: 'Conflicting edits', login_required: 'Sign in to save' }[draft.status]}</p>}
		{draft.storageError && <p className="notice" role="status">{draft.storageError}</p>}
		{draft.recovery && <section className="notice stack" aria-label="Recovery copy"><p>{draft.recovery.attemptId === initial.id ? 'This tab has unsaved work.' : 'This tab has unsaved work from an earlier attempt. Copy it before you continue.'}</p>{draft.recovery.attemptId !== initial.id && <pre>{JSON.stringify(draft.recovery.value, null, 2)}</pre>}<div className="row">{draft.recovery.attemptId === initial.id && <button onClick={draft.recover}>Restore unsaved work</button>}<button onClick={async () => { try { await navigator.clipboard.writeText(JSON.stringify(draft.recovery!.value, null, 2)); } catch { setError('Select and copy the recovery text.'); } }}>Copy recovered work</button><button onClick={useServerCopy}>Use server copy</button></div></section>}
		{(error || failure || draft.error) && <div className="error" role="alert">{error || (failure ? message(failure.error) : draft.error)}<div className="row">{loginRequired ? <button onClick={draft.signIn}>Sign in again</button> : failure ? <button disabled={busy} onClick={() => void finalize(failure.action)}>{failure.action === 'save' ? 'Retry save attempt' : 'Retry submission'}</button> : !draft.conflict && <button onClick={() => void draft.flush()}>Retry save</button>}<button onClick={async () => { try { await navigator.clipboard.writeText(JSON.stringify(draft.value, null, 2)); } catch { setError('Select and copy your text from the editor.'); } }}>Copy unsaved work</button></div></div>}
		{draft.conflict && <section className="notice stack"><h2>Server copy</h2><p>Your editor still contains your local copy. Copy it before replacing it.</p><pre>{JSON.stringify(draft.conflict.document, null, 2)}</pre><button onClick={useServerCopy}>Use server copy</button></section>}
		<fieldset disabled={busy || Boolean(draft.recovery)}><AttemptContent value={draft.value} change={editable ? draft.change : undefined} /></fieldset>
		{editable && <div className="card card-pad stack"><div className="row spread"><label>Next review<input type="date" value={date} disabled={busy} onChange={event => changeDate(event.target.value)} /></label><button className="primary" disabled={busy || Boolean(draft.recovery)} onClick={() => void finalize('save')}>Save attempt</button></div>{draft.value.acceptance === 'accepted' && <div className="row"><span>Review reminder:</span><button type="button" disabled={busy} onClick={() => changeDate(addCalendarDays(localDate(), 1))}>Tomorrow</button><button type="button" disabled={busy} onClick={() => changeDate(addCalendarDays(localDate(), 3))}>In three days</button><button type="button" disabled={busy} onClick={() => changeDate(addCalendarDays(localDate(), 7))}>In seven days</button><button type="button" disabled={busy} onClick={() => changeDate('')}>Clear reminder</button></div>}</div>}
		{editable && homework && ['assigned', 'in_progress', 'changes_requested'].includes(homework.state) && <button className="primary" disabled={busy || Boolean(draft.recovery)} onClick={() => void finalize('submit')}>Submit for review</button>}
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
		{current.data ? <DraftEditor key={`${current.data.id}:${current.data.state}`} initial={current.data} user={user} registerGuard={register} nextReviewDate={record.nextReviewDate} homework={homework.data?.items[0]} saved={attempt => { setSelected(attempt.id); current.setData(attempt); attempts.reload(); problem.reload(); homework.reload(); }} /> : <p className="empty">{attemptId ? 'Opening attempt...' : 'No attempts yet. Start an attempt to record your reasoning.'}</p>}
		<Discussion problemId={id} />
		<LessonLinks problemId={id} user={user} />
		{editing && <ProblemForm problem={record} close={() => setEditing(false)} saved={() => { setEditing(false); problem.reload(); }} />}
	</div>;
}
