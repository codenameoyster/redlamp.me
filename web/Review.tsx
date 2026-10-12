import { useState } from 'react';
import type { Attempt, AttemptSummary, Page, Problem, Revision, SessionUser, Understanding } from '../shared/leetcode';
import { addCalendarDays, localDate } from '../shared/dates';
import { api, ApiError, message } from './api';
import { useResource } from './useResource';
import { AttemptContent, understandingLabels } from './Workspace';
import { go } from './navigate';

const results: { value: Understanding; label: string; days: number; tip: string }[] = [{ value: 'needs_practice', label: 'Нужно потренироваться', days: 1, tip: 'Отметить, что задачу нужно потренировать, и повторить завтра.' }, { value: 'with_help', label: 'Решил с подсказкой', days: 3, tip: 'Отметить, что вы решили с подсказкой, и повторить через 3 дня.' }, { value: 'independent', label: 'Решил сам', days: 7, tip: 'Отметить, что вы решили сами, и повторить через 7 дней.' }];
export function Review({ id, user }: { id: string; user: SessionUser }) {
	const problem = useResource<Problem>(`/problems/${id}`);
	const [revealed, setRevealed] = useState(false), [result, setResult] = useState<Understanding | null>(null), [date, setDate] = useState(''), [note, setNote] = useState(''), [error, setError] = useState(''), [saved, setSaved] = useState(false), [busy, setBusy] = useState(false);
	const [offset, setOffset] = useState(0);
	const history = useResource<Page<Revision>>(`/problems/${id}/reviews?offset=${offset}`);
	const pick = new URLSearchParams(location.search).has('pick');
	async function save() {
		setBusy(true); setError(''); setSaved(false);
		try { await api(`/problems/${id}/reviews`, { method: 'POST', body: JSON.stringify({ version: problem.data!.progressVersion, result, note, reviewedOn: localDate(), nextReviewDate: date || null }) }); setSaved(true); problem.reload(); history.reload(); }
		catch (error) { setError(message(error)); } finally { setBusy(false); }
	}
	// The work window copies the newest saved attempt into the draft. A pick saves that draft first, so the new draft is empty and no work is lost.
	async function restart() {
		setBusy(true); setError('');
		const start = () => api(`/problems/${id}/attempts`, { method: 'POST', body: '{}' });
		try {
			await start().catch(async error => {
				if (!(error instanceof ApiError && error.code === 'draft_exists')) throw error;
				const draft = await api<Attempt>(`/problems/${id}/attempts/${error.fields!.attemptId}`);
				await api(`/problems/${id}/attempts/${draft.id}/save`, { method: 'POST', body: JSON.stringify({ version: draft.version }) });
				await start();
			});
			go(`/leetcode/problems/${id}`);
		} catch (error) { setError(message(error)); setBusy(false); }
	}
	const record = problem.data;
	if (!record) return <p role="status">{problem.error || 'Открываем повторение...'}</p>;
	return <div className="stack"><div className="heading"><div><p className="small">Повторение</p><h1>{record.title}</h1><div className="tags">{record.topics.map(topic => <span className="tag" key={topic}>{topic}</span>)}</div></div><a className="button" href={record.url} target="_blank" rel="noopener noreferrer" data-tip="Открыть задачу на сайте в новой вкладке.">Открыть задачу</a></div>{!pick && <p className="prose">{record.summary}</p>}
		<section className="card card-pad stack"><h2>Объясните, прежде чем смотреть.</h2><p>Назовите основную идею. Объясните, почему она работает. Оцените время и память. Попробуйте решить задачу на сайте.</p>{pick ? <><p>Решите задачу заново, не подглядывая в старое решение.</p>{user.role === 'student' && <button disabled={busy} onClick={restart} data-tip="Начать пустую попытку и решить задачу заново.">Начать новую попытку</button>}</> : revealed ? <SavedWork problemId={id} /> : <button onClick={() => setRevealed(true)} data-tip="Показать последнюю сохранённую попытку.">Показать сохранённую работу</button>}</section>
		{user.role === 'student' && <section className="card card-pad stack"><h2>Как прошло?</h2><div className="row">{results.map(item => <button key={item.value} aria-pressed={result === item.value} onClick={() => { setResult(item.value); setDate(addCalendarDays(localDate(), item.days)); setSaved(false); }} data-tip={item.tip}>{item.label}</button>)}</div><label>Заметка<textarea aria-label="Заметка" maxLength={8000} value={note} onChange={event => setNote(event.target.value)} /></label><label>Следующее повторение<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label><p className="small">Выберите дату или оставьте поле пустым, чтобы убрать напоминание.</p>{error && <p className="error" role="alert">{error}</p>}{saved && <p role="status">Повторение сохранено.</p>}<button className="primary" disabled={!result || busy} onClick={save} data-tip="Сохранить оценку, заметку и дату следующего повторения.">Сохранить повторение</button></section>}
		<section className="card card-pad stack"><h2>История повторений</h2>{history.error && <p className="error" role="alert">{history.error}</p>}{history.data?.items.map(review => <article key={review.id}><strong>{review.reviewedOn} - {understandingLabels[review.result]}</strong><p className="prose">{review.note}</p><small>{review.nextReviewDate ? `Следующее повторение: ${review.nextReviewDate}` : 'Без напоминания'}</small></article>)}{history.data?.items.length === 0 && <p>Повторений пока нет.</p>}<div className="row">{offset > 0 && <button onClick={() => setOffset(offset - 50)} data-tip="Показать более новые повторения.">Новее</button>}{history.data?.nextOffset != null && <button onClick={() => setOffset(history.data!.nextOffset!)} data-tip="Показать более старые повторения.">Старее</button>}</div></section><a href={`/leetcode/problems/${id}`}>Назад к тетради</a>
	</div>;
}
function SavedWork({ problemId }: { problemId: string }) {
	const attempts = useResource<Page<AttemptSummary>>(`/problems/${problemId}/attempts`);
	const [selected, setSelected] = useState('');
	const saved = attempts.data?.items.filter(a => a.state === 'saved');
	const id = selected || saved?.[0]?.id;
	const work = useResource<Attempt>(id ? `/problems/${problemId}/attempts/${id}` : null);
	return <div className="stack">{(attempts.error || work.error) && <p className="error" role="alert">{attempts.error || work.error}</p>}{saved?.length === 0 ? <p>Сохранённой работы пока нет. Нажмите «Отправить» или «Решено» в тетради.</p> : <><label>Сохранённая попытка<select aria-label="Сохранённая попытка" value={id ?? ''} onChange={event => setSelected(event.target.value)}>{saved?.map((a, i) => <option key={a.id} value={a.id}>Попытка {saved.length - i} - {new Date(a.savedAt!).toLocaleString('ru-RU')}</option>)}</select></label>{work.data && <AttemptContent value={work.data} />}</>}</div>;
}
