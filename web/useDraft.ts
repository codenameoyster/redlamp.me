import { useEffect, useRef, useState } from 'react';
import type { Attempt, DraftValue, SessionUser } from '../shared/leetcode';
import { api, ApiError, message } from './api';

export interface LeaveGuard { flush(): Promise<Attempt | null>; discard(): void }
export type RegisterGuard = (guard: LeaveGuard | null) => void;
type Recovery = { attemptId: string; baseVersion: number; value: DraftValue; editedAt: string };
function content(attempt: DraftValue): DraftValue { return { document: attempt.document, acceptance: attempt.acceptance, understanding: attempt.understanding }; }

export function useDraft(initial: Attempt, user: SessionUser) {
	const [value, setValue] = useState(() => content(initial));
	const [status, setStatus] = useState('saved');
	const [error, setError] = useState('');
	const [storageError, setStorageError] = useState('');
	const [recovery, setRecovery] = useState<Recovery | null>(null);
	const [conflict, setConflict] = useState<Attempt | null>(null);
	const latest = useRef(value), confirmed = useRef(initial), acknowledged = useRef(JSON.stringify(value));
	const pending = useRef<Promise<Attempt | null> | null>(null);
	const blocked = useRef('');
	const lost = useRef<string | null>(null);
	const alive = useRef(true), leaving = useRef(false), recovering = useRef(false);
	const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), maximum = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const enabled = user.role === 'student' && initial.state === 'draft';
	const key = `leetcode:draft:${user.username}:${initial.problemId}`;
	const path = `/problems/${initial.problemId}/attempts/${initial.id}`;
	function dirty() { return JSON.stringify(latest.current) !== acknowledged.current; }
	function clearTimers() { clearTimeout(idle.current); clearTimeout(maximum.current); idle.current = maximum.current = undefined; }
	function store() {
		try {
			sessionStorage.setItem(key, JSON.stringify({ attemptId: initial.id, baseVersion: confirmed.current.version, value: latest.current, editedAt: new Date().toISOString() }));
			return true;
		} catch { setStorageError('Reload recovery is unavailable. Keep this page open or copy your work.'); return false; }
	}
	function removeRecovery() { try { sessionStorage.removeItem(key); } catch { setStorageError('Reload recovery is unavailable.'); } }
	function schedule() {
		if (!enabled || pending.current || blocked.current || recovering.current || !dirty() || !alive.current) return;
		clearTimeout(idle.current);
		idle.current = setTimeout(() => void save(), 1500);
		maximum.current ??= setTimeout(() => void save(), 10_000);
	}
	function accept(saved: Attempt, sentText: string) {
		confirmed.current = saved; acknowledged.current = sentText; lost.current = null;
		if (!dirty()) removeRecovery(); else store();
		setStatus(dirty() ? 'unsaved' : 'saved'); setError('');
	}
	function save(): Promise<Attempt | null> {
		if (pending.current) return pending.current;
		if (!enabled || recovering.current || blocked.current) return Promise.resolve(null);
		if (!dirty()) return Promise.resolve(confirmed.current);
		clearTimers(); setStatus('saving');
		const sent = latest.current, sentText = JSON.stringify(sent);
		pending.current = (async () => {
			try {
				const saved = await api<Attempt>(path, { method: 'PUT', body: JSON.stringify({ ...sent, version: confirmed.current.version }) });
				if (!alive.current) return null;
				accept(saved, sentText); return saved;
			} catch (error) {
				if (!alive.current) return null;
				if (error instanceof ApiError && error.status === 409) {
					try {
						const server = await api<Attempt>(path);
						const serverText = JSON.stringify(content(server));
						if (server.state === 'draft' && (serverText === sentText || serverText === lost.current)) { accept(server, serverText); return server; }
						setConflict(server); blocked.current = 'conflict'; setStatus('conflict');
					} catch (readError) { blocked.current = 'failed'; setError(message(readError)); setStatus('unsaved'); }
				} else {
					blocked.current = error instanceof ApiError && error.status === 401 ? 'login' : 'failed';
					lost.current = sentText; setStatus(blocked.current === 'login' ? 'login_required' : 'unsaved');
				}
				setError(message(error)); return null;
			} finally { pending.current = null; schedule(); }
		})();
		return pending.current;
	}
	async function flush(): Promise<Attempt | null> {
		if (recovering.current || ['conflict', 'login'].includes(blocked.current)) return null;
		if (!enabled) return confirmed.current;
		blocked.current = '';
		if (pending.current && !(await pending.current)) return null;
		while (dirty()) { if (!(await save())) return null; }
		return confirmed.current;
	}
	function change(next: DraftValue) {
		latest.current = next; setValue(next); store();
		if (!pending.current) setStatus(blocked.current === 'login' ? 'login_required' : blocked.current === 'conflict' ? 'conflict' : 'unsaved');
		schedule();
	}
	function discard() { leaving.current = true; clearTimers(); removeRecovery(); }
	async function reload() {
		if (!confirm('Discard your unsaved copy and use the server copy?')) return;
		try {
			const server = await api<Attempt>(path);
			confirmed.current = server; latest.current = content(server); acknowledged.current = JSON.stringify(latest.current);
			setValue(latest.current); setConflict(null); blocked.current = ''; recovering.current = false; setRecovery(null); removeRecovery(); setError(''); setStatus('saved');
			return server;
		} catch (error) { setError(message(error)); }
	}
	function recover() {
		if (!recovery) return;
		recovering.current = false; setRecovery(null);
		if (recovery.baseVersion !== confirmed.current.version || initial.state !== 'draft') { setConflict(confirmed.current); blocked.current = 'conflict'; }
		change(recovery.value);
	}
	function signIn() {
		if (!store()) return;
		leaving.current = true;
		location.assign(`/leetcode/login?return=${encodeURIComponent(location.pathname)}`);
	}
	useEffect(() => {
		alive.current = true;
		if (user.role === 'student') {
			try {
				const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null') as Recovery | null;
				if (saved?.value?.document?.approaches && (saved.attemptId !== initial.id || JSON.stringify(saved.value) !== acknowledged.current)) { setRecovery(saved); recovering.current = true; }
			} catch { setStorageError('The recovery copy cannot be read. Keep this page open or copy your work.'); }
		}
		function beforeUnload(event: BeforeUnloadEvent) { if (!leaving.current && (dirty() || recovering.current)) { event.preventDefault(); event.returnValue = ''; } }
		window.addEventListener('beforeunload', beforeUnload);
		return () => { alive.current = false; clearTimers(); window.removeEventListener('beforeunload', beforeUnload); };
	}, []);
	return { value, change, status, error, storageError, recovery, conflict, flush, recover, reload, signIn, discard };
}
