import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BookOpen, Bot, Brain, CalendarCheck, ClipboardCheck, CodeXml, Layers, LogOut, Moon, Search, Sun } from 'lucide-react';
import type { Game, SessionUser } from '../shared/leetcode';
import { api, ApiError, message } from './api';
import { Login } from './Login';
import { Problems } from './Problems';
import { Problem } from './Problem';
import type { LeaveGuard } from './useDraft';
import { Homework, Task } from './Homework';
import { Lessons } from './Lessons';
import { Sets } from './Sets';
import { Quiz } from './Quiz';
import { Today } from './Today';
import { Review } from './Review';
import { TutorPage } from './TutorPage';
import { useResource } from './useResource';

export function Layout({ user, children, logout }: { user: SessionUser; children: ReactNode; logout: () => void }) {
	const [dark, setDark] = useState(() => {
		try { return localStorage.getItem('leetcode:appearance') !== 'light'; } catch { return true; }
	});
	const { data: game } = useResource<Game>('/game');
	document.documentElement.dataset.appearance = dark ? 'dark' : 'light';
	function appearance() {
		setDark(!dark);
		try { localStorage.setItem('leetcode:appearance', dark ? 'light' : 'dark'); } catch { /* Appearance remains available in this page. */ }
	}
	const navigation = [{ path: '', label: 'Сегодня', Icon: CalendarCheck }, { path: '/problems', label: 'Задачи', Icon: CodeXml }, { path: '/homework', label: 'Домашняя работа', Icon: ClipboardCheck }, { path: '/lessons', label: 'Уроки', Icon: BookOpen }, { path: '/sets', label: 'Наборы', Icon: Layers }, { path: '/quiz', label: 'Квиз', Icon: Brain }, ...(user.role === 'parent' ? [{ path: '/tutor', label: 'ИИ-репетитор', Icon: Bot }] : [])];
	return <div className="app">
		<a className="skip-link" href="#main">К содержимому</a>
		<aside className="sidebar">
			<a className="logo" href="/leetcode"><span className="logo-mark" aria-hidden="true">r.</span><span><strong>redlamp</strong><small>Тетрадь LeetCode</small></span></a>
			<nav aria-label="Тетрадь">{navigation.map(({ path, label, Icon }) => <a key={path} href={`/leetcode${path}`} aria-current={location.pathname === `/leetcode${path}` ? 'page' : undefined}><Icon size={18} />{label}</a>)}</nav>
		</aside>
		<div className="workspace"><header className="topbar"><a className="search" href="/leetcode/problems"><Search size={16} /><span>Поиск по задачам и заметкам</span></a>
			<div className="account">{game && <div className="xp-chip"><strong>Уровень {game.level}</strong><progress className="xp" aria-label={`Прогресс до уровня ${game.level + 1}`} value={game.xp - game.levelXp} max={game.nextLevelXp - game.levelXp} /></div>}<button className="icon-button" onClick={appearance} aria-label={dark ? 'Светлая тема' : 'Тёмная тема'} title={dark ? 'Светлая тема' : 'Тёмная тема'}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button><div className="user"><span className="avatar" aria-hidden="true">{user.username[0].toUpperCase()}</span><span><strong>{user.username}</strong><small>{user.role === 'parent' ? 'Родитель' : 'Ученик'}</small></span></div><button className="icon-button" onClick={logout} aria-label="Выйти" title="Выйти"><LogOut size={18} /></button></div></header><main id="main">{children}</main></div>
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
			if (!(await guard.current.flush())) { if (!confirm('Удалить несохранённую работу и уйти с этой страницы?')) return; guard.current.discard(); }
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
			if (guard.current && !(await guard.current.flush())) { if (!confirm('Удалить несохранённую работу и выйти?')) return; guard.current.discard(); }
			await api('/session', { method: 'DELETE' });
			try { for (const key of Object.keys(sessionStorage)) if (key.startsWith(`leetcode:draft:${user!.username}:`)) sessionStorage.removeItem(key); } catch { /* No recovery storage is available. */ }
			setUser(null); location.replace('/leetcode/login');
		} catch (error) { setError(message(error)); }
	}
	if (location.pathname === '/leetcode/login') return <Login />;
	if (!user) return <main>{error ? <p role="alert">{error}</p> : <p role="status">Открываем тетрадь...</p>}</main>;
	const path = location.pathname;
	const match = /^\/leetcode\/problems\/([a-f0-9-]{36})$/.exec(path);
	const homework = /^\/leetcode\/homework(?:\/([a-f0-9-]{36}))?$/.exec(path);
	const task = /^\/leetcode\/tasks\/([a-f0-9-]{36})$/.exec(path);
	const lessons = /^\/leetcode\/lessons(?:\/([a-f0-9-]{36}))?$/.exec(path);
	const sets = /^\/leetcode\/sets(?:\/([a-z0-9-]+))?$/.exec(path);
	const quiz = /^\/leetcode\/quiz(?:\/([a-z0-9-]+))?$/.exec(path);
	const review = /^\/leetcode\/problems\/([a-f0-9-]{36})\/review$/.exec(path);
	const screen = path === '/leetcode/problems' ? <Problems /> : match ? <Problem id={match[1]} user={user} registerGuard={registerGuard} /> : homework ? <Homework id={homework[1]} user={user} /> : task ? <Task id={task[1]} user={user} /> : lessons ? <Lessons id={lessons[1]} user={user} /> : sets ? <Sets slug={sets[1]} user={user} /> : quiz ? <Quiz slug={quiz[1]} user={user} /> : review ? <Review id={review[1]} user={user} /> : path === '/leetcode/tutor' ? <TutorPage user={user} /> : <Today user={user} />;
	return <Layout user={user} logout={logout}>{error && <p className="error" role="alert">{error}</p>}{screen}</Layout>;
}
