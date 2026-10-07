import { useState, type FormEvent } from 'react';
import { api, message } from './api';

export function Login() {
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		setBusy(true); setError('');
		try {
			await api('/session', { method: 'POST', body: JSON.stringify({ username: String(form.get('username')).trim(), password: form.get('password') }) });
			const path = new URLSearchParams(location.search).get('return') ?? '/leetcode';
			location.replace(/^\/leetcode(?:\/(?:problems|homework|lessons)(?:\/[a-f0-9-]{36}(?:\/review)?)?)?$/.test(path) ? path : '/leetcode');
		} catch (error) { setError(message(error)); setBusy(false); }
	}
	return <main className="login"><div className="logo"><span className="logo-mark" aria-hidden="true">r.</span><strong>redlamp</strong></div><div><h1>LeetCode notebook</h1><p>Sign in to continue your learning.</p></div><form className="stack" onSubmit={submit}>
		<label>Username<input name="username" autoComplete="username" required maxLength={40} /></label>
		<label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={256} /></label>
		{error && <p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>Sign in</button>
	</form></main>;
}
