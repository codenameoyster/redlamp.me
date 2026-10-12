import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Approach, Attempt, AttemptSummary, ChapterRef, DraftValue, Feedback, HomeworkTask, Page, Problem, ProblemTests, SessionUser, TaskDetails, TestRun } from '../shared/leetcode';
import { api, ApiError, message } from './api';
import { useResource } from './useResource';
import { useDraft, type LeaveGuard, type RegisterGuard } from './useDraft';
import { difficultyLabels, ProblemForm } from './Problems';
import { homeworkLabels } from './Homework';
import { Materials } from './Materials';
import { Lesson } from './Sets';
import { CodeField } from './Code';
import { Tutor } from './Tutor';
import { OwnTests, Runner } from './Runner';
import { addCalendarDays, localDate } from '../shared/dates';

export const understandingLabels = { needs_practice: 'Нужно потренироваться', with_help: 'Решил с подсказкой', independent: 'Решил сам' };
export const acceptanceLabels = { not_submitted: 'Не отправлял', not_accepted: 'Не принято', accepted: 'Принято на LeetCode' };
const fields = [{ key: 'idea', label: 'Основная идея' }, { key: 'correctness', label: 'Почему это работает' }, { key: 'edgeCases', label: 'Крайние случаи' }, { key: 'mistakes', label: 'Ошибки и выводы' }] as const;

function Panes({ left, right }: { left: ReactNode; right: ReactNode }) {
	const [split, setSplit] = useState(() => { try { return Number(localStorage.getItem('leetcode:panes')) || 50; } catch { return 50; } });
	function move(value: number) {
		const next = Math.round(Math.min(75, Math.max(25, value)));
		setSplit(next);
		try { localStorage.setItem('leetcode:panes', String(next)); } catch { /* The width stays for this page. */ }
	}
	return <div className="panes" style={{ '--split': `${split}%` } as CSSProperties}>
		<div className="pane">{left}</div>
		<div className="divider" role="separator" aria-label="Граница панелей" aria-orientation="vertical" aria-valuenow={split} aria-valuemin={25} aria-valuemax={75} tabIndex={0}
			onKeyDown={event => { const step = event.key === 'ArrowLeft' ? -5 : event.key === 'ArrowRight' ? 5 : 0; if (step) { event.preventDefault(); move(split + step); } }}
			onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); }}
			onPointerMove={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; const box = event.currentTarget.parentElement!.getBoundingClientRect(); move((event.clientX - box.left) / box.width * 100); }} />
		<div className="pane">{right}</div>
	</div>;
}

// Only the first approach is shown. Attempts from before the work window can hold more.
export function AttemptContent({ value, change, chapter, tests, skeleton, runs, record, children }: { value: DraftValue; change?: (next: DraftValue) => void; chapter?: ReactNode; tests?: ProblemTests; skeleton?: string; runs?: TestRun[]; record?: (approachId: string, run: Pick<TestRun, 'passed' | 'total' | 'codeHash'>) => Promise<void>; children?: ReactNode }) {
	const [copyState, setCopyState] = useState('');
	const approach = value.document.approaches[0];
	function update(patch: Partial<Approach>) { change?.({ ...value, document: { ...value.document, approaches: value.document.approaches.map((a, index) => index ? a : { ...a, ...patch }) } }); }
	useEffect(() => { if (skeleton && !approach.code.trim()) update({ code: skeleton, language: 'python3' }); }, [skeleton]);
	const notes = <div className="stack">
		<div className="row"><label>Статус на LeetCode<select value={value.acceptance} disabled={!change} onChange={event => change?.({ ...value, acceptance: event.target.value as DraftValue['acceptance'] })}>{Object.entries(acceptanceLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Понимание<select value={value.understanding} disabled={!change} onChange={event => change?.({ ...value, understanding: event.target.value as DraftValue['understanding'] })}>{Object.entries(understandingLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
		<label>Общие заметки<textarea aria-label="Общие заметки" value={value.document.notes} readOnly={!change} onChange={event => change?.({ ...value, document: { ...value.document, notes: event.target.value } })} /></label>
		{fields.map(field => <label key={field.key}>{field.label}<textarea aria-label={field.label} value={approach[field.key]} readOnly={!change} onChange={event => update({ [field.key]: event.target.value })} /></label>)}
		<div className="editor-grid"><label>Время<input value={approach.timeComplexity} readOnly={!change} onChange={event => update({ timeComplexity: event.target.value })} /></label><label>Память<input value={approach.spaceComplexity} readOnly={!change} onChange={event => update({ spaceComplexity: event.target.value })} /></label></div>
	</div>;
	const code = <div className="stack"><label>Код решения<CodeField language="python" value={approach.code} readOnly={!change} onChange={code => update({ code, language: 'python3' })} /></label><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(approach.code); setCopyState('Код скопирован.'); } catch { setCopyState('Выделите и скопируйте код вручную.'); } }}>Скопировать код</button>{copyState && <p role="status">{copyState}</p>}
		{tests && <Runner code={approach.code} tests={tests} live={Boolean(change)} latest={runs?.find(run => run.approachId === approach.id)} record={record && (run => record(approach.id, run))} />}{children}</div>;
	return <div className="stack"><Panes left={chapter ?? notes} right={code} />{chapter && notes}</div>;
}

export function DraftEditor({ initial, user, registerGuard, saved, nextReviewDate, task, reloadTask, chapter }: { initial: Attempt; user: SessionUser; registerGuard: RegisterGuard; saved: (attempt: Attempt, action?: 'save' | 'submit') => Promise<void>; nextReviewDate: string | null; task?: HomeworkTask; reloadTask: () => void; chapter?: ReactNode }) {
	const draft = useDraft(initial, user);
	const tests = useResource<ProblemTests>(`/problems/${initial.problemId}/tests`);
	const runs = useResource<TestRun[]>(`/problems/${initial.problemId}/runs?attemptId=${initial.id}`);
	const [busy, setBusy] = useState(false), [error, setError] = useState(''), [date, setDate] = useState(nextReviewDate ?? '');
	const [dateChanged, setDateChanged] = useState(false);
	const [failure, setFailure] = useState<{ action: 'save' | 'submit'; error: unknown } | null>(null);
	function changeDate(value: string) { setDate(value); setDateChanged(true); }
	const editable = user.role === 'student' && initial.state === 'draft';
	const submittable = editable && task && ['assigned', 'in_progress', 'changes_requested'].includes(task.state);
	useEffect(() => { registerGuard(draft); return () => registerGuard(null); }, [draft.flush]);
	async function useServerCopy() { const server = await draft.reload(); if (server) await saved(server); }
	async function finalize(action: 'save' | 'submit') {
		setBusy(true); setError(''); setFailure(null);
		const path = `/problems/${initial.problemId}/attempts/${initial.id}`;
		let persisted: Attempt | null = null;
		try {
			persisted = await draft.flush();
			if (!persisted) return;
			if (action === 'save') await saved(await api<Attempt>(`${path}/save`, { method: 'POST', body: JSON.stringify({ version: persisted.version, ...(dateChanged ? { nextReviewDate: date || null } : {}) }) }), action);
			else {
				await api(`/tasks/${task!.id}/submit`, { method: 'POST', body: JSON.stringify({ version: task!.version, attemptId: persisted.id, attemptVersion: persisted.version, ...(dateChanged ? { nextReviewDate: date || null } : {}) }) });
				await saved(await api<Attempt>(path), action);
			}
		} catch (error) {
			if (error instanceof ApiError && error.status === 409 && persisted) {
				try {
					const server = await api<Attempt>(path);
					if (server.state === 'saved' && server.version === persisted.version + 1 && server.acceptance === persisted.acceptance && server.understanding === persisted.understanding && JSON.stringify(server.document) === JSON.stringify(persisted.document)) {
						const details = action === 'submit' ? await api<TaskDetails>(`/tasks/${task!.id}`) : null;
						if (!details || details.submissions.some(s => s.attemptId === server.id && s.taskVersion === task!.version + 1)) { await saved(server, action); return; }
					}
					if (server.version !== persisted.version) { draft.conflicted(server); return; }
					if (action === 'submit') reloadTask();
				} catch (readError) { error = readError; }
			}
			setFailure({ action, error });
		} finally { setBusy(false); }
	}
	async function record(approachId: string, run: Pick<TestRun, 'passed' | 'total' | 'codeHash'>) { await api(`/problems/${initial.problemId}/runs`, { method: 'POST', body: JSON.stringify({ attemptId: initial.id, approachId, ...run, runOn: localDate() }) }); runs.reload(); }
	async function copyWork() { try { await navigator.clipboard.writeText(JSON.stringify(draft.value, null, 2)); } catch { setError('Выделите и скопируйте текст из редактора вручную.'); } }
	const loginRequired = draft.status === 'login_required' || (failure?.error instanceof ApiError && failure.error.status === 401);
	// The starter code waits for the recovery choice, so it does not replace the recovery copy in the session storage.
	const skeleton = draft.recovery ? undefined : tests.data?.skeleton;
	return <div className="stack">
		{editable && <p role="status" aria-label="Состояние сохранения" aria-live="polite">{{ saved: 'Сохранено', saving: 'Сохраняем', unsaved: 'Не сохранено', conflict: 'Конфликт правок', login_required: 'Войдите, чтобы сохранить' }[draft.status]}</p>}
		{draft.storageError && <p className="notice" role="status">{draft.storageError}</p>}
		{draft.recovery && <section className="notice stack" aria-label="Копия для восстановления"><p>{draft.recovery.attemptId === initial.id ? 'В этой вкладке есть несохранённая работа.' : 'В этой вкладке есть несохранённая работа из прошлой попытки. Скопируйте её, прежде чем продолжить.'}</p>{draft.recovery.attemptId !== initial.id && <pre>{JSON.stringify(draft.recovery.value, null, 2)}</pre>}<div className="row">{draft.recovery.attemptId === initial.id && <button onClick={draft.recover}>Восстановить несохранённую работу</button>}<button onClick={async () => { try { await navigator.clipboard.writeText(JSON.stringify(draft.recovery!.value, null, 2)); } catch { setError('Выделите и скопируйте текст для восстановления вручную.'); } }}>Скопировать восстановленную работу</button><button onClick={useServerCopy}>Использовать копию с сервера</button></div></section>}
		{(error || failure || draft.error) && <div className="error" role="alert">{error || (failure ? message(failure.error) : draft.error)}<div className="row">{loginRequired ? <button onClick={draft.signIn}>Войти снова</button> : failure ? (failure.action === 'save' || submittable) && <button disabled={busy} onClick={() => void finalize(failure.action)}>{failure.action === 'save' ? 'Повторить сохранение попытки' : 'Повторить отправку'}</button> : !draft.conflict && <button onClick={() => void draft.flush()}>Повторить сохранение</button>}{!draft.conflict && <button onClick={copyWork}>Скопировать несохранённую работу</button>}</div></div>}
		{draft.conflict && <section className="notice stack"><h2>Копия с сервера</h2><p>В редакторе осталась ваша локальная копия. Скопируйте её, прежде чем заменить.</p><pre>{JSON.stringify(draft.conflict.document, null, 2)}</pre><div className="row"><button onClick={copyWork}>Скопировать несохранённую работу</button><button onClick={useServerCopy}>Использовать копию с сервера</button></div></section>}
		<fieldset disabled={busy || Boolean(draft.recovery)}><AttemptContent value={draft.value} change={editable ? draft.change : undefined} chapter={chapter} tests={tests.data ?? undefined} skeleton={skeleton} runs={runs.data ?? undefined} record={user.role === 'student' ? record : undefined}>
			{task && user.role === 'student' && <button className="primary" disabled={!submittable} onClick={() => void finalize('submit')}>Отправить на проверку</button>}
			{tests.data?.spec && <OwnTests problemId={initial.problemId} tests={tests.data} changed={tests.reload} />}
		</AttemptContent></fieldset>
		{editable && <div className="card card-pad stack"><div className="row spread"><label>Следующее повторение<input type="date" value={date} disabled={busy} onChange={event => changeDate(event.target.value)} /></label><button className="primary" disabled={busy || Boolean(draft.recovery)} onClick={() => void finalize('save')}>Сохранить попытку</button></div>{draft.value.acceptance === 'accepted' && <div className="row"><span>Напоминание:</span><button type="button" disabled={busy} onClick={() => changeDate(addCalendarDays(localDate(), 1))}>Завтра</button><button type="button" disabled={busy} onClick={() => changeDate(addCalendarDays(localDate(), 3))}>Через три дня</button><button type="button" disabled={busy} onClick={() => changeDate(addCalendarDays(localDate(), 7))}>Через семь дней</button><button type="button" disabled={busy} onClick={() => changeDate('')}>Без напоминания</button></div>}</div>}
	</div>;
}

// The window of a library problem (problemId) or of a homework task (taskId).
export function Workspace({ problemId, taskId, user, registerGuard }: { problemId?: string; taskId?: string; user: SessionUser; registerGuard: RegisterGuard }) {
	const details = useResource<TaskDetails>(taskId ? `/tasks/${taskId}` : null), task = details.data?.task;
	const id = problemId ?? task?.problemId, student = user.role === 'student';
	const problem = useResource<Problem>(id ? `/problems/${id}` : null);
	const attempts = useResource<Page<AttemptSummary>>(id ? `/problems/${id}/attempts` : null);
	const tasks = useResource<Page<HomeworkTask>>(problemId ? `/tasks?problemId=${problemId}&active=1` : null);
	// The first page also records the read marker of the unread dot.
	const reviews = useResource<Page<Feedback>>(task ? `/problems/${task.problemId}/feedback` : null, task?.version);
	const chapter = useResource<{ chapters: ChapterRef[] }>(id ? `/problems/${id}/sets` : null).data?.chapters[0];
	const lesson = useResource<{ html: string }>(chapter ? `/sets/${chapter.set}/lesson/${chapter.number}` : null);
	// A submitted or completed task shows the submitted attempt. Otherwise the student works in the draft and the parent reads the newest attempt.
	const frozen = task && ['submitted', 'completed'].includes(task.state) ? details.data!.submissions.find(s => s.id === task.submissionId)?.attemptId : undefined;
	const [work, setWork] = useState<string>(), latest = attempts.data?.items[0], attemptId = frozen ?? (student ? work : latest?.id);
	const current = useResource<Attempt>(id && attemptId ? `/problems/${id}/attempts/${attemptId}` : null);
	const [editing, setEditing] = useState(false), [feedback, setFeedback] = useState(''), [notice, setNotice] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
	const guard = useRef<LeaveGuard | null>(null), article = useRef<HTMLElement>(null);
	const register = useCallback<RegisterGuard>(value => { guard.current = value; registerGuard(value); }, [registerGuard]);
	async function open(copyAttemptId?: string) {
		try { setWork((await api<Attempt>(`/problems/${id}/attempts`, { method: 'POST', body: JSON.stringify(copyAttemptId ? { copyAttemptId } : {}) })).id); }
		catch (error) { if (error instanceof ApiError && error.fields?.attemptId) setWork(error.fields.attemptId); else setError(message(error)); }
	}
	// Opening an assigned task starts it. A failed start keeps the task assigned, and the submit still works.
	useEffect(() => { if (student && task?.state === 'assigned') void api(`/tasks/${task.id}/start`, { method: 'POST', body: JSON.stringify({ version: task.version }) }).then(details.reload, details.reload); }, [task?.state]);
	// The student works in the draft, else in a new draft that copies the newest saved attempt, else in a new empty draft.
	const ready = student && !work && !frozen && Boolean(attempts.data) && (!taskId || Boolean(task));
	useEffect(() => { if (ready) { if (latest?.state === 'draft') setWork(latest.id); else void open(latest?.id); } }, [ready]);
	async function saved(attempt: Attempt, action?: 'save' | 'submit') {
		problem.reload(); details.reload();
		if (action === 'submit' || attempt.state === 'draft') return current.setData(attempt);
		await open(attempt.id);
		if (action) setNotice('Попытка сохранена.');
	}
	async function act(name: string, extra: Record<string, unknown> = {}) {
		setBusy(true); setError('');
		try { await api(`/tasks/${task!.id}/${name}`, { method: 'POST', body: JSON.stringify({ version: task!.version, ...extra }) }); details.reload(); }
		catch (error) { setError(message(error)); } finally { setBusy(false); }
	}
	async function archive() {
		if (guard.current && !(await guard.current.flush())) return;
		if (!confirm('Отправить задачу в архив? Её можно вернуть позже.')) return;
		setError('');
		try { await api(`/problems/${id}/archive`, { method: 'POST', body: JSON.stringify({ version: problem.data!.version }) }); problem.reload(); } catch (error) { setError(message(error)); }
	}
	async function restore() {
		setError('');
		try { await api(`/problems/${id}/restore`, { method: 'POST', body: JSON.stringify({ version: problem.data!.version }) }); problem.reload(); } catch (error) { setError(message(error)); }
	}
	const record = problem.data;
	if (!record) return <p role="status">{details.error || problem.error || 'Открываем задачу...'}</p>;
	const review = reviews.data?.items.find(f => f.taskId === task?.id && f.kind !== 'reply');
	const chapterPane = chapter && lesson.data && <section className="stack"><h2><a href={`/leetcode/sets/${chapter.set}/${chapter.number}`}>Глава {chapter.number}. {chapter.title}</a></h2><Lesson html={lesson.data.html} ref={article} /></section>;
	return <div className="stack">
		<div className="heading"><div>{task && <p className="small"><a href={`/leetcode/homework/${task.homeworkId}`}>{task.homeworkTitle}</a></p>}<h1>{record.title}</h1><div className="tags"><span className={`tag ${record.difficulty}`}>{difficultyLabels[record.difficulty]}</span>{task && <><span className="tag">{homeworkLabels[task.state]}</span><span className="small">{task.dueDate ? `Срок: ${task.dueDate}` : 'Без срока'}</span></>}{record.topics.map(topic => <span className="tag" key={topic}>{topic}</span>)}{record.archivedAt && <span className="tag">В архиве</span>}</div></div>
			<div className="row"><a href={record.url} target="_blank" rel="noopener noreferrer">{record.slug.startsWith('cf-') ? 'Codeforces' : 'LeetCode'} ↗</a><Tutor context={{ kind: 'problem', id: record.id }} title={record.title} user={user} flush={() => guard.current?.flush()} lesson={chapterPane && current.data ? article : undefined} />{!task && <button onClick={() => setEditing(true)}>Изменить задачу</button>}{user.role === 'parent' && task && !['completed', 'cancelled'].includes(task.state) && <button disabled={busy} onClick={() => { if (confirm('Отменить это задание?')) void act('cancel'); }}>Отменить задание</button>}</div></div>
		<p className="prose">{record.summary}</p>
		{task?.instructions && <p className="prose">{task.instructions}</p>}
		{review && <p className="notice">{review.kind === 'completed' ? 'Завершено' : 'Нужны правки'}{review.body && `: ${review.body}`}</p>}
		{!task && <div className="row"><a href={`/leetcode/problems/${record.id}/review`}>Повторить задачу</a>{record.archivedAt ? <button onClick={restore}>Вернуть из архива</button> : <button onClick={archive}>В архив</button>}{tasks.data?.items.map(t => <a key={t.id} href={`/leetcode/tasks/${t.id}`}>{t.homeworkTitle}</a>)}</div>}
		{(error || attempts.error || current.error || reviews.error) && <p className="error" role="alert">{error || attempts.error || current.error || reviews.error}</p>}
		{current.data ? <DraftEditor key={`${current.data.id}:${current.data.state}`} initial={current.data} user={user} registerGuard={register} nextReviewDate={record.nextReviewDate} task={task} reloadTask={details.reload} saved={saved} chapter={chapterPane} /> : <p className="empty">{!student && attempts.data?.items.length === 0 ? 'Ученик ещё не начал работу.' : 'Открываем работу...'}</p>}
		{notice && <p role="status">{notice}</p>}
		{user.role === 'parent' && task?.state === 'submitted' && <section className="card card-pad stack"><h2>Проверка отправки</h2><label>Отзыв<textarea aria-label="Отзыв" value={feedback} onChange={event => setFeedback(event.target.value)} maxLength={8000} /></label><div className="row"><button disabled={busy} onClick={() => void act('review', { submissionId: task.submissionId, decision: 'changes_requested', body: feedback })}>Вернуть на доработку</button><button className="primary" disabled={busy} onClick={() => void act('review', { submissionId: task.submissionId, decision: 'completed', body: feedback })}>Завершить</button></div></section>}
		<Materials problemId={record.id} homework={details.data?.homework} user={user} changed={details.reload} />
		{editing && <ProblemForm problem={record} close={() => setEditing(false)} saved={() => { setEditing(false); problem.reload(); }} />}
	</div>;
}
