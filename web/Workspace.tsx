import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Approach, Attempt, AttemptSummary, ChapterRef, DraftValue, Feedback, Figure, HomeworkTask, JudgeOutput, Judgement, Page, Problem, ProblemTests, SessionUser, TaskDetails, TestRun } from '../shared/leetcode';
import { api, ApiError, message } from './api';
import { useResource } from './useResource';
import { useDraft, type LeaveGuard, type RegisterGuard } from './useDraft';
import { difficultyLabels, ProblemForm } from './Problems';
import { homeworkLabels } from './Homework';
import { Materials } from './Materials';
import { Lesson } from './Sets';
import { CodeField } from './Code';
import { Tutor } from './Tutor';
import { Dictation } from './Dictation';
import { Failure, OwnTests, Runner } from './Runner';
import { runTests } from './python';
import { localDate } from '../shared/dates';

export const understandingLabels = { needs_practice: 'Нужно потренироваться', with_help: 'Решил с подсказкой', independent: 'Решил сам' };
const fields = [{ key: 'idea', label: 'Основная идея' }, { key: 'correctness', label: 'Почему это работает' }, { key: 'edgeCases', label: 'Крайние случаи' }, { key: 'mistakes', label: 'Ошибки и выводы' }] as const;

function Panes({ left, right }: { left: ReactNode; right: ReactNode }) {
	const [split, setSplit] = useState(() => { try { return Number(localStorage.getItem('leetcode:panes')) || 50; } catch { return 50; } });
	function move(value: number) {
		const next = Math.round(Math.min(75, Math.max(25, value)));
		setSplit(next);
		try { localStorage.setItem('leetcode:panes', String(next)); } catch { /* The width stays for this page. */ }
	}
	// The pointer holds the middle of the divider, 9px right of the left pane: the 6px gap and half of the 6px divider.
	return <div className="panes" style={{ '--split': `${split}%` } as CSSProperties}>
		<div className="pane">{left}</div>
		<div className="divider" role="separator" aria-label="Граница панелей" aria-orientation="vertical" aria-valuenow={split} aria-valuemin={25} aria-valuemax={75} tabIndex={0}
			onKeyDown={event => { const step = event.key === 'ArrowLeft' ? -5 : event.key === 'ArrowRight' ? 5 : 0; if (step) { event.preventDefault(); move(split + step); } }}
			onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); }}
			onPointerMove={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; const box = event.currentTarget.parentElement!.getBoundingClientRect(); move((event.clientX - box.left - 9) / box.width * 100); }} />
		<div className="pane">{right}</div>
	</div>;
}

// Only the first approach is shown. Attempts from before the work window can hold more.
export function AttemptContent({ value, change, chapter, problemId, tests, skeleton, runs, record, children }: { value: DraftValue; change?: (next: DraftValue) => void; chapter?: ReactNode; problemId?: string; tests?: ProblemTests; skeleton?: string; runs?: TestRun[]; record?: (approachId: string, run: Pick<TestRun, 'passed' | 'total' | 'codeHash'>) => Promise<void>; children?: ReactNode }) {
	const [copyState, setCopyState] = useState('');
	const approach = value.document.approaches[0];
	function update(patch: Partial<Approach>) { change?.({ ...value, document: { ...value.document, approaches: value.document.approaches.map((a, index) => index ? a : { ...a, ...patch }) } }); }
	useEffect(() => { if (skeleton && !approach.code.trim()) update({ code: skeleton, language: 'python3' }); }, [skeleton]);
	const notes = <div className="stack">
		<label>Общие заметки<textarea aria-label="Общие заметки" value={value.document.notes} readOnly={!change} onChange={event => change?.({ ...value, document: { ...value.document, notes: event.target.value } })} />{change && <Dictation />}</label>
		{fields.map(field => <label key={field.key}>{field.label}<textarea aria-label={field.label} value={approach[field.key]} readOnly={!change} onChange={event => update({ [field.key]: event.target.value })} />{change && <Dictation />}</label>)}
		<div className="editor-grid"><label>Время<input value={approach.timeComplexity} readOnly={!change} onChange={event => update({ timeComplexity: event.target.value })} /></label><label>Память<input value={approach.spaceComplexity} readOnly={!change} onChange={event => update({ spaceComplexity: event.target.value })} /></label></div>
	</div>;
	const code = <div className="stack"><label>Код решения<CodeField language="python" value={approach.code} readOnly={!change} onChange={code => update({ code, language: 'python3' })} /></label><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(approach.code); setCopyState('Код скопирован.'); } catch { setCopyState('Выделите и скопируйте код вручную.'); } }} data-tip="Скопировать код решения в буфер обмена.">Скопировать код</button>{copyState && <p role="status">{copyState}</p>}
		{tests && problemId && <Runner problemId={problemId} code={approach.code} tests={tests} live={Boolean(change)} latest={runs?.find(run => run.approachId === approach.id)} record={record && (run => record(approach.id, run))} />}{children}</div>;
	return <div className="stack"><Panes left={chapter ?? notes} right={code} />{chapter && notes}</div>;
}

export function DraftEditor({ initial, user, registerGuard, saved, task, chapter, onCode, notice }: { initial: Attempt; user: SessionUser; registerGuard: RegisterGuard; saved: (attempt: Attempt, action?: 'save' | 'submit' | 'judge') => Promise<void>; task?: HomeworkTask; chapter?: ReactNode; onCode: (code: string) => void; notice?: ReactNode }) {
	const draft = useDraft(initial, user), code = draft.value.document.approaches[0].code;
	useEffect(() => onCode(code), [code]);
	const tests = useResource<ProblemTests>(`/problems/${initial.problemId}/tests`);
	const runs = useResource<TestRun[]>(`/problems/${initial.problemId}/runs?attemptId=${initial.id}`);
	const [busy, setBusy] = useState(false), [error, setError] = useState(''), [progress, setProgress] = useState(''), [judgement, setJudgement] = useState<Judgement | null>(null), [practice, setPractice] = useState('');
	const editable = user.role === 'student' && initial.state === 'draft';
	const submittable = editable && task && ['assigned', 'in_progress', 'changes_requested'].includes(task.state);
	useEffect(() => { registerGuard(draft); return () => registerGuard(null); }, [draft.flush]);
	async function useServerCopy() { const server = await draft.reload(); if (server) await saved(server); }
	// The server saves the attempt as accepted. An active homework task goes to the parent for review.
	async function solve() {
		setBusy(true); setError('');
		try {
			const persisted = await draft.flush();
			if (persisted) await saved(await api<Attempt>(`/problems/${initial.problemId}/solved`, { method: 'POST', body: JSON.stringify({ attemptId: persisted.id }) }), submittable ? 'submit' : 'save');
		} catch (error) { setError(message(error)); } finally { setBusy(false); }
	}
	async function repeat() {
		setBusy(true); setError('');
		try { const { nextReviewDate: day } = await api<{ nextReviewDate: string }>(`/problems/${initial.problemId}/practice`, { method: 'POST', body: JSON.stringify({ today: localDate() }) }); setPractice(`Повторим ${day.slice(8)}.${day.slice(5, 7)}.`); }
		catch (error) { setError(message(error)); } finally { setBusy(false); }
	}
	// The server gives the hidden inputs and compares the outputs with its reference solution. The saved code runs here, 3 seconds for each input.
	// The first failed test gives the verdict, so the run stops at the first timeout or error. The server refuses an output over 1,000,000 characters, and a correct answer is shorter.
	async function send() {
		setBusy(true); setError(''); setJudgement(null);
		const path = `/problems/${initial.problemId}`;
		try {
			const persisted = await draft.flush();
			if (!persisted) return;
			const { seed, inputs } = await api<{ seed: number; inputs: string[] }>(`${path}/judge/start`, { method: 'POST' }), outputs: JudgeOutput[] = [];
			setProgress(`Проверяем: 0 из ${inputs.length}`);
			await runTests(persisted.document.approaches[0].code, tests.data!.spec!, inputs.map(input => ({ input, expected: null })), result => {
				outputs.push(result.timeout ? { timeout: true } : result.error ? { error: `${result.error.line ? `Строка ${result.error.line}: ` : ''}${result.error.message}`.slice(0, 1_000_000) } : { value: result.output.slice(0, 1_000_000) });
				setProgress(`Проверяем: ${outputs.length} из ${inputs.length}`);
				return Boolean(result.timeout || result.error);
			}, 3);
			while (outputs.length < inputs.length) outputs.push({ timeout: true });
			const value = await api<Judgement>(`${path}/judge`, { method: 'POST', body: JSON.stringify({ seed, attemptId: persisted.id, outputs }) });
			if (value.failed) setJudgement(value); else await saved(await api<Attempt>(`${path}/attempts/${persisted.id}`), 'judge');
		} catch (error) { setError(message(error)); } finally { setBusy(false); setProgress(''); }
	}
	async function record(approachId: string, run: Pick<TestRun, 'passed' | 'total' | 'codeHash'>) { await api(`/problems/${initial.problemId}/runs`, { method: 'POST', body: JSON.stringify({ attemptId: initial.id, approachId, ...run, runOn: localDate() }) }); runs.reload(); }
	async function copyWork() { try { await navigator.clipboard.writeText(JSON.stringify(draft.value, null, 2)); } catch { setError('Выделите и скопируйте текст из редактора вручную.'); } }
	// The starter code waits for the recovery choice, so it does not replace the recovery copy in the session storage.
	const skeleton = draft.recovery ? undefined : tests.data?.skeleton;
	// The tip of a button shows below it, so a result line is beside its button and the failed test is above the button.
	const finish = editable && tests.data && (tests.data.source === 'set' ? <button type="button" className="primary" onClick={() => void send()} data-tip="Проверить решение на скрытых тестах. Если всё верно, задача засчитывается.">Отправить</button> : <button type="button" className="primary" onClick={() => void solve()} data-tip={submittable ? 'Засчитать задачу и отправить задание родителю на проверку.' : 'Засчитать задачу как решённую.'}>Решено</button>);
	const status = progress || (judgement ? '' : notice);
	return <div className="stack">
		{editable && <p role="status" aria-label="Состояние сохранения" aria-live="polite">{{ saved: 'Сохранено', saving: 'Сохраняем', unsaved: 'Не сохранено', conflict: 'Конфликт правок', login_required: 'Войдите, чтобы сохранить' }[draft.status]}</p>}
		{draft.storageError && <p className="notice" role="status">{draft.storageError}</p>}
		{draft.recovery && <section className="notice stack" aria-label="Копия для восстановления"><p>{draft.recovery.attemptId === initial.id ? 'В этой вкладке есть несохранённая работа.' : 'В этой вкладке есть несохранённая работа из прошлой попытки. Скопируйте её, прежде чем продолжить.'}</p>{draft.recovery.attemptId !== initial.id && <pre>{JSON.stringify(draft.recovery.value, null, 2)}</pre>}<div className="row">{draft.recovery.attemptId === initial.id && <button onClick={draft.recover} data-tip="Вернуть в редактор работу, которая не успела сохраниться.">Восстановить несохранённую работу</button>}<button onClick={async () => { try { await navigator.clipboard.writeText(JSON.stringify(draft.recovery!.value, null, 2)); } catch { setError('Выделите и скопируйте текст для восстановления вручную.'); } }} data-tip="Скопировать копию для восстановления в буфер обмена.">Скопировать восстановленную работу</button><button onClick={useServerCopy} data-tip="Заменить работу в редакторе копией с сервера.">Использовать копию с сервера</button></div></section>}
		{(error || draft.error) && <div className="error" role="alert">{error || draft.error}<div className="row">{draft.status === 'login_required' ? <button onClick={draft.signIn} data-tip="Войти снова, чтобы сохранить работу.">Войти снова</button> : !draft.conflict && <button onClick={() => void draft.flush()} data-tip="Попробовать сохранить работу ещё раз.">Повторить сохранение</button>}{!draft.conflict && <button onClick={copyWork} data-tip="Скопировать работу из редактора в буфер обмена.">Скопировать несохранённую работу</button>}</div></div>}
		{draft.conflict && <section className="notice stack"><h2>Копия с сервера</h2><p>В редакторе осталась ваша локальная копия. Скопируйте её, прежде чем заменить.</p><pre>{JSON.stringify(draft.conflict.document, null, 2)}</pre><div className="row"><button onClick={copyWork} data-tip="Скопировать работу из редактора в буфер обмена.">Скопировать несохранённую работу</button><button onClick={useServerCopy} data-tip="Заменить работу в редакторе копией с сервера.">Использовать копию с сервера</button></div></section>}
		<fieldset disabled={busy || Boolean(draft.recovery)}><AttemptContent value={draft.value} change={editable ? draft.change : undefined} chapter={chapter} problemId={initial.problemId} tests={tests.data ?? undefined} skeleton={skeleton} runs={runs.data ?? undefined} record={user.role === 'student' ? record : undefined}>
			{judgement?.failed && <Failure {...judgement} />}
			{(finish || status) && <div className="row">{finish}{status && <p role="status">{status}</p>}</div>}
			<div className="row"><button type="button" onClick={() => void repeat()} data-tip="Отметить, что задачу нужно потренировать, и назначить повторение.">Нужно потренироваться</button>{practice && <p role="status">{practice}</p>}</div>
			{tests.data?.spec && <OwnTests problemId={initial.problemId} tests={tests.data} changed={tests.reload} />}
		</AttemptContent></fieldset>
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
	const lesson = useResource<{ html: string; figures: Figure[] }>(chapter ? `/sets/${chapter.set}/lesson/${chapter.number}` : null);
	const statement = useResource<{ html: string | null; text: string | null }>(id ? `/problems/${id}/statement` : null).data;
	// A submitted or completed task shows the submitted attempt. Otherwise the student works in the draft and the parent reads the newest attempt.
	const frozen = task && ['submitted', 'completed'].includes(task.state) ? details.data!.submissions.find(s => s.id === task.submissionId)?.attemptId : undefined;
	const [work, setWork] = useState<string>(), latest = attempts.data?.items[0], attemptId = frozen ?? (student ? work : latest?.id);
	const current = useResource<Attempt>(id && attemptId ? `/problems/${id}/attempts/${attemptId}` : null);
	const [editing, setEditing] = useState(false), [code, setCode] = useState(''), [feedback, setFeedback] = useState(''), [notice, setNotice] = useState<ReactNode>(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
	const guard = useRef<LeaveGuard | null>(null), article = useRef<HTMLElement>(null);
	const register = useCallback<RegisterGuard>(value => { guard.current = value; registerGuard(value); }, [registerGuard]);
	// The new attempt shows at once, so the page does not get shorter and keeps its scroll position.
	async function open(copyAttemptId?: string) {
		try { const attempt = await api<Attempt>(`/problems/${id}/attempts`, { method: 'POST', body: JSON.stringify(copyAttemptId ? { copyAttemptId } : {}) }); current.setData(attempt, `/problems/${id}/attempts/${attempt.id}`); setWork(attempt.id); }
		catch (error) { if (error instanceof ApiError && error.fields?.attemptId) setWork(error.fields.attemptId); else setError(message(error)); }
	}
	// Opening an assigned task starts it. A failed start keeps the task assigned, and the submit still works.
	useEffect(() => { if (student && task?.state === 'assigned') void api(`/tasks/${task.id}/start`, { method: 'POST', body: JSON.stringify({ version: task.version }) }).then(details.reload, details.reload); }, [task?.state]);
	// The student works in the draft, else in a new draft that copies the newest saved attempt, else in a new empty draft.
	const ready = student && !work && !frozen && Boolean(attempts.data) && (!taskId || Boolean(task));
	useEffect(() => { if (ready) { if (latest?.state === 'draft') setWork(latest.id); else void open(latest?.id); } }, [ready]);
	async function saved(attempt: Attempt, action?: 'save' | 'submit' | 'judge') {
		problem.reload(); details.reload();
		if (action === 'submit' || attempt.state === 'draft') return current.setData(attempt);
		await open(attempt.id);
		if (action) setNotice(action === 'judge' ? <span className="tag good">Принято</span> : 'Попытка сохранена.');
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
	const chapterPane = chapter && lesson.data && <section className="stack"><h2><a href={`/leetcode/sets/${chapter.set}/${chapter.number}`}>Глава {chapter.number}. {chapter.title}</a></h2><Lesson html={lesson.data.html} figures={lesson.data.figures} ref={article} /></section>;
	return <div className="stack">
		<div className="heading"><div>{task && <p className="small"><a href={`/leetcode/homework/${task.homeworkId}`}>{task.homeworkTitle}</a></p>}<h1>{record.title}</h1><div className="tags"><span className={`tag ${record.difficulty}`}>{difficultyLabels[record.difficulty]}</span>{task && <><span className="tag">{homeworkLabels[task.state]}</span><span className="small">{task.dueDate ? `Срок: ${task.dueDate}` : 'Без срока'}</span></>}{record.topics.map(topic => <span className="tag" key={topic}>{topic}</span>)}{record.archivedAt && <span className="tag">В архиве</span>}</div></div>
			<div className="row"><a href={record.url} target="_blank" rel="noopener noreferrer">{record.slug.startsWith('cf-') ? 'Codeforces' : 'LeetCode'} ↗</a><Tutor context={{ kind: 'problem', id: record.id }} title={record.title} user={user} flush={() => guard.current?.flush()} lesson={chapterPane && current.data ? article : undefined} evaluate={student && Boolean(code.trim())} />{!task && <button onClick={() => setEditing(true)} data-tip="Открыть форму изменения задачи.">Изменить задачу</button>}{user.role === 'parent' && task && !['completed', 'cancelled'].includes(task.state) && <button disabled={busy} onClick={() => { if (confirm('Отменить это задание?')) void act('cancel'); }} data-tip="Отменить это задание домашней работы.">Отменить задание</button>}</div></div>
		{/* The statement HTML comes from the set files of the repository, not from a user. */}
		{statement?.html ? <div className="lesson" dangerouslySetInnerHTML={{ __html: statement.html }} /> : statement && (statement.text ?? record.summary) && <p className="prose">{statement.text ?? record.summary}</p>}
		{task?.instructions && <p className="prose">{task.instructions}</p>}
		{review && <p className="notice">{review.kind === 'completed' ? 'Завершено' : 'Нужны правки'}{review.body && `: ${review.body}`}</p>}
		{!task && <div className="row"><a href={`/leetcode/problems/${record.id}/review`}>Повторить задачу</a>{record.archivedAt ? <button onClick={restore} data-tip="Вернуть задачу в список задач.">Вернуть из архива</button> : <button onClick={archive} data-tip="Убрать задачу в архив.">В архив</button>}{tasks.data?.items.map(t => <a key={t.id} href={`/leetcode/tasks/${t.id}`}>{t.homeworkTitle}</a>)}</div>}
		{(error || attempts.error || current.error || reviews.error) && <p className="error" role="alert">{error || attempts.error || current.error || reviews.error}</p>}
		{current.data ? <DraftEditor key={`${current.data.id}:${current.data.state}`} initial={current.data} user={user} registerGuard={register} task={task} saved={saved} chapter={chapterPane} onCode={setCode} notice={notice} /> : <p className="empty">{!student && attempts.data?.items.length === 0 ? 'Ученик ещё не начал работу.' : 'Открываем работу...'}</p>}
		{user.role === 'parent' && (task?.state === 'submitted' || task?.state === 'completed') && <section className="card card-pad stack"><h2>Проверка отправки</h2><label>Отзыв<textarea aria-label="Отзыв" value={feedback} onChange={event => setFeedback(event.target.value)} maxLength={8000} /></label><div className="row"><button disabled={busy} onClick={() => void act('review', { submissionId: task.submissionId, decision: 'changes_requested', body: feedback })} data-tip="Вернуть задание ученику с вашим отзывом.">Вернуть на доработку</button>{task.state === 'submitted' && <button className="primary" disabled={busy} onClick={() => void act('review', { submissionId: task.submissionId, decision: 'completed', body: feedback })} data-tip="Принять работу и завершить задание.">Завершить</button>}</div></section>}
		<Materials problemId={record.id} homework={details.data?.homework} user={user} changed={details.reload} />
		{editing && <ProblemForm problem={record} student={user.role === 'student'} close={() => setEditing(false)} saved={() => { setEditing(false); problem.reload(); }} />}
	</div>;
}
