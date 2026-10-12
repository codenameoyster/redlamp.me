import { useState } from 'react';
import type { Attempt, AttemptSummary, Page, Problem, Revision, SessionUser, Understanding } from '../shared/leetcode';
import { addCalendarDays, localDate } from '../shared/dates';
import { api, ApiError, message } from './api';
import { useResource } from './useResource';
import { AttemptContent, understandingLabels } from './Workspace';

const results: { value: Understanding; label: string; days: number }[] = [{ value: 'needs_practice', label: 'Нужно потренироваться', days: 1 }, { value: 'with_help', label: 'Решил с подсказкой', days: 3 }, { value: 'independent', label: 'Решил сам', days: 7 }];
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
	async function restart() {
		setBusy(true); setError('');
		try { await api(`/problems/${id}/attempts`, { method: 'POST', body: '{}' }); location.assign(`/leetcode/problems/${id}`); }
		catch (error) { if (error instanceof ApiError && error.code === 'draft_exists') return location.assign(`/leetcode/problems/${id}`); setError(message(error)); setBusy(false); }
	}
	const record = problem.data;
	if (!record) return <p role="status">{problem.error || 'Открываем повторение...'}</p>;
	return <div className="stack"><div className="heading"><div><p className="small">Повторение</p><h1>{record.title}</h1><div className="tags">{record.topics.map(topic => <span className="tag" key={topic}>{topic}</span>)}</div></div><a className="button" href={record.url} target="_blank" rel="noopener noreferrer">Открыть задачу</a></div>{!pick && <p className="prose">{record.summary}</p>}
		<section className="card card-pad stack"><h2>Объясните, прежде чем смотреть.</h2><p>Назовите основную идею. Объясните, почему она работает. Оцените время и память. Попробуйте решить задачу на сайте.</p>{pick ? <><p>Решите задачу заново, не подглядывая в старое решение.</p>{user.role === 'student' && <button disabled={busy} onClick={restart}>Начать новую попытку</button>}</> : revealed ? <SavedWork problemId={id} /> : <button onClick={() => setRevealed(true)}>Показать сохранённую работу</button>}</section>
		{user.role === 'student' && <section className="card card-pad stack"><h2>Как прошло?</h2><div className="row">{results.map(item => <button key={item.value} aria-pressed={result === item.value} onClick={() => { setResult(item.value); setDate(addCalendarDays(localDate(), item.days)); setSaved(false); }}>{item.label}</button>)}</div><label>Заметка<textarea aria-label="Заметка" maxLength={8000} value={note} onChange={event => setNote(event.target.value)} /></label><label>Следующее повторение<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label><p className="small">Выберите дату или оставьте поле пустым, чтобы убрать напоминание.</p>{error && <p className="error" role="alert">{error}</p>}{saved && <p role="status">Повторение сохранено.</p>}<button className="primary" disabled={!result || busy} onClick={save}>Сохранить повторение</button></section>}
		<section className="card card-pad stack"><h2>История повторений</h2>{history.error && <p className="error" role="alert">{history.error}</p>}{history.data?.items.map(review => <article key={review.id}><strong>{review.reviewedOn} - {understandingLabels[review.result]}</strong><p className="prose">{review.note}</p><small>{review.nextReviewDate ? `Следующее повторение: ${review.nextReviewDate}` : 'Без напоминания'}</small></article>)}{history.data?.items.length === 0 && <p>Повторений пока нет.</p>}<div className="row">{offset > 0 && <button onClick={() => setOffset(offset - 50)}>Новее</button>}{history.data?.nextOffset != null && <button onClick={() => setOffset(history.data!.nextOffset!)}>Старее</button>}</div></section><a href={`/leetcode/problems/${id}`}>Назад к тетради</a>
	</div>;
}
function SavedWork({ problemId }: { problemId: string }) {
	const attempts = useResource<Page<AttemptSummary>>(`/problems/${problemId}/attempts`);
	const [selected, setSelected] = useState('');
	const saved = attempts.data?.items.filter(a => a.state === 'saved');
	const id = selected || saved?.[0]?.id;
	const work = useResource<Attempt>(id ? `/problems/${problemId}/attempts/${id}` : null);
	return <div className="stack">{(attempts.error || work.error) && <p className="error" role="alert">{attempts.error || work.error}</p>}{saved?.length === 0 ? <p>Сохранённой работы пока нет. Сначала сохраните попытку в тетради.</p> : <><label>Сохранённая попытка<select aria-label="Сохранённая попытка" value={id ?? ''} onChange={event => setSelected(event.target.value)}>{saved?.map((a, i) => <option key={a.id} value={a.id}>Попытка {saved.length - i} - {new Date(a.savedAt!).toLocaleString('ru-RU')}</option>)}</select></label>{work.data && <AttemptContent value={work.data} />}</>}</div>;
}
