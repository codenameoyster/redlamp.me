import { useState } from 'react';
import type { ChapterRef, Homework, LearningSet, LearningSetSummary, SessionUser } from '../shared/leetcode';
import { api, message } from './api';
import { useResource } from './useResource';

type Links = { chapters: ChapterRef[]; sets: Pick<LearningSet, 'slug' | 'title'>[] };

export function Materials({ problemId, homework, user, changed }: { problemId?: string; homework?: Homework; user: SessionUser; changed?: () => void }) {
	const path = homework ? `/homework/${homework.id}` : `/problems/${problemId}`;
	const links = useResource<Links>(`${path}/sets`), chapters = links.data?.chapters;
	const editable = user.role === 'parent';
	const sets = useResource<LearningSetSummary[]>(editable ? '/sets' : null);
	const [error, setError] = useState(''), [busy, setBusy] = useState(false);
	async function change(slug: string, method: string) {
		setBusy(true); setError('');
		try { await api(`${path}/sets/${slug}`, { method, body: JSON.stringify(homework ? { version: homework.version } : {}) }); links.reload(); changed?.(); }
		catch (error) { setError(message(error)); } finally { setBusy(false); }
	}
	const options = sets.data?.filter(s => !links.data?.sets.some(link => link.slug === s.slug)) ?? [];
	return <section className="card card-pad stack"><h2>Материалы</h2>{links.data?.sets.length === 0 && chapters?.length === 0 && <p>Материалов пока нет.</p>}{(error || links.error) && <p className="error" role="alert">{error || links.error}</p>}
		{chapters?.map(c => <div className="row" key={`${c.set}/${c.number}`}><a href={`/leetcode/sets/${c.set}/${c.number}`}>Глава {c.number}. {c.title}</a><small>{c.setTitle}</small></div>)}
		{links.data?.sets.map(set => <div className="row spread" key={set.slug}><a href={`/leetcode/sets/${set.slug}`}>{set.title}</a>{editable && <button disabled={busy} onClick={() => void change(set.slug, 'DELETE')} aria-label={`Отвязать ${set.title}`} data-tip="Убрать связь этой задачи с набором.">Отвязать</button>}</div>)}
		{editable && <form className="row" onSubmit={event => { event.preventDefault(); void change(String(new FormData(event.currentTarget).get('set')), 'PUT'); }}><label className="grow">Набор<select aria-label="Набор" name="set" required><option value="">Выберите набор</option>{options.map(s => <option key={s.slug} value={s.slug}>{s.title}</option>)}</select></label><button disabled={busy} data-tip="Связать эту задачу с выбранным набором.">Привязать</button></form>}
	</section>;
}
