import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { LoaderCircle } from 'lucide-react';
import type { Page, Problem, ProblemDetails } from '../shared/leetcode';
import { api, message } from './api';
import { useResource } from './useResource';

export const difficultyLabels = { easy: 'Легко', medium: 'Средне', hard: 'Сложно' };

export function ProblemForm({ problem, close, saved }: { problem?: Problem; close: () => void; saved: (problem: Problem) => void }) {
	const dialog = useRef<HTMLDialogElement>(null);
	const [error, setError] = useState(''), [busy, setBusy] = useState(false), [lookup, setLookup] = useState(''), looked = useRef('');
	useEffect(() => {
		const previous = document.activeElement, element = dialog.current;
		element?.showModal();
		return () => { element?.close(); if (previous instanceof HTMLElement) previous.focus(); };
	}, []);
	async function fill(input: HTMLInputElement) {
		const url = input.value.trim();
		looked.current = url; setLookup('loading');
		try {
			const details = await api<ProblemDetails>(`/problem-details?url=${encodeURIComponent(url)}`);
			if (looked.current !== url) return;
			const set = (name: string, value: string) => { (input.form!.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement).value = value; };
			set('title', details.title); set('number', details.number?.toString() ?? ''); set('difficulty', details.difficulty); set('topics', details.topics.join(', '));
			setLookup('');
		} catch (error) { if (looked.current === url) setLookup(message(error)); }
	}
	async function submit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault(); setBusy(true); setError('');
		const form = new FormData(event.currentTarget);
		const value = { url: form.get('url'), number: form.get('number') ? Number(form.get('number')) : null, title: form.get('title'), difficulty: form.get('difficulty'), topics: String(form.get('topics')).split(',').map(s => s.trim()).filter(Boolean), summary: form.get('summary'), ...(problem ? { version: problem.version } : {}) };
		try { saved(await api<Problem>(problem ? `/problems/${problem.id}` : '/problems', { method: problem ? 'PATCH' : 'POST', body: JSON.stringify(value) })); }
		catch (error) { setError(message(error)); setBusy(false); }
	}
	return <dialog ref={dialog} onCancel={close} aria-labelledby="problem-form-title"><form onSubmit={submit} className="stack">
		<h2 id="problem-form-title">{problem ? 'Изменить задачу' : 'Добавить задачу'}</h2>
		<label>Ссылка на LeetCode<input name="url" type="url" required maxLength={2000} defaultValue={problem?.url} onChange={event => { if (!problem && (event.nativeEvent as InputEvent).inputType === 'insertFromPaste') void fill(event.currentTarget); }} /></label>
		{lookup && <p className="small lookup" role="status">{lookup === 'loading' ? <><LoaderCircle size={16} className="spin" />Заполняем данные из LeetCode</> : lookup}</p>}
		<label>Название<input name="title" required maxLength={200} defaultValue={problem?.title} /></label>
		<div className="editor-grid"><label>Номер задачи<input name="number" type="number" min="1" defaultValue={problem?.number ?? ''} /></label><label>Сложность<select name="difficulty" defaultValue={problem?.difficulty ?? 'medium'}>{Object.entries(difficultyLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
		<div><label>Темы<input name="topics" aria-describedby="topics-help" defaultValue={problem?.topics.join(', ')} placeholder="Массивы, скользящее окно" /></label><small id="topics-help">Разделяйте темы запятыми. Не больше 12.</small></div>
		<label>Описание<textarea aria-label="Описание" name="summary" maxLength={8000} defaultValue={problem?.summary} /></label>
		{error && <p className="error" role="alert">{error}</p>}<div className="row spread"><button type="button" onClick={close}>Отмена</button><button className="primary" disabled={busy}>Сохранить задачу</button></div>
	</form></dialog>;
}

export function Problems() {
	const { data, error, reload } = useResource<Page<Problem>>(`/problems${location.search}`);
	const [adding, setAdding] = useState(false);
	const query = new URLSearchParams(location.search);
	function filter(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		const params = new URLSearchParams();
		for (const [key, value] of new FormData(event.currentTarget)) if (value) params.set(key, String(value));
		location.assign(`/leetcode/problems?${params}`);
	}
	return <div className="stack"><div className="heading"><div><h1>Задачи</h1><p>Записывайте ход мысли, код и выводы.</p></div><button className="primary" onClick={() => setAdding(true)}>Добавить задачу</button></div>
		<form onSubmit={filter} className="card card-pad stack"><label>Поиск по задачам и заметкам<input name="q" type="search" maxLength={100} defaultValue={query.get('q') ?? ''} /></label><div className="filters">
			<label>Сложность<select name="difficulty" defaultValue={query.get('difficulty') ?? ''}><option value="">Любая сложность</option>{Object.entries(difficultyLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
			<label>Тема<input name="topic" maxLength={40} defaultValue={query.get('topic') ?? ''} /></label>
			<label>Статус на LeetCode<select name="solved" defaultValue={query.get('solved') ?? ''}><option value="">Все задачи</option><option value="1">Принято на LeetCode</option><option value="0">Ещё не принято</option></select></label>
			<label>Понимание<select name="understanding" defaultValue={query.get('understanding') ?? ''}><option value="">Любое понимание</option><option value="needs_practice">Нужно потренироваться</option><option value="with_help">Решил с подсказкой</option><option value="independent">Решил сам</option></select></label>
			<label>Домашняя работа<select name="homework" defaultValue={query.get('homework') ?? ''}><option value="">Все задачи</option><option value="1">Есть активное задание</option><option value="0">Нет активного задания</option></select></label>
			<label>Повторение до<input type="date" name="due" defaultValue={query.get('due') ?? ''} /></label>
			<label>Библиотека<select name="archived" defaultValue={query.get('archived') ?? ''}><option value="">Активные задачи</option><option value="1">Задачи в архиве</option></select></label>
		</div><div className="row"><button>Применить фильтры</button><a href="/leetcode/problems">Сбросить фильтры</a></div></form>
		{error && <p className="error" role="alert">{error} <button onClick={reload}>Попробовать снова</button></p>}
		{data && <section className="card" aria-label="Библиотека задач">{data.items.length ? data.items.map(problem => <article className="list-row" key={problem.id}><span className="small">{problem.number ? `#${problem.number}` : ''}</span><div className="grow"><h2><a href={`/leetcode/problems/${problem.id}`}>{problem.title}</a></h2><p>{problem.topics.join(', ')}</p></div><span className={`tag ${problem.difficulty}`}>{difficultyLabels[problem.difficulty]}</span><span className="tag">{problem.solved ? 'Принято' : 'Ещё не принято'}</span></article>) : <p className="empty">Ничего не найдено. Добавьте задачу или измените фильтры.</p>}</section>}
		{data?.nextOffset !== null && data?.nextOffset !== undefined && <a className="button" href={`?${new URLSearchParams({ ...Object.fromEntries(query), offset: String(data.nextOffset) })}`}>Ещё задачи</a>}
		{adding && <ProblemForm close={() => setAdding(false)} saved={problem => location.assign(`/leetcode/problems/${problem.id}`)} />}
	</div>;
}
