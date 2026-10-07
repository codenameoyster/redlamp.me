import { useState, type ReactNode } from 'react';
import type { SessionUser } from '../shared/leetcode';

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
	return <main className="login"><div className="logo"><span className="logo-mark">r.</span><strong>redlamp</strong></div><h1>LeetCode notebook</h1><p>Sign in to continue your learning.</p></main>;
}
