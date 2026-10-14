import { useState } from 'react';
import type { SessionUser, TutorAccount } from '../shared/leetcode';
import { api, message } from './api';
import { useResource } from './useResource';

export function TutorPage({ user }: { user: SessionUser }) {
	return <div className="stack"><div className="heading"><div><h1>ИИ-репетитор</h1><p>{user.role === 'parent' ? 'Подключите ChatGPT для репетитора, который даёт подсказки ученику.' : 'Эта страница для родителя.'}</p></div></div>{user.role === 'parent' && <Connection />}</div>;
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
