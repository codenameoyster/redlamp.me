import { useState } from 'react';
import type { Page, SessionUser, TutorAccount, TutorThread } from '../shared/leetcode';
import { api, message } from './api';
import { useResource } from './useResource';
import { plural } from './text';

export function TutorPage({ user }: { user: SessionUser }) {
	return <div className="stack"><div className="heading"><div><h1>ИИ-репетитор</h1><p>{user.role === 'parent' ? 'Подключите ChatGPT для репетитора, который даёт подсказки. Читайте чаты ученика.' : 'Эта страница для родителя.'}</p></div></div>{user.role === 'parent' && <><Connection /><Threads /></>}</div>;
}

const kinds = { problem: 'Задача', set: 'Набор' };
function Threads() {
	const [offset, setOffset] = useState(0);
	const threads = useResource<Page<TutorThread>>(`/tutor/threads?offset=${offset}`);
	return <section className="card" aria-labelledby="chats-title"><header className="card-head"><h2 id="chats-title">Чаты</h2></header>
		{threads.error && <p className="error" role="alert">{threads.error}</p>}
		{threads.data?.items.map(t => <article className="list-row" key={`${t.kind}:${t.id}`}><div className="grow"><h3><a href={`/leetcode/${t.kind}s/${t.id}#tutor`}>{t.title}</a></h3></div><span className="tag">{kinds[t.kind]}</span><span className="small">{plural(t.count, ['сообщение', 'сообщения', 'сообщений'])}</span><span className="small">{new Date(t.lastAt).toLocaleString('ru-RU')}</span></article>)}
		{threads.data?.items.length === 0 && <p className="empty">Чатов пока нет.</p>}
		{(offset > 0 || threads.data?.nextOffset != null) && <div className="row card-pad">{offset > 0 && <button onClick={() => setOffset(Math.max(0, offset - 50))} data-tip="Показать более новые чаты.">Новее</button>}{threads.data?.nextOffset != null && <button onClick={() => setOffset(threads.data!.nextOffset!)} data-tip="Показать более старые чаты.">Старее</button>}</div>}
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
	return <section className="card card-pad stack"><h2>Подключение ChatGPT</h2>
		<p role="status">{data ? data.connected ? `Подключено ${new Date(data.connectedAt!).toLocaleDateString('ru-RU')}. Модель: ${data.model}.` : 'Не подключено.' : account.error || 'Открываем подключение...'}</p>
		<p>ИИ-репетитор использует вашу подписку ChatGPT. Вопросы ученика и контекст страницы уходят в OpenAI. <a href="https://chatgpt.com/settings/usage" target="_blank" rel="noopener noreferrer">Управлять использованием</a></p>
		{data?.connected && <label>Модель<select value={data.model ?? ''} onChange={event => { const model = event.target.value; account.setData({ ...data, model }); void run(async () => account.setData(await api<TutorAccount>('/tutor/account', { method: 'PATCH', body: JSON.stringify({ model }) }))); }}>{data.models.map(m => <option key={m.slug} value={m.slug}>{m.name}</option>)}</select></label>}
		<div className="row"><button className="primary" disabled={busy} onClick={() => void run(async () => setUrl((await api<{ url: string }>('/tutor/account/start', { method: 'POST' })).url))} data-tip="Получить ссылку для входа в ChatGPT.">Продолжить с ChatGPT</button>
			{data?.connected && <button disabled={busy} onClick={() => { if (confirm('Отключить ChatGPT? Ученик не сможет пользоваться ИИ-репетитором, пока вы не подключите его снова.')) void run(async () => { if (!(await api<{ revoked: boolean }>('/tutor/account', { method: 'DELETE' })).revoked) setNotice('ChatGPT не подтвердил отключение. Удалите приложение в настройках ChatGPT.'); setUrl(''); account.reload(); }); }} data-tip="Отключить ChatGPT от ИИ-репетитора.">Отключить</button>}</div>
		{url && <form className="stack" onSubmit={event => { event.preventDefault(); void run(async () => { account.setData(await api<TutorAccount>('/tutor/account/finish', { method: 'POST', body: JSON.stringify({ address }) })); setUrl(''); setAddress(''); }); }}><ol>
			<li><a href={url} target="_blank" rel="noopener noreferrer">Открыть страницу входа ChatGPT</a></li>
			<li>Разрешите доступ. Затем браузер покажет страницу ошибки для 127.0.0.1. Так и должно быть.</li>
			<li>Скопируйте полный адрес с той страницы и вставьте его сюда.</li>
		</ol><label>Адрес со страницы ошибки<input type="url" value={address} onChange={event => setAddress(event.target.value)} maxLength={4000} required /></label><button className="primary" disabled={busy} data-tip="Завершить подключение ChatGPT по этому адресу.">Подключить</button></form>}
		{error && <p className="error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
	</section>;
}
