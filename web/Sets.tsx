import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import type { Homework, HomeworkSummary, LearningSetDetails, LearningSetSummary, Page, Problem, QuizDeck, SessionUser, SetTaskRow } from '../shared/leetcode';
import { localDate } from '../shared/dates';
import { api, message } from './api';
import { useResource } from './useResource';
import { plural } from './text';
import { difficultyLabels, homeworkLabels } from './Homework';
import { Tutor } from './Tutor';

const taskCount = (count: number) => plural(count, ['задание', 'задания', 'заданий']);
const cardCounts = (deck: QuizDeck | undefined) => deck ? `${deck.dueCount} к повторению, ${deck.newCount} новых` : '';

export function Sets({ user, slug, chapter }: { user: SessionUser; slug?: string; chapter?: number }) {
	if (!slug) return <SetList />;
	return chapter ? <ChapterPage key={`${slug}/${chapter}`} slug={slug} number={chapter} user={user} /> : <SetOverview key={slug} slug={slug} user={user} />;
}
function SetList() {
	const sets = useResource<LearningSetSummary[]>('/sets');
	return <div className="stack"><div className="heading"><div><h1>Бомжарня</h1><p>Темы по порядку: теория, задачи, квиз.</p></div></div>
		{sets.error && <p className="error" role="alert">{sets.error}</p>}
		<div className="lesson-grid">{sets.data?.map(s => <article className="card card-pad stack" key={s.slug}><h2><a href={`/leetcode/sets/${s.slug}`}>{s.title}</a></h2><p>{s.summary}</p><div className="tags">{s.topics.map(t => <span className="tag" key={t}>{t}</span>)}</div><div className="row small"><span>{plural(s.chapterCount, ['глава', 'главы', 'глав'])}</span><span>{s.acceptedCount} из {s.taskCount} заданий принято</span></div></article>)}</div>
	</div>;
}

function SetOverview({ slug, user }: { slug: string; user: SessionUser }) {
	const details = useResource<LearningSetDetails>(`/sets/${slug}`), decks = useResource<QuizDeck[]>(`/quiz?today=${localDate()}`);
	const set = details.data;
	if (!set) return <p role="status">{details.error || 'Открываем набор...'}</p>;
	return <div className="stack"><div className="heading"><div><h1>{set.title}</h1><p>{set.summary}</p></div><div className="row"><Tutor context={{ kind: 'set', id: slug }} title={set.title} user={user} /></div></div>
		{(details.error || decks.error) && <p className="error" role="alert">{details.error || decks.error}</p>}
		<section className="card card-pad stack"><h2>Что почитать</h2><ul>{set.links.map(link => <li key={link.url}><a href={link.url} target="_blank" rel="noopener noreferrer">{link.title}</a> <small>{link.source}</small></li>)}</ul></section>
		<p>Идите по порядку: каждая глава опирается на предыдущую.</p>
		<section className="card">{set.chapters.map(c => <article className="list-row" key={c.number}><span className="small">Глава {c.number}</span><div className="grow"><h2><a href={`/leetcode/sets/${slug}/${c.number}`}>{c.title}</a></h2><p className="small">{c.summary}</p><p className="small">Задач принято {c.tasks.filter(t => t.accepted).length} из {c.tasks.length}</p><p className="small">Карточек: {cardCounts(decks.data?.find(deck => deck.slug === `${slug}-${c.number}`))}</p></div><a className="button" href={`/leetcode/sets/${slug}/${c.number}`}>Открыть главу</a></article>)}</section>
	</div>;
}

function ChapterPage({ slug, number, user }: { slug: string; number: number; user: SessionUser }) {
	const details = useResource<LearningSetDetails>(`/sets/${slug}`), decks = useResource<QuizDeck[]>(`/quiz?today=${localDate()}`);
	const [adding, setAdding] = useState<SetTaskRow | null>(null);
	const set = details.data, chapter = set?.chapters[number - 1];
	if (!set) return <p role="status">{details.error || 'Открываем набор...'}</p>;
	if (!chapter) return <p role="alert">Такой главы нет. <a href={`/leetcode/sets/${slug}`}>К набору</a></p>;
	const lesson = `/leetcode/api/sets/${slug}/lesson/${number}`;
	return <div className="stack"><div className="heading"><div><h1>Глава {number}. {chapter.title}</h1><p>{chapter.summary}</p></div><div className="row"><a className="button" href={lesson} target="_blank" rel="noopener noreferrer">Открыть на всю страницу</a><Tutor context={{ kind: 'set', id: slug }} title={set.title} user={user} /></div></div>
		{(details.error || decks.error) && <p className="error" role="alert">{details.error || decks.error}</p>}
		<iframe title={chapter.title} src={lesson} sandbox="allow-scripts" className="lesson-frame" />
		<section className="card"><header className="card-head"><h2>Задачи</h2></header>{chapter.tasks.map(t => <article className="list-row" key={t.slug}><span className="small">{t.label}</span><div className="grow"><h3>{t.problemId ? <a href={`/leetcode/problems/${t.problemId}`}>{t.title}</a> : <a href={t.url} target="_blank" rel="noopener noreferrer">{t.title}</a>}</h3><p className="small">{t.note}</p></div><span className={`tag ${t.difficulty}`}>{difficultyLabels[t.difficulty]}</span>{t.accepted && <span className="tag good">Принято</span>}{t.activeTask && <a className="tag" href={`/leetcode/tasks/${t.activeTask.id}`}>{homeworkLabels[t.activeTask.state]}</a>}{user.role === 'parent' && !t.activeTask && <button onClick={() => setAdding(t)}>Добавить в домашнюю работу</button>}</article>)}</section>
		<section className="card card-pad stack"><h2>Квиз главы</h2><p>{cardCounts(decks.data?.find(deck => deck.slug === `${slug}-${number}`))}</p><div className="row"><a className="button" href={`/leetcode/quiz/${slug}-${number}`}>Пройти квиз</a></div></section>
		<nav className="row" aria-label="Главы">{number > 1 && <a className="button" href={`/leetcode/sets/${slug}/${number - 1}`}>Предыдущая глава</a>}<a className="button" href={`/leetcode/sets/${slug}`}>К набору</a>{number < set.chapters.length && <a className="button" href={`/leetcode/sets/${slug}/${number + 1}`}>Следующая глава</a>}</nav>
		{adding && <AddToHomework task={adding} title={set.title} close={() => setAdding(null)} added={() => { setAdding(null); details.reload(); }} />}
	</div>;
}

function AddToHomework({ task, title, close, added }: { task: SetTaskRow; title: string; close: () => void; added: () => void }) {
	const dialog = useRef<HTMLDialogElement>(null);
	const [search, setSearch] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
	const bundles = useResource<Page<HomeworkSummary>>(`/homework?active=1&q=${encodeURIComponent(search)}`), [shown, setShown] = useState(bundles.data);
	if (bundles.data && bundles.data !== shown) setShown(bundles.data);
	useEffect(() => {
		const previous = document.activeElement, element = dialog.current;
		element?.showModal();
		return () => { element?.close(); if (previous instanceof HTMLElement) previous.focus(); };
	}, []);
	async function assign(homeworkId: () => Promise<string>) {
		setBusy(true); setError('');
		try {
			const problem = await api<Problem>('/problems', { method: 'POST', body: JSON.stringify({ url: task.url, number: task.number ?? null, title: task.title, difficulty: task.difficulty, topics: task.topics, summary: task.note }) });
			if (problem.archivedAt) throw new Error('Верните задачу из архива, прежде чем назначать её.');
			await api('/tasks', { method: 'POST', body: JSON.stringify({ homeworkId: await homeworkId(), problemId: problem.id }) });
			added();
		} catch (error) { setError(message(error)); setBusy(false); bundles.reload(); }
	}
	function create(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		void assign(async () => (await api<Homework>('/homework', { method: 'POST', body: JSON.stringify({ title: form.get('title'), instructions: '', dueDate: form.get('dueDate') || null }) })).id);
	}
	return <dialog ref={dialog} onCancel={close} aria-labelledby="add-homework-title"><div className="stack">
		<h2 id="add-homework-title">Добавить «{task.title}» в домашнюю работу</h2>
		<label>Найти домашнюю работу<input type="search" value={search} onChange={event => setSearch(event.target.value)} maxLength={200} /></label>
		{(error || bundles.error) && <p className="error" role="alert">{error || bundles.error}</p>}
		<div>{shown?.items.map(h => <article className="list-row" key={h.id}><div className="grow"><h3>{h.title}</h3><p className="small">{h.dueDate ? `Срок: ${h.dueDate}` : 'Без срока'}</p></div><span className="small">{taskCount(h.taskCount)}</span><button disabled={busy} onClick={() => void assign(async () => h.id)}>Назначить</button></article>)}{shown?.items.length === 0 && <p className="empty">Нет подходящей активной домашней работы.</p>}</div>
		<form className="stack" onSubmit={create}><h3>Новая домашняя работа</h3><label>Название<input name="title" required maxLength={200} defaultValue={title} /></label><label>Срок<input type="date" name="dueDate" /></label><button className="primary" disabled={busy}>Создать и назначить</button></form>
		<div className="row"><button type="button" onClick={close}>Закрыть</button></div>
	</div></dialog>;
}
