import { useState } from 'react';
import type { Page, SessionUser, TutorAccount, TutorThread } from '../shared/leetcode';
import { api, message } from './api';
import { useResource } from './useResource';

export function TutorPage({ user }: { user: SessionUser }) {
	return <div className="stack"><div className="heading"><div><h1>AI tutor</h1><p>{user.role === 'parent' ? 'Connect ChatGPT for the hint-first tutor. Read the chats of the student.' : 'This page is for the parent.'}</p></div></div>{user.role === 'parent' && <><Connection /><Threads /></>}</div>;
}

const kinds = { problem: 'Problem', set: 'Set', lesson: 'Lesson' };
function Threads() {
	const [offset, setOffset] = useState(0);
	const threads = useResource<Page<TutorThread>>(`/tutor/threads?offset=${offset}`);
	return <section className="card" aria-labelledby="chats-title"><header className="card-head"><h2 id="chats-title">Chats</h2></header>
		{threads.error && <p className="error" role="alert">{threads.error}</p>}
		{threads.data?.items.map(t => <article className="list-row" key={`${t.kind}:${t.id}`}><div className="grow"><h3><a href={`/leetcode/${t.kind}s/${t.id}#tutor`}>{t.title}</a></h3></div><span className="tag">{kinds[t.kind]}</span><span className="small">{t.count} {t.count === 1 ? 'message' : 'messages'}</span><span className="small">{new Date(t.lastAt).toLocaleString()}</span></article>)}
		{threads.data?.items.length === 0 && <p className="empty">No chats yet.</p>}
		{(offset > 0 || threads.data?.nextOffset != null) && <div className="row card-pad">{offset > 0 && <button onClick={() => setOffset(Math.max(0, offset - 50))}>Newer chats</button>}{threads.data?.nextOffset != null && <button onClick={() => setOffset(threads.data!.nextOffset!)}>Older chats</button>}</div>}
	</section>;
}

function Connection() {
	const account = useResource<TutorAccount>('/tutor/account');
	const [url, setUrl] = useState(''), [address, setAddress] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
	async function run(action: () => Promise<void>) {
		setBusy(true); setError(''); setNotice('');
		try { await action(); } catch (error) { setError(message(error)); } finally { setBusy(false); }
	}
	const data = account.data;
	return <section className="card card-pad stack"><h2>ChatGPT connection</h2>
		<p role="status">{data ? data.connected ? `Connected on ${new Date(data.connectedAt!).toLocaleDateString()}. Model: ${data.model}.` : 'Not connected.' : account.error || 'Opening the connection...'}</p>
		<p>The AI tutor uses your ChatGPT plan. The student's questions and the page context go to OpenAI. <a href="https://chatgpt.com/settings/usage" target="_blank" rel="noopener noreferrer">Manage usage</a></p>
		{data?.connected && <label>Model<select value={data.model ?? ''} onChange={event => { const model = event.target.value; account.setData({ ...data, model }); void run(async () => account.setData(await api<TutorAccount>('/tutor/account', { method: 'PATCH', body: JSON.stringify({ model }) }))); }}>{data.models.map(m => <option key={m.slug} value={m.slug}>{m.name}</option>)}</select></label>}
		<div className="row"><button className="primary" disabled={busy} onClick={() => void run(async () => setUrl((await api<{ url: string }>('/tutor/account/start', { method: 'POST' })).url))}>Continue with ChatGPT</button>
			{data?.connected && <button disabled={busy} onClick={() => { if (confirm('Disconnect ChatGPT? The student cannot use the AI tutor until you connect again.')) void run(async () => { if (!(await api<{ revoked: boolean }>('/tutor/account', { method: 'DELETE' })).revoked) setNotice('ChatGPT did not confirm. Remove the app in ChatGPT settings.'); setUrl(''); account.reload(); }); }}>Disconnect</button>}</div>
		{url && <form className="stack" onSubmit={event => { event.preventDefault(); void run(async () => { account.setData(await api<TutorAccount>('/tutor/account/finish', { method: 'POST', body: JSON.stringify({ address }) })); setUrl(''); setAddress(''); }); }}><ol>
			<li><a href={url} target="_blank" rel="noopener noreferrer">Open the ChatGPT sign-in page</a></li>
			<li>Approve access. The browser then shows an error page for 127.0.0.1. This is expected.</li>
			<li>Copy the full address from that page and paste it here.</li>
		</ol><label>Address from the error page<input type="url" value={address} onChange={event => setAddress(event.target.value)} maxLength={4000} required /></label><button className="primary" disabled={busy}>Connect</button></form>}
		{error && <p className="error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
	</section>;
}
