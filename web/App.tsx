import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BookOpen, CalendarCheck, ClipboardCheck, CodeXml, LogOut, Moon, Search, Sun } from 'lucide-react';
import type { SessionUser } from '../shared/leetcode';
import { api, ApiError, message } from './api';
import { Login } from './Login';
import { Problems } from './Problems';
import { Problem } from './Problem';
import type { LeaveGuard } from './useDraft';
import { Homework } from './Homework';
import { Lessons } from './Lessons';
import { Today } from './Today';
import { Review } from './Review';

export function Layout({ user, children, logout }: { user: SessionUser; children: ReactNode; logout: () => void }) {
	const [dark, setDark] = useState(() => {
		try { return localStorage.getItem('leetcode:appearance') === 'dark'; } catch { return false; }
	});
	document.documentElement.dataset.appearance = dark ? 'dark' : 'light';
	function appearance() {
		setDark(!dark);
		try { localStorage.setItem('leetcode:appearance', dark ? 'light' : 'dark'); } catch { /* Appearance remains available in this page. */ }
	}
	const navigation = [{ path: '', label: 'Today', Icon: CalendarCheck }, { path: '/problems', label: 'Problems', Icon: CodeXml }, { path: '/homework', label: 'Homework', Icon: ClipboardCheck }, { path: '/lessons', label: 'Lessons', Icon: BookOpen }];
	return <div className="app">
		<a className="skip-link" href="#main">Skip to content</a>
		<aside className="sidebar">
			<a className="logo" href="/leetcode"><span className="logo-mark" aria-hidden="true">r.</span><span><strong>redlamp</strong><small>LeetCode notebook</small></span></a>
			<nav aria-label="Notebook">{navigation.map(({ path, label, Icon }) => <a key={path} href={`/leetcode${path}`} aria-current={location.pathname === `/leetcode${path}` ? 'page' : undefined}><Icon size={18} />{label}</a>)}</nav>
		</aside>
		<div className="workspace"><header className="topbar"><a className="search" href="/leetcode/problems"><Search size={16} /><span>Search problems and notes</span></a>
			<div className="account"><button className="icon-button" onClick={appearance} aria-label={dark ? 'Light appearance' : 'Dark appearance'} title={dark ? 'Light appearance' : 'Dark appearance'}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button><div className="user"><span className="avatar" aria-hidden="true">{user.username[0].toUpperCase()}</span><span><strong>{user.username}</strong><small>{user.role === 'parent' ? 'Parent' : 'Student'}</small></span></div><button className="icon-button" onClick={logout} aria-label="Log out" title="Log out"><LogOut size={18} /></button></div></header><main id="main">{children}</main></div>
	</div>;
}

export function App() {
	const [user, setUser] = useState(() => JSON.parse(document.getElementById('session')?.textContent ?? 'null') as SessionUser | null);
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
			if (!(await guard.current.flush())) { if (!confirm('Discard unsaved work and leave this page?')) return; guard.current.discard(); }
			location.assign(url.href);
		}
		document.addEventListener('click', navigate);
		return () => document.removeEventListener('click', navigate);
	}, []);
	useEffect(() => {
		if (location.pathname === '/leetcode/login') return;
		function check() {
			setUser(null);
			api<SessionUser>('/session').then(setUser).catch(error => {
				if (error instanceof ApiError && error.status === 401) location.replace(`/leetcode/login?return=${encodeURIComponent(location.pathname + location.search)}`);
				else setError(message(error));
			});
		}
		function restored(event: PageTransitionEvent) { if (event.persisted) check(); }
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
	const lessons = /^\/leetcode\/lessons(?:\/([a-f0-9-]{36}))?$/.exec(path);
	const review = /^\/leetcode\/problems\/([a-f0-9-]{36})\/review$/.exec(path);
	const screen = path === '/leetcode/problems' ? <Problems /> : match ? <Problem id={match[1]} user={user} registerGuard={registerGuard} /> : homework ? <Homework id={homework[1]} user={user} /> : lessons ? <Lessons id={lessons[1]} user={user} /> : review ? <Review id={review[1]} user={user} /> : <Today user={user} />;
	return <Layout user={user} logout={logout}>{error && <p className="error" role="alert">{error}</p>}{screen}</Layout>;
}
