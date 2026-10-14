import { useEffect, useRef, useState, type RefObject, type SubmitEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Figure, Homework, HomeworkSummary, LearningSetDetails, LearningSetSummary, Page, Problem, QuizDeck, SessionUser, SetTask, SetTaskRow } from '../shared/leetcode';
import { api, message } from './api';
import { useResource } from './useResource';
import { highlight } from './highlight';
import { plural } from './text';
import { difficultyLabels, homeworkLabels } from './Homework';
import { Tutor } from './Tutor';
import { deckStatus } from './Quiz';
import { LessonFigure } from './LessonFigure';
import { runTests, type RunResult } from './python';
import { markTerms, Terms } from './Terms';

const taskCount = (count: number) => plural(count, ['задание', 'задания', 'заданий']);
export const addProblem = (task: SetTask) => api<Problem>('/problems', { method: 'POST', body: JSON.stringify({ url: task.url, number: task.number ?? null, title: task.title, difficulty: task.difficulty, topics: task.topics, summary: task.note }) });

export function Sets({ user, slug, chapter }: { user: SessionUser; slug?: string; chapter?: number }) {
	if (!slug) return <SetList />;
	return chapter ? <ChapterPage key={`${slug}/${chapter}`} slug={slug} number={chapter} user={user} /> : <SetOverview key={slug} slug={slug} user={user} />;
}
function SetList() {
	const sets = useResource<LearningSetSummary[]>('/sets');
	return <div className="stack"><div className="heading"><div><h1>Бомжарня</h1><p>Темы по порядку: теория, задачи, квиз.</p></div></div>
		{sets.error && <p className="error" role="alert">{sets.error}</p>}
		<div className="lesson-grid">{sets.data?.map(s => <article className="card card-pad stack" key={s.slug}><h2><a href={`/leetcode/sets/${s.slug}`}>{s.title}</a></h2><p><Terms text={s.summary} /></p><div className="tags">{s.topics.map(t => <span className="tag" key={t}>{t}</span>)}</div><div className="row small"><span>{plural(s.chapterCount, ['глава', 'главы', 'глав'])}</span><span>{s.acceptedCount} из {s.taskCount} заданий принято</span></div></article>)}</div>
	</div>;
}

function SetOverview({ slug, user }: { slug: string; user: SessionUser }) {
	const details = useResource<LearningSetDetails>(`/sets/${slug}`), decks = useResource<QuizDeck[]>('/quiz');
	const set = details.data;
	if (!set) return <p role="status">{details.error || 'Открываем набор...'}</p>;
	return <div className="stack"><div className="heading"><div><h1>{set.title}</h1><p><Terms text={set.summary} /></p></div><div className="row">{user.role === 'student' && <Tutor context={{ kind: 'set', id: slug }} title={set.title} />}</div></div>
		{(details.error || decks.error) && <p className="error" role="alert">{details.error || decks.error}</p>}
		<p>Идите по порядку: каждая глава опирается на предыдущую.</p>
		<section className="card">{set.chapters.map(c => <article className="list-row" key={c.number}><span className="small">Глава {c.number}</span><div className="grow"><h2><a href={`/leetcode/sets/${slug}/${c.number}`}>{c.title}</a></h2><p className="small"><Terms text={c.summary} /></p><p className="small">Задач принято {c.tasks.filter(t => t.accepted).length} из {c.tasks.length}</p><p className="small">Квиз. {deckStatus(decks.data?.find(deck => deck.slug === `${slug}-${c.number}`))}</p></div><a className="button" href={`/leetcode/sets/${slug}/${c.number}`} data-tip="Открыть урок и задачи этой главы.">Открыть главу</a></article>)}</section>
	</div>;
}

function ChapterPage({ slug, number, user }: { slug: string; number: number; user: SessionUser }) {
	const details = useResource<LearningSetDetails>(`/sets/${slug}`), decks = useResource<QuizDeck[]>('/quiz'), lesson = useResource<{ html: string; figures: Figure[] }>(`/sets/${slug}/lesson/${number}`);
	const [adding, setAdding] = useState<SetTaskRow | null>(null), article = useRef<HTMLElement>(null);
	const set = details.data, chapter = set?.chapters[number - 1], html = set && lesson.data?.html;
	if (!set) return <p role="status">{details.error || 'Открываем набор...'}</p>;
	if (!chapter) return <p role="alert">Такой главы нет. <a href={`/leetcode/sets/${slug}`}>К набору</a></p>;
	return <div className="stack"><div className="heading"><div><h1>Глава {number}. {chapter.title}</h1><p><Terms text={chapter.summary} /></p></div><div className="row">{user.role === 'student' && <Tutor context={{ kind: 'set', id: slug }} title={set.title} lesson={article} />}</div></div>
		{(details.error || decks.error || lesson.error) && <p className="error" role="alert">{details.error || decks.error || lesson.error}</p>}
		<Lesson html={html ?? ''} figures={lesson.data?.figures} ref={article} />
		<section className="card"><header className="card-head"><h2>Задачи</h2></header>{chapter.tasks.map(t => <article className="list-row" key={t.slug}><span className="small">{t.label}</span><div className="grow"><h3>{t.problemId ? <a href={`/leetcode/problems/${t.problemId}`}>{t.title}</a> : <a href={t.url} target="_blank" rel="noopener noreferrer">{t.title}</a>}</h3><p className="small">{t.note}</p></div><span className={`tag ${t.difficulty}`}>{difficultyLabels[t.difficulty]}</span>{t.accepted && <span className="tag good">Принято</span>}{t.activeTask && <a className="tag" href={`/leetcode/tasks/${t.activeTask.id}`}>{homeworkLabels[t.activeTask.state]}</a>}{user.role === 'parent' && !t.activeTask && <button onClick={() => setAdding(t)} data-tip="Выбрать домашнюю работу для этой задачи.">Добавить в домашнюю работу</button>}</article>)}</section>
		<section className="card card-pad stack"><h2>Квиз главы</h2><p>{deckStatus(decks.data?.find(deck => deck.slug === `${slug}-${number}`))}</p><div className="row"><a className="button" href={`/leetcode/quiz/${slug}-${number}`} data-tip="Открыть карточки квиза по этой главе.">Пройти квиз</a></div></section>
		<section className="card card-pad stack"><h2>Где узнать больше</h2><ul>{chapter.links.map(link => <li key={link.url}><a href={link.url} target="_blank" rel="noopener noreferrer">{link.title}</a> <small>{link.source}</small></li>)}</ul></section>
		<nav className="row" aria-label="Главы">{number > 1 && <a className="button" href={`/leetcode/sets/${slug}/${number - 1}`} data-tip="Перейти к предыдущей главе.">Предыдущая глава</a>}<a className="button" href={`/leetcode/sets/${slug}`} data-tip="Вернуться к списку глав набора.">К набору</a>{number < set.chapters.length && <a className="button" href={`/leetcode/sets/${slug}/${number + 1}`} data-tip="Перейти к следующей главе.">Следующая глава</a>}</nav>
		{adding && <AddToHomework task={adding} title={set.title} close={() => setAdding(null)} added={() => { setAdding(null); details.reload(); }} />}
	</div>;
}

// The lesson HTML is repository content: src/leetcode/sets/<set>/chapter<N>.html. Each figure draws into its placeholder <figure data-figure="id">.
// Each Python sample without the class no-run gets a run button and an output inside its <pre>. The first use of each glossary word gets its tip.
export function Lesson({ html, figures, ref }: { html: string; figures?: Figure[]; ref: RefObject<HTMLElement | null> }) {
	const [slots, setSlots] = useState<[Figure, Element][]>([]), [samples, setSamples] = useState<[string, Element][]>([]);
	useEffect(() => {
		for (const code of ref.current?.querySelectorAll('pre code') ?? []) code.innerHTML = highlight(/\blanguage-(\S+)/.exec(code.className)?.[1] ?? 'python', code.textContent ?? '').html;
		if (ref.current) markTerms(ref.current);
		setSlots((figures ?? []).flatMap(figure => { const slot = ref.current?.querySelector(`figure[data-figure="${figure.id}"]`); return slot ? [[figure, slot] as [Figure, Element]] : []; }));
		setSamples([...ref.current?.querySelectorAll('pre:not(.no-run) > code.language-python') ?? []].map(code => [code.textContent ?? '', code.parentElement!]));
	}, [html, figures]);
	return <><article className="lesson" ref={ref} dangerouslySetInnerHTML={{ __html: html }} />{slots.map(([figure, slot]) => createPortal(<LessonFigure figure={figure} />, slot, figure.id))}{samples.map(([code, pre], index) => createPortal(<Sample code={code} />, pre, `sample-${index}`))}</>;
}

// A sample runs as a stdio program with no input. The run is not saved.
// The tip of the button shows below it, so the output is above the button. The old output stays until the new one comes, so the button does not jump.
// The output is a live region before the first run, so a screen reader reads the first result too.
function Sample({ code }: { code: string }) {
	const [busy, setBusy] = useState(false), [result, setResult] = useState<Pick<RunResult, 'output' | 'error'> | null>(null);
	async function run() {
		setBusy(true);
		try { await runTests(code, { mode: 'stdio' }, [{ input: '', expected: null }], setResult); } catch (error) { setResult({ output: '', error: { message: message(error), line: null } }); } finally { setBusy(false); }
	}
	return <span className="sample">
		<output>{result && <>{result.output}{result.error ? <span className="error">{result.error.line ? `Строка ${result.error.line}: ` : ''}{result.error.message}</span> : !result.output && 'Программа ничего не напечатала.'}</>}</output>
		<button type="button" disabled={busy} onClick={() => void run()} data-tip="Выполнить этот код в браузере и показать, что он печатает.">{busy ? 'Запускаем…' : 'Запустить'}</button>
	</span>;
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
			const problem = await addProblem(task);
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
		<div>{shown?.items.map(h => <article className="list-row" key={h.id}><div className="grow"><h3>{h.title}</h3><p className="small">{h.dueDate ? `Срок: ${h.dueDate}` : 'Без срока'}</p></div><span className="small">{taskCount(h.taskCount)}</span><button disabled={busy} onClick={() => void assign(async () => h.id)} data-tip="Добавить задачу в эту домашнюю работу.">Назначить</button></article>)}{shown?.items.length === 0 && <p className="empty">Нет подходящей активной домашней работы.</p>}</div>
		<form className="stack" onSubmit={create}><h3>Новая домашняя работа</h3><label>Название<input name="title" required maxLength={200} defaultValue={title} /></label><label>Срок<input type="date" name="dueDate" /></label><button className="primary" disabled={busy} data-tip="Создать домашнюю работу и добавить в неё задачу.">Создать и назначить</button></form>
		<div className="row"><button type="button" onClick={close} data-tip="Закрыть окно без изменений.">Закрыть</button></div>
	</div></dialog>;
}
