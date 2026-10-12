import { useState, type SubmitEvent } from 'react';
import type { Homework as Bundle, Distribution, HomeworkBoard, HomeworkDetails, Page, Problem, SessionUser } from '../shared/leetcode';
import { localDate } from '../shared/dates';
import { api, message } from './api';
import { useResource } from './useResource';
import { Materials } from './Materials';
import { plural } from './text';

export const homeworkLabels = { assigned: 'Назначено', in_progress: 'В работе', submitted: 'Отправлено', changes_requested: 'Нужны правки', completed: 'Завершено', cancelled: 'Отменено' };
export const difficultyLabels = { easy: 'Легко', medium: 'Средне', hard: 'Сложно' };

export function Homework({ user, id }: { user: SessionUser; id?: string }) {
	return id ? <BundleDetail key={id} id={id} user={user} /> : <HomeworkList user={user} />;
}
const sections = [{ key: 'progress', title: 'В процессе' }, { key: 'future', title: 'Будущее' }, { key: 'accepted', title: 'Принятое' }] as const;
const dayMonth = (date: string) => `${date.slice(8)}.${date.slice(5, 7)}`;
function HomeworkList({ user }: { user: SessionUser }) {
	const board = useResource<HomeworkBoard>('/tasks?view=board');
	const [error, setError] = useState(''), [busy, setBusy] = useState(false), [spread, setSpread] = useState('');
	async function create(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault(); setBusy(true); setError('');
		const form = new FormData(event.currentTarget);
		try {
			const homework = await api<Bundle>('/homework', { method: 'POST', body: JSON.stringify({ title: form.get('title'), instructions: form.get('instructions'), dueDate: form.get('dueDate') || null }) });
			location.assign(`/leetcode/homework/${homework.id}`);
		} catch (error) { setError(message(error)); setBusy(false); }
	}
	async function distribute() {
		setBusy(true); setError(''); setSpread('');
		try {
			const { count, from, to } = await api<Distribution>('/reviews/distribute', { method: 'POST', body: JSON.stringify({ today: localDate() }) });
			setSpread(count ? `${plural(count, ['задача распределена', 'задачи распределены', 'задач распределены'])} с ${dayMonth(from!)} по ${dayMonth(to!)}.` : 'Все принятые задачи уже распределены.');
		} catch (error) { setError(message(error)); } finally { setBusy(false); }
	}
	const parent = user.role === 'parent';
	return <div className="stack"><div className="heading"><div><h1>Домашняя работа</h1><p>{parent ? 'Соберите задачи в домашнюю работу. Проверяйте ход решения.' : 'Выполните каждое задание, затем отправьте решение на проверку.'}</p></div></div>
		{(error || board.error) && <p className="error" role="alert">{error || board.error}</p>}
		{parent && <form className="card card-pad stack" onSubmit={create}><h2>Новая домашняя работа</h2><label>Название<input name="title" required maxLength={200} /></label><label>Задание<textarea aria-label="Задание" name="instructions" maxLength={8000} /></label><label>Срок<input type="date" name="dueDate" /></label><button className="primary" disabled={busy}>Создать домашнюю работу</button></form>}
		{sections.map(({ key, title }) => <section className="card" aria-label={title} key={key}><header className="card-head"><h2>{title}</h2></header>
			{key === 'accepted' && <div className="card-pad row"><button disabled={busy} onClick={distribute}>Распределить повторения на 30 дней</button>{spread && <p role="status">{spread}</p>}</div>}
			{board.data?.[key].map(t => <article key={t.id} className="list-row"><div className="grow"><h3>{t.unread && <span className="unread" role="img" aria-label="Новое сообщение" />}<a href={`/leetcode/tasks/${t.id}`}>{t.problemTitle}</a></h3><p className="small"><a href={`/leetcode/homework/${t.homeworkId}`}>{t.homeworkTitle}</a></p></div><span className="small">{t.dueDate ? `Срок: ${t.dueDate}` : 'Без срока'}</span><span className="tag">{homeworkLabels[t.state]}</span></article>)}
			{board.data?.[key].length === 0 && <p className="empty">Заданий нет.</p>}</section>)}
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
	async function postpone() {
		setBusy(true); setError('');
		try { await api(`/homework/${id}/postpone`, { method: 'POST', body: JSON.stringify({ version: h!.version, today: localDate() }) }); details.reload(); }
		catch (error) { setError(message(error)); } finally { setBusy(false); }
	}
	if (!h) return <p role="status">{details.error || 'Открываем домашнюю работу...'}</p>;
	const parent = user.role === 'parent', tasks = details.data!.tasks;
	const power = !parent && h.dueDate && !h.postponedTo && localDate() <= h.dueDate && tasks.some(t => ['assigned', 'in_progress', 'changes_requested'].includes(t.state));
	return <div className="stack"><div className="heading"><div><h1>{h.title}</h1><div className="row"><p>{h.dueDate ? `Срок: ${h.dueDate}` : 'Без срока'}</p>{power && <button disabled={busy} onClick={postpone}>Сила Бомжа</button>}</div>{h.postponedTo && <p>Сила Бомжа: срок перенесён на {dayMonth(h.postponedTo)}.</p>}</div>{parent && <button onClick={() => setEditing(!editing)}>Изменить домашнюю работу</button>}</div><p className="prose">{h.instructions}</p>
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
