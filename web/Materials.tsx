import { useState } from 'react';
import type { Homework, LearningSet, LearningSetSummary, SessionUser } from '../shared/leetcode';
import { api, message } from './api';
import { useResource } from './useResource';

export function Materials({ problemId, homework, user, changed }: { problemId?: string; homework?: Homework; user: SessionUser; changed?: () => void }) {
	const path = homework ? `/homework/${homework.id}` : `/problems/${problemId}`;
	const links = useResource<Pick<LearningSet, 'slug' | 'title'>[]>(`${path}/sets`);
	const editable = user.role === 'parent';
	const sets = useResource<LearningSetSummary[]>(editable ? '/sets' : null);
	const [error, setError] = useState(''), [busy, setBusy] = useState(false);
	async function change(slug: string, method: string) {
		setBusy(true); setError('');
		try { await api(`${path}/sets/${slug}`, { method, body: JSON.stringify(homework ? { version: homework.version } : {}) }); links.reload(); changed?.(); }
		catch (error) { setError(message(error)); } finally { setBusy(false); }
	}
	const options = sets.data?.filter(s => !links.data?.some(link => link.slug === s.slug)) ?? [];
	return <section className="card card-pad stack"><h2>Материалы</h2>{links.data?.length === 0 && <p>Материалов пока нет.</p>}{(error || links.error) && <p className="error" role="alert">{error || links.error}</p>}
		{links.data?.map(set => <div className="row spread" key={set.slug}><a href={`/leetcode/sets/${set.slug}`}>{set.title}</a>{editable && <button disabled={busy} onClick={() => void change(set.slug, 'DELETE')} aria-label={`Отвязать ${set.title}`}>Отвязать</button>}</div>)}
		{editable && <form className="row" onSubmit={event => { event.preventDefault(); void change(String(new FormData(event.currentTarget).get('set')), 'PUT'); }}><label className="grow">Набор<select aria-label="Набор" name="set" required><option value="">Выберите набор</option>{options.map(s => <option key={s.slug} value={s.slug}>{s.title}</option>)}</select></label><button disabled={busy}>Привязать</button></form>}
	</section>;
}
