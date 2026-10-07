import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { SessionUser } from '../shared/leetcode';
import { api, ApiError, message } from './api';
import { Login } from './Login';
import { Problems } from './Problems';
import { Problem } from './Problem';
import type { LeaveGuard } from './useDraft';
import { Homework } from './Homework';

export function Layout({ user, children, logout }: { user: SessionUser; children: ReactNode; logout: () => void }) {
	const [dark, setDark] = useState(() => {
		try { return localStorage.getItem('leetcode:appearance') === 'dark'; } catch { return false; }
	});
	document.documentElement.dataset.appearance = dark ? 'dark' : 'light';
	function appearance() {
		setDark(!dark);
		try { localStorage.setItem('leetcode:appearance', dark ? 'light' : 'dark'); } catch { /* Appearance remains available in this page. */ }
	}
	const navigation = [{ path: '', label: 'Today', icon: '◷' }, { path: '/problems', label: 'Problems', icon: '▤' }, { path: '/homework', label: 'Homework', icon: '□' }, { path: '/lessons', label: 'Lessons', icon: '▱' }];
	return <div className="app">
		<a className="skip-link" href="#main">Skip to content</a>
		<aside className="sidebar">
			<a className="logo" href="/leetcode"><span className="logo-mark" aria-hidden="true">r.</span><span><strong>redlamp</strong><small>LeetCode notebook</small></span></a>
			<nav aria-label="Notebook">{navigation.map(item => <a key={item.path} href={`/leetcode${item.path}`} aria-current={location.pathname === `/leetcode${item.path}` ? 'page' : undefined}><span aria-hidden="true">{item.icon}</span>{item.label}</a>)}</nav>
			<div className="sidebar-bottom"><button onClick={appearance}>{dark ? 'Light appearance' : 'Dark appearance'}</button><div className="user"><strong>{user.username}</strong><small>{user.role === 'parent' ? 'Parent workspace' : 'Student workspace'}</small></div><button onClick={logout}>Log out</button></div>
		</aside>
		<div className="workspace"><header className="topbar"><span>Learning notebook</span><a href="/leetcode/problems">Search problems and notes</a></header><main id="main">{children}</main></div>
	</div>;
}

export function App() {
	const [user, setUser] = useState<SessionUser | null>(null);
	const [error, setError] = useState('');
	const guard = useRef<LeaveGuard | null>(null);
	const registerGuard = useCallback((value: LeaveGuard | null) => { guard.current = value; }, []);
	useEffect(() => {
		async function navigate(event: MouseEvent) {
			const anchor = (event.target as Element).closest('a');
			if (!anchor || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.target || anchor.hasAttribute('download') || anchor.hash || !guard.current) return;
			const url = new URL(anchor.href);
			if (url.origin !== location.origin) return;
			event.preventDefault();
			if (await guard.current.flush()) location.assign(url.href);
		}
		document.addEventListener('click', navigate);
		return () => document.removeEventListener('click', navigate);
	}, []);
	useEffect(() => {
		if (location.pathname === '/leetcode/login') return;
		function check() {
			setUser(null);
			api<SessionUser>('/session').then(setUser).catch(error => {
				if (error instanceof ApiError && error.status === 401) location.replace(`/leetcode/login?return=${encodeURIComponent(location.pathname)}`);
				else setError(message(error));
			});
		}
		function restored(event: PageTransitionEvent) { if (event.persisted) check(); }
		check();
		window.addEventListener('pageshow', restored);
		return () => window.removeEventListener('pageshow', restored);
	}, []);
	async function logout() {
		try {
			if (guard.current && !(await guard.current.flush())) { if (!confirm('Discard unsaved work and log out?')) return; guard.current.discard(); }
			await api('/session', { method: 'DELETE' });
			try { for (const key of Object.keys(sessionStorage)) if (key.startsWith(`leetcode:draft:${user!.username}:`)) sessionStorage.removeItem(key); } catch { /* No recovery storage is available. */ }
			setUser(null); location.replace('/leetcode/login');
		} catch (error) { setError(message(error)); }
	}
	if (location.pathname === '/leetcode/login') return <Login />;
	if (!user) return <main>{error ? <p role="alert">{error}</p> : <p role="status">Opening your notebook...</p>}</main>;
	const path = location.pathname;
	const match = /^\/leetcode\/problems\/([a-f0-9-]{36})$/.exec(path);
	const homework = /^\/leetcode\/homework(?:\/([a-f0-9-]{36}))?$/.exec(path);
	const screen = path === '/leetcode/problems' ? <Problems /> : match ? <Problem id={match[1]} user={user} registerGuard={registerGuard} /> : homework ? <Homework id={homework[1]} user={user} /> : <><h1>Today</h1><p>Your learning starts with a problem.</p><a className="button primary" href="/leetcode/problems">Open problems</a></>;
	return <Layout user={user} logout={logout}>{error && <p className="error" role="alert">{error}</p>}{screen}</Layout>;
}
