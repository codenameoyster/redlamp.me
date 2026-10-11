import { useState, type SubmitEvent } from 'react';
import { NOTEBOOK_PAGE } from '../shared/leetcode';
import { api, message } from './api';

export function Login() {
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);
	async function submit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		setBusy(true); setError('');
		try {
			await api('/session', { method: 'POST', body: JSON.stringify({ username: String(form.get('username')).trim(), password: form.get('password') }) });
			const target = new URL(new URLSearchParams(location.search).get('return') ?? '', location.origin);
			location.replace(NOTEBOOK_PAGE.test(target.pathname) ? target.pathname + target.search : '/leetcode');
		} catch (error) { setError(message(error)); setBusy(false); }
	}
	return <main className="login"><div className="logo"><span className="logo-mark" aria-hidden="true">r.</span><strong>redlamp</strong></div><div><h1>Тетрадь LeetCode</h1><p>Войдите, чтобы продолжить обучение.</p></div><form className="stack" onSubmit={submit}>
		<label>Имя пользователя<input name="username" autoComplete="username" required maxLength={40} /></label>
		<label>Пароль<input name="password" type="password" autoComplete="current-password" required maxLength={256} /></label>
		{error && <p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>Войти</button>
	</form></main>;
}
