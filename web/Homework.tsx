import { useState, type SubmitEvent } from 'react';
import type { Homework as Bundle, HomeworkDetails, HomeworkSummary, Page, Problem, SessionUser } from '../shared/leetcode';
import { api, message } from './api';
import { useResource } from './useResource';
import { Materials } from './Materials';

export const homeworkLabels = { assigned: 'Назначено', in_progress: 'В работе', submitted: 'Отправлено', changes_requested: 'Нужны правки', completed: 'Завершено', cancelled: 'Отменено' };
export const difficultyLabels = { easy: 'Легко', medium: 'Средне', hard: 'Сложно' };

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
	return <div className="stack"><div className="heading"><div><h1>Домашняя работа</h1><p>{parent ? 'Соберите задачи в домашнюю работу. Проверяйте ход решения.' : 'Выполните каждое задание, затем отправьте попытку на проверку.'}</p></div></div>
		{(error || list.error) && <p className="error" role="alert">{error || list.error}</p>}
		<section className="card">{list.data?.items.map(h => { const waiting = parent ? h.submittedCount : h.requestedCount; return <article key={h.id} className="list-row"><div className="grow"><h2>{h.unread && <span className="unread" role="img" aria-label="Новое сообщение" />}<a href={`/leetcode/homework/${h.id}`}>{h.title}</a></h2><p>{h.dueDate ? `Срок: ${h.dueDate}` : 'Без срока'}</p></div><span className="small">{h.completedCount} из {h.taskCount} завершено</span>{waiting > 0 && <span className={`tag ${parent ? 'good' : 'medium'}`}>{parent ? 'Ждут проверки' : 'Нужны правки'}: {waiting}</span>}</article>; })}{list.data?.items.length === 0 && <p className="empty">Домашней работы пока нет. {parent ? 'Создайте её ниже.' : 'Родитель может добавить домашнюю работу.'}</p>}</section>
		{list.data?.nextOffset != null && <a href={`?offset=${list.data.nextOffset}`}>Старее</a>}
		{parent && <form className="card card-pad stack" onSubmit={create}><h2>Новая домашняя работа</h2><label>Название<input name="title" required maxLength={200} /></label><label>Задание<textarea aria-label="Задание" name="instructions" maxLength={8000} /></label><label>Срок<input type="date" name="dueDate" /></label><button className="primary" disabled={busy}>Создать домашнюю работу</button></form>}
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
	if (!h) return <p role="status">{details.error || 'Открываем домашнюю работу...'}</p>;
	const parent = user.role === 'parent', tasks = details.data!.tasks;
	return <div className="stack"><div className="heading"><div><h1>{h.title}</h1><p>{h.dueDate ? `Срок: ${h.dueDate}` : 'Без срока'}</p></div>{parent && <button onClick={() => setEditing(!editing)}>Изменить домашнюю работу</button>}</div><p className="prose">{h.instructions}</p>
		{(error || details.error) && <p className="error" role="alert">{error || details.error}</p>}
		{editing && <form className="card card-pad stack" onSubmit={save}><label>Название<input name="title" defaultValue={h.title} required maxLength={200} /></label><label>Задание<textarea aria-label="Задание" name="instructions" defaultValue={h.instructions} maxLength={8000} /></label><label>Срок<input type="date" name="dueDate" defaultValue={h.dueDate ?? ''} /></label><button disabled={busy}>Сохранить домашнюю работу</button></form>}
		<section className="card" aria-label="Задания">{tasks.map(t => <article key={t.id} className="list-row"><div className="grow"><h2>{t.unread && <span className="unread" role="img" aria-label="Новое сообщение" />}<a href={`/leetcode/tasks/${t.id}`}>{t.problemTitle}</a></h2></div><span className={`tag ${t.difficulty}`}>{difficultyLabels[t.difficulty]}</span><span className="tag">{homeworkLabels[t.state]}</span></article>)}{!tasks.length && <p className="empty">Заданий пока нет. {parent ? 'Добавьте задачу ниже.' : 'Родитель может добавить задание.'}</p>}</section>
		{parent && <AddTask homeworkId={id} added={details.reload} />}
		<Materials homework={h} user={user} changed={details.reload} />
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
	return <form className="card card-pad stack" onSubmit={add}><h2>Новое задание</h2>{error && <p className="error" role="alert">{error}</p>}<label>Найти задачу<input type="search" value={search} onChange={event => setSearch(event.target.value)} maxLength={100} /></label><fieldset><legend>Задача</legend><div className="picker">{[...(chosen && !problems.data?.items.some(p => p.id === chosen.id) ? [chosen] : []), ...problems.data?.items ?? []].map(p => <label className="list-row" key={p.id}><input type="radio" name="problemId" value={p.id} required checked={chosen?.id === p.id} onChange={() => setChosen(p)} /><span className="grow">{p.title}</span><span className="row"><span className="small">{p.topics.join(', ')}</span><span className={`tag ${p.difficulty}`}>{difficultyLabels[p.difficulty]}</span></span></label>)}{problems.data?.items.length === 0 && !chosen && <p className="empty">Нет подходящих задач.</p>}</div></fieldset><button className="primary" disabled={busy}>Добавить задание</button></form>;
}
