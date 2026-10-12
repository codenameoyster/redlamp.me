import { useCallback, useEffect, useRef, useState } from 'react';
import { newApproach, type Approach, type Attempt, type AttemptSummary, type DraftValue, type HomeworkTask, type Page, type Problem as ProblemRecord, type ProblemTests, type SessionUser, type TaskDetails } from '../shared/leetcode';
import { api, ApiError, message } from './api';
import { useResource } from './useResource';
import { useDraft, type LeaveGuard, type RegisterGuard } from './useDraft';
import { difficultyLabels, ProblemForm } from './Problems';
import { Discussion, homeworkLabels } from './Homework';
import { Materials } from './Materials';
import { CodeField } from './Code';
import { Tutor } from './Tutor';
import { OwnTests, Runner } from './Runner';
import { addCalendarDays, localDate } from '../shared/dates';

export const understandingLabels = { needs_practice: 'Нужно потренироваться', with_help: 'Решил с подсказкой', independent: 'Решил сам' };
export const acceptanceLabels = { not_submitted: 'Не отправлял', not_accepted: 'Не принято', accepted: 'Принято на LeetCode' };
export function attemptLabel(items: AttemptSummary[], index: number): string { return `${items[index].state === 'draft' ? 'Текущий черновик' : `Сохранённая попытка ${items.length - index}`} - ${new Date(items[index].createdAt).toLocaleString('ru-RU')}`; }

export function AttemptContent({ value, change, tests }: { value: DraftValue; change?: (next: DraftValue) => void; tests?: ProblemTests }) {
	const [copyState, setCopyState] = useState('');
	function update(id: string, patch: Partial<Approach>) { change?.({ ...value, document: { ...value.document, approaches: value.document.approaches.map(a => a.id === id ? { ...a, ...patch } : a) } }); }
	const fields = [{ key: 'idea', label: 'Основная идея' }, { key: 'correctness', label: 'Почему это работает' }, { key: 'edgeCases', label: 'Крайние случаи' }, { key: 'mistakes', label: 'Ошибки и выводы' }] as const;
	return <div className="stack">
		<div className="row"><label>Статус на LeetCode<select value={value.acceptance} disabled={!change} onChange={event => change?.({ ...value, acceptance: event.target.value as DraftValue['acceptance'] })}>{Object.entries(acceptanceLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Понимание<select value={value.understanding} disabled={!change} onChange={event => change?.({ ...value, understanding: event.target.value as DraftValue['understanding'] })}>{Object.entries(understandingLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
		<label>Общие заметки<textarea aria-label="Общие заметки" value={value.document.notes} readOnly={!change} onChange={event => change?.({ ...value, document: { ...value.document, notes: event.target.value } })} /></label>
		{value.document.approaches.map((approach, index) => <section className="stack" key={approach.id} aria-label={`Подход ${index + 1}`}>
			<div className="row spread"><h2>Подход {index + 1}</h2>{change && value.document.approaches.length > 1 && <button type="button" onClick={() => { if (confirm('Удалить этот подход из черновика?')) change({ ...value, document: { ...value.document, approaches: value.document.approaches.filter(a => a.id !== approach.id) } }); }}>Удалить подход</button>}</div>
			<label>Название подхода<input value={approach.label} maxLength={200} readOnly={!change} onChange={event => update(approach.id, { label: event.target.value })} /></label>
			<div className="editor-grid"><div className="card card-pad stack">{fields.map(field => <label key={field.key}>{field.label}<textarea aria-label={field.label} value={approach[field.key]} readOnly={!change} onChange={event => update(approach.id, { [field.key]: event.target.value })} /></label>)}<div className="editor-grid"><label>Время<input value={approach.timeComplexity} readOnly={!change} onChange={event => update(approach.id, { timeComplexity: event.target.value })} /></label><label>Память<input value={approach.spaceComplexity} readOnly={!change} onChange={event => update(approach.id, { spaceComplexity: event.target.value })} /></label></div></div>
				<div className="card card-pad stack"><label>Язык<input value={approach.language} maxLength={40} readOnly={!change} onChange={event => update(approach.id, { language: event.target.value })} /></label><label>Код решения<CodeField language={approach.language} value={approach.code} readOnly={!change} onChange={code => update(approach.id, { code })} /></label><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(approach.code); setCopyState('Код скопирован.'); } catch { setCopyState('Выделите и скопируйте код вручную.'); } }}>Скопировать код</button>{tests && /^(py|$)/i.test(approach.language.trim()) && <Runner code={approach.code} tests={tests} live={Boolean(change)} />}</div>
			</div>
		</section>)}
		{copyState && <p role="status">{copyState}</p>}
		{change && value.document.approaches.length < 8 && <button type="button" onClick={() => change({ ...value, document: { ...value.document, approaches: [...value.document.approaches, newApproach()] } })}>Добавить подход</button>}
	</div>;
}

export function DraftEditor({ initial, user, registerGuard, saved, nextReviewDate, task, reloadTask }: { initial: Attempt; user: SessionUser; registerGuard: RegisterGuard; saved: (attempt: Attempt) => void; nextReviewDate: string | null; task?: HomeworkTask; reloadTask: () => void }) {
	const draft = useDraft(initial, user);
	const tests = useResource<ProblemTests>(`/problems/${initial.problemId}/tests`);
	const [busy, setBusy] = useState(false), [error, setError] = useState(''), [date, setDate] = useState(nextReviewDate ?? '');
	const [dateChanged, setDateChanged] = useState(false);
	const [failure, setFailure] = useState<{ action: 'save' | 'submit'; error: unknown } | null>(null);
	function changeDate(value: string) { setDate(value); setDateChanged(true); }
	const editable = user.role === 'student' && initial.state === 'draft';
	const submittable = editable && task && ['assigned', 'in_progress', 'changes_requested'].includes(task.state);
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
				await api(`/tasks/${task!.id}/submit`, { method: 'POST', body: JSON.stringify({ version: task!.version, attemptId: persisted.id, attemptVersion: persisted.version, ...(dateChanged ? { nextReviewDate: date || null } : {}) }) });
				saved(await api<Attempt>(path));
			}
		} catch (error) {
			if (error instanceof ApiError && error.status === 409 && persisted) {
				try {
					const server = await api<Attempt>(path);
					if (server.state === 'saved' && server.version === persisted.version + 1 && server.acceptance === persisted.acceptance && server.understanding === persisted.understanding && JSON.stringify(server.document) === JSON.stringify(persisted.document)) {
						const details = action === 'submit' ? await api<TaskDetails>(`/tasks/${task!.id}`) : null;
						if (!details || details.submissions.some(s => s.attemptId === server.id && s.taskVersion === task!.version + 1)) { saved(server); return; }
					}
					if (server.version !== persisted.version) { draft.conflicted(server); return; }
					if (action === 'submit') reloadTask();
				} catch (readError) { error = readError; }
			}
			setFailure({ action, error });
		} finally { setBusy(false); }
	}
	async function copyWork() { try { await navigator.clipboard.writeText(JSON.stringify(draft.value, null, 2)); } catch { setError('Выделите и скопируйте текст из редактора вручную.'); } }
	const loginRequired = draft.status === 'login_required' || (failure?.error instanceof ApiError && failure.error.status === 401);
	return <div className="stack">
		{editable && <p role="status" aria-label="Состояние сохранения" aria-live="polite">{{ saved: 'Сохранено', saving: 'Сохраняем', unsaved: 'Не сохранено', conflict: 'Конфликт правок', login_required: 'Войдите, чтобы сохранить' }[draft.status]}</p>}
		{draft.storageError && <p className="notice" role="status">{draft.storageError}</p>}
		{draft.recovery && <section className="notice stack" aria-label="Копия для восстановления"><p>{draft.recovery.attemptId === initial.id ? 'В этой вкладке есть несохранённая работа.' : 'В этой вкладке есть несохранённая работа из прошлой попытки. Скопируйте её, прежде чем продолжить.'}</p>{draft.recovery.attemptId !== initial.id && <pre>{JSON.stringify(draft.recovery.value, null, 2)}</pre>}<div className="row">{draft.recovery.attemptId === initial.id && <button onClick={draft.recover}>Восстановить несохранённую работу</button>}<button onClick={async () => { try { await navigator.clipboard.writeText(JSON.stringify(draft.recovery!.value, null, 2)); } catch { setError('Выделите и скопируйте текст для восстановления вручную.'); } }}>Скопировать восстановленную работу</button><button onClick={useServerCopy}>Использовать копию с сервера</button></div></section>}
		{(error || failure || draft.error) && <div className="error" role="alert">{error || (failure ? message(failure.error) : draft.error)}<div className="row">{loginRequired ? <button onClick={draft.signIn}>Войти снова</button> : failure ? (failure.action === 'save' || submittable) && <button disabled={busy} onClick={() => void finalize(failure.action)}>{failure.action === 'save' ? 'Повторить сохранение попытки' : 'Повторить отправку'}</button> : !draft.conflict && <button onClick={() => void draft.flush()}>Повторить сохранение</button>}{!draft.conflict && <button onClick={copyWork}>Скопировать несохранённую работу</button>}</div></div>}
		{draft.conflict && <section className="notice stack"><h2>Копия с сервера</h2><p>В редакторе осталась ваша локальная копия. Скопируйте её, прежде чем заменить.</p><pre>{JSON.stringify(draft.conflict.document, null, 2)}</pre><div className="row"><button onClick={copyWork}>Скопировать несохранённую работу</button><button onClick={useServerCopy}>Использовать копию с сервера</button></div></section>}
		<fieldset disabled={busy || Boolean(draft.recovery)}><AttemptContent value={draft.value} change={editable ? draft.change : undefined} tests={tests.data ?? undefined} /></fieldset>
		{tests.data?.spec && <OwnTests problemId={initial.problemId} tests={tests.data} changed={tests.reload} />}
		{editable && <div className="card card-pad stack"><div className="row spread"><label>Следующее повторение<input type="date" value={date} disabled={busy} onChange={event => changeDate(event.target.value)} /></label><button className="primary" disabled={busy || Boolean(draft.recovery)} onClick={() => void finalize('save')}>Сохранить попытку</button></div>{draft.value.acceptance === 'accepted' && <div className="row"><span>Напоминание:</span><button type="button" disabled={busy} onClick={() => changeDate(addCalendarDays(localDate(), 1))}>Завтра</button><button type="button" disabled={busy} onClick={() => changeDate(addCalendarDays(localDate(), 3))}>Через три дня</button><button type="button" disabled={busy} onClick={() => changeDate(addCalendarDays(localDate(), 7))}>Через семь дней</button><button type="button" disabled={busy} onClick={() => changeDate('')}>Без напоминания</button></div>}</div>}
		{submittable && <button className="primary" disabled={busy || Boolean(draft.recovery)} onClick={() => void finalize('submit')}>Отправить на проверку</button>}
	</div>;
}

export function Problem({ id, user, registerGuard }: { id: string; user: SessionUser; registerGuard: RegisterGuard }) {
	const problem = useResource<ProblemRecord>(`/problems/${id}`);
	const attempts = useResource<Page<AttemptSummary>>(`/problems/${id}/attempts`);
	const tasks = useResource<Page<HomeworkTask>>(`/tasks?problemId=${id}&active=1`);
	const [selected, setSelected] = useState<string | null>(null);
	const attemptId = selected ?? attempts.data?.items[0]?.id;
	const current = useResource<Attempt>(attemptId ? `/problems/${id}/attempts/${attemptId}` : null);
	const shown = useRef(attemptId);
	useEffect(() => { shown.current = attemptId; }, [attemptId]);
	const [editing, setEditing] = useState(false), [error, setError] = useState('');
	const guard = useRef<LeaveGuard | null>(null);
	const register = useCallback<RegisterGuard>(value => { guard.current = value; registerGuard(value); }, [registerGuard]);
	async function choose(value: string) { if (guard.current && !(await guard.current.flush())) return; setError(''); setSelected(value); }
	async function start(copyAttemptId?: string) {
		setError('');
		try {
			if (guard.current && !(await guard.current.flush())) return;
			const attempt = await api<Attempt>(`/problems/${id}/attempts`, { method: 'POST', body: JSON.stringify(copyAttemptId ? { copyAttemptId } : {}) });
			setSelected(attempt.id); attempts.reload();
		} catch (error) { setError(message(error)); if (error instanceof ApiError && error.fields?.attemptId) setSelected(error.fields.attemptId); }
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
	if (!record) return <p role="status">{problem.error || 'Открываем задачу...'}</p>;
	return <div className="stack"><div className="heading"><div><h1>{record.title}</h1><div className="tags"><span className={`tag ${record.difficulty}`}>{difficultyLabels[record.difficulty]}</span>{record.topics.map(topic => <span className="tag" key={topic}>{topic}</span>)}{record.archivedAt && <span className="tag">В архиве</span>}</div></div><div className="row"><a className="button" href={record.url} target="_blank" rel="noopener noreferrer">Открыть задачу</a><Tutor context={{ kind: 'problem', id }} title={record.title} user={user} flush={() => guard.current?.flush()} /><button onClick={() => setEditing(true)}>Изменить задачу</button></div></div>
		<p className="prose">{record.summary}</p><div className="row"><a href={`/leetcode/problems/${id}/review`}>Повторить задачу</a>{record.archivedAt ? <button onClick={restore}>Вернуть из архива</button> : <button onClick={archive}>В архив</button>}</div>
		{(error || attempts.error || current.error) && <p className="error" role="alert">{error || attempts.error || current.error}</p>}
		<div className="row spread"><label>История попыток<select value={attemptId ?? ''} onChange={event => void choose(event.target.value)}><option value="" disabled>Выберите попытку</option>{attempts.data?.items.map((attempt, index, items) => <option key={attempt.id} value={attempt.id}>{attemptLabel(items, index)}</option>)}</select></label>{user.role === 'student' && current.data?.state !== 'draft' && <div className="row"><button onClick={() => void start()}>Начать новую попытку</button>{current.data && <button onClick={() => void start(current.data!.id)}>Скопировать в новый черновик</button>}</div>}</div>
		{tasks.data?.items.map(t => <article className="card card-pad stack" key={t.id}><h2><a href={`/leetcode/tasks/${t.id}`}>{t.homeworkTitle}</a></h2><p><span className="tag">{homeworkLabels[t.state]}</span> {t.dueDate ? `Срок: ${t.dueDate}` : 'Без срока'}</p><p className="prose">{t.instructions}</p></article>)}
		{current.data ? <DraftEditor key={`${current.data.id}:${current.data.state}`} initial={current.data} user={user} registerGuard={register} nextReviewDate={record.nextReviewDate} task={tasks.data?.items[0]} reloadTask={tasks.reload} saved={attempt => { if (shown.current === attempt.id) { setSelected(attempt.id); current.setData(attempt); } setError(''); attempts.reload(); problem.reload(); tasks.reload(); }} /> : <p className="empty">{attemptId ? 'Открываем попытку...' : 'Попыток пока нет. Начните попытку, чтобы записать ход решения.'}</p>}
		<Discussion problemId={id} />
		<Materials problemId={id} user={user} />
		{editing && <ProblemForm problem={record} close={() => setEditing(false)} saved={() => { setEditing(false); problem.reload(); }} />}
	</div>;
}
