import { useState, type SubmitEvent } from 'react';
import { MAX_LESSON_BYTES, NOTEBOOK_PAGE, type Homework, type Lesson, type Page, type SessionUser } from '../shared/leetcode';
import { api, message } from './api';
import { useResource } from './useResource';

export function LessonLinks({ problemId, homework, user, changed }: { problemId?: string; homework?: Homework; user: SessionUser; changed?: () => void }) {
	const path = homework ? `/homework/${homework.id}/lessons` : `/problems/${problemId}/lessons`;
	const links = useResource<Page<Lesson>>(path);
	const editable = user.role === 'parent';
	const [offset, setOffset] = useState(0);
	const available = useResource<Page<Lesson>>(editable ? `/lessons?offset=${offset}` : null);
	const [error, setError] = useState(''), [busy, setBusy] = useState(false);
	async function change(id: string, method: string) {
		setBusy(true); setError('');
		try { await api(`${path}/${id}`, { method, body: JSON.stringify(homework ? { version: homework.version } : {}) }); links.reload(); changed?.(); }
		catch (error) { setError(message(error)); } finally { setBusy(false); }
	}
	return <section className="card card-pad stack"><h2>Related lessons</h2>{links.data?.items.length === 0 && <p>No lessons linked yet.</p>}{(error || links.error) && <p className="error" role="alert">{error || links.error}</p>}
		{links.data?.items.map(lesson => <div className="row spread" key={lesson.id}><a href={`/leetcode/lessons/${lesson.id}?back=${encodeURIComponent(location.pathname)}`}>{lesson.title}</a>{editable && <button disabled={busy} onClick={() => void change(lesson.id, 'DELETE')} aria-label={`Unlink ${lesson.title}`}>Unlink</button>}</div>)}
		{editable && <form className="row" onSubmit={event => { event.preventDefault(); void change(String(new FormData(event.currentTarget).get('lesson')), 'PUT'); }}><label className="grow">Related lesson<select aria-label="Related lesson" name="lesson" required><option value="">Select a lesson</option>{available.data?.items.filter(l => !links.data?.items.some(link => link.id === l.id)).map(l => <option key={l.id} value={l.id}>{l.title}</option>)}</select></label><button disabled={busy}>Link lesson</button>{offset > 0 && <button type="button" onClick={() => setOffset(offset - 50)}>Previous lessons</button>}{available.data?.nextOffset != null && <button type="button" onClick={() => setOffset(available.data!.nextOffset!)}>More lessons</button>}</form>}
	</section>;
}

export function Lessons({ user, id }: { user: SessionUser; id?: string }) { return id ? <LessonView id={id} user={user} /> : <LessonLibrary user={user} />; }
function LessonLibrary({ user }: { user: SessionUser }) {
	const lessons = useResource<Page<Lesson>>(`/lessons${location.search}`);
	const [error, setError] = useState(''), [busy, setBusy] = useState(false);
	async function upload(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault(); setBusy(true); setError('');
		const form = new FormData(event.currentTarget), file = form.get('file') as File;
		try {
			if (file.size > MAX_LESSON_BYTES) throw new Error('Keep HTML files within 1,000,000 bytes.');
			const body = new FormData(); body.set('file', file); body.set('metadata', JSON.stringify({ title: form.get('title'), description: form.get('description'), topics: String(form.get('topics')).split(',').map(s => s.trim()).filter(Boolean) }));
			const lesson = await api<Lesson>('/lessons', { method: 'POST', body }); location.assign(`/leetcode/lessons/${lesson.id}`);
		} catch (error) { setError(message(error)); setBusy(false); }
	}
	return <div className="stack"><div className="heading"><div><h1>Lessons</h1><p>Explore an example, then apply it to a problem.</p></div><a href={location.search.includes('archived=1') ? '/leetcode/lessons' : '/leetcode/lessons?archived=1'}>{location.search.includes('archived=1') ? 'Active lessons' : 'Archived lessons'}</a></div>
		{(error || lessons.error) && <p className="error" role="alert">{error || lessons.error}</p>}
		<div className="lesson-grid">{lessons.data?.items.map(l => <article className="card card-pad stack" key={l.id}><h2><a href={`/leetcode/lessons/${l.id}`}>{l.title}</a></h2><p>{l.description}</p><div className="tags">{l.topics.map(t => <span className="tag" key={t}>{t}</span>)}</div><small>{l.byteCount.toLocaleString()} bytes</small></article>)}</div>{lessons.data?.items.length === 0 && <p className="empty">No lessons yet. {user.role === 'parent' ? 'Upload a self-contained HTML lesson below.' : 'Your parent can upload a lesson.'}</p>}
		{lessons.data?.nextOffset != null && <a href={`?offset=${lessons.data.nextOffset}${location.search.includes('archived=1') ? '&archived=1' : ''}`}>More lessons</a>}
		{user.role === 'parent' && <form className="card card-pad stack" onSubmit={upload}><h2>Upload an HTML lesson</h2><p>Use a self-contained UTF-8 file, at most 1,000,000 bytes. Embed scripts, styles, images, and fonts. External resources, network APIs, and persistent browser storage are unavailable.</p><label>Title<input name="title" maxLength={200} required /></label><label>Description<textarea aria-label="Description" name="description" maxLength={8000} /></label><label>Topics<input name="topics" placeholder="Separate topics with commas" /></label><label>HTML file<input name="file" type="file" accept=".html,.htm,text/html" required /></label><button className="primary" disabled={busy}>Upload and preview</button></form>}
	</div>;
}
function LessonView({ id, user }: { id: string; user: SessionUser }) {
	const lesson = useResource<Lesson>(`/lessons/${id}`);
	const [editing, setEditing] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false);
	const record = lesson.data;
	async function update(event?: SubmitEvent<HTMLFormElement>) {
		event?.preventDefault();
		if (!event && !confirm('Archive this lesson? Existing links will remain available.')) return;
		setBusy(true); setError('');
		const form = event ? new FormData(event.currentTarget) : null;
		try {
			await api(`/lessons/${id}${form ? '' : '/archive'}`, { method: form ? 'PATCH' : 'POST', body: JSON.stringify({ version: record!.version, ...(form ? { title: form.get('title'), description: form.get('description'), topics: String(form.get('topics')).split(',').map(s => s.trim()).filter(Boolean) } : {}) }) }); setEditing(false); lesson.reload();
		} catch (error) { setError(message(error)); } finally { setBusy(false); }
	}
	if (!record) return <p role="status">{lesson.error || 'Opening lesson...'}</p>;
	const back = new URLSearchParams(location.search).get('back') ?? '/leetcode/lessons';
	return <div className="stack"><div className="heading"><div><h1>{record.title}</h1><p>{record.byteCount.toLocaleString()} bytes {record.archivedAt && '- Archived'}</p></div><a className="button" href={NOTEBOOK_PAGE.test(back) ? back : '/leetcode/lessons'}>Back</a></div><p className="prose">{record.description}</p><div className="row"><a className="button" href={`/leetcode/api/lessons/${id}/content`} target="_blank" rel="noopener noreferrer">Full-page display</a><a className="button" href={`/leetcode/api/lessons/${id}/download`} download>Download original</a>{user.role === 'parent' && <><button onClick={() => setEditing(!editing)}>Edit lesson details</button>{!record.archivedAt && <button disabled={busy} onClick={() => void update()}>Archive lesson</button>}</>}</div>
		{(error || lesson.error) && <p className="error" role="alert">{error || lesson.error}</p>}
		{editing && <form onSubmit={update} className="card card-pad stack"><label>Title<input name="title" defaultValue={record.title} required maxLength={200} /></label><label>Description<textarea aria-label="Description" name="description" defaultValue={record.description} maxLength={8000} /></label><label>Topics<input name="topics" defaultValue={record.topics.join(', ')} /></label><button disabled={busy}>Save lesson details</button></form>}
		<iframe title={record.title} src={`/leetcode/api/lessons/${id}/content`} sandbox="allow-scripts" className="lesson-frame" />
	</div>;
}
