import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Bot, X } from 'lucide-react';
import type { Page, SessionUser, TutorEvent, TutorKind, TutorMessage } from '../shared/leetcode';
import { api, apiError, message } from './api';
import { Answer } from './Answer';
import { useResource } from './useResource';

const wide = () => matchMedia('(min-width: 1400px)').matches;
function remember(open: boolean) {
	try { if (open) localStorage.setItem('leetcode:tutor', 'open'); else localStorage.removeItem('leetcode:tutor'); } catch { /* The panel stays available on this page. */ }
}
function stored() { try { return localStorage.getItem('leetcode:tutor') === 'open'; } catch { return false; } }
// ponytail: one lesson frame per page (LessonView or SetView). Match all frames if a page ever shows two.
const lessonFrame = () => document.querySelector<HTMLIFrameElement>('iframe.lesson-frame');
// The frame origin is opaque ("null"), so '*' is the only target that matches. The quote is lesson text, not a secret.
const highlightLesson = (quote: string) => lessonFrame()?.contentWindow?.postMessage({ type: 'highlight', quote }, '*');
const said = (body: string, quote: string | null) => <>{quote && <blockquote>{quote}</blockquote>}<p className="prose">{body}</p></>;

export function Tutor({ context, title, user, flush }: { context: { kind: TutorKind; id: string }; title: string; user: SessionUser; flush?: () => Promise<unknown> | undefined }) {
	const student = user.role === 'student', bridge = student && context.kind !== 'problem', path = `/tutor/messages?kind=${context.kind}&id=${encodeURIComponent(context.id)}`;
	const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null), heading = useRef<HTMLHeadingElement>(null), input = useRef<HTMLTextAreaElement>(null), log = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false), [text, setText] = useState(''), [error, setError] = useState(''), [status, setStatus] = useState(''), [marked, setMarked] = useState('');
	const [pending, setPending] = useState<{ body: string; quote: string | null; answer: string } | null>(null);
	const busy = useRef(false); // Message events from one burst run before React renders, so they see an old `pending`.
	const [older, setOlder] = useState<TutorMessage[]>([]), [next, setNext] = useState<number | null>();
	const messages = useResource<Page<TutorMessage>>(open ? path : null);
	const items = [...messages.data?.items ?? [], ...older].reverse(), nextOffset = next === undefined ? messages.data?.nextOffset : next;
	function show() {
		if (wide()) dialog.current!.show(); else dialog.current!.showModal();
		setOpen(true); remember(true);
		(input.current ?? heading.current)!.focus();
	}
	useEffect(() => {
		// The open attribute shows the restored panel and keeps the focus on the page. show() runs the dialog focusing steps: https://html.spec.whatwg.org/multipage/interactive-elements.html#dialog-focusing-steps
		if (location.hash === '#tutor') show(); else if (stored() && wide()) { dialog.current!.setAttribute('open', ''); setOpen(true); }
		// A docked panel is not modal, so it cannot stay over a narrow page.
		const query = matchMedia('(min-width: 1400px)'), narrow = () => { if (!query.matches) dialog.current!.close(); };
		query.addEventListener('change', narrow);
		return () => query.removeEventListener('change', narrow);
	}, []);
	// The bridge in the lesson frame posts these messages: src/leetcode/lesson-bridge.html
	const onLesson = useEffectEvent((event: MessageEvent) => {
		if (event.source !== lessonFrame()?.contentWindow) return;
		if (event.data?.type === 'highlighted') setMarked(event.data.found ? 'The passage is marked in the lesson.' : 'This passage is not in the lesson text.');
		if (event.data?.type !== 'explain' || typeof event.data.text !== 'string' || busy.current) return;
		const quote = event.data.text.replace(/\s+/g, ' ').trim().slice(0, 2000);
		if (!quote) return;
		if (!dialog.current!.open) show();
		void ask('Explain this part.', quote);
	});
	useEffect(() => {
		if (!bridge) return;
		const listen = (event: MessageEvent) => onLesson(event);
		addEventListener('message', listen);
		return () => removeEventListener('message', listen);
	}, [bridge]);
	function highlight(quote: string) {
		if (dialog.current!.matches(':modal')) dialog.current!.close(); // A modal panel covers the lesson.
		setMarked('');
		highlightLesson(quote);
	}
	useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [messages.data, pending]);
	async function loadOlder() {
		try { const page = await api<Page<TutorMessage>>(`${path}&offset=${nextOffset}`); setOlder([...older, ...page.items]); setNext(page.nextOffset); } catch (error) { setError(message(error)); }
	}
	async function ask(body: string, quote: string | null) {
		if (busy.current) return;
		busy.current = true;
		setPending({ body, quote, answer: '' }); setError(''); setStatus('The tutor is writing.');
		try {
			await flush?.(); // A failed flush still sends. The context then has the last saved draft, and the page shows the draft error.
			const response = await fetch('/leetcode/api/tutor/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: context.kind, id: context.id, message: body, quote }), cache: 'no-store' });
			if (!response.ok) throw await apiError(response);
			const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
			let buffer = '', answer = '', end: TutorEvent | undefined;
			while (!end) {
				const chunk = await reader.read().catch(() => null); // A network error is an interrupted answer.
				if (!chunk || chunk.done) break;
				const frames = (buffer + chunk.value).split(/\r?\n\r?\n/);
				buffer = frames.pop()!;
				for (const line of frames.flatMap(frame => frame.split(/\r?\n/))) {
					if (!line.startsWith('data:')) continue;
					const event = JSON.parse(line.slice(5)) as TutorEvent;
					if ('delta' in event) setPending({ body, quote, answer: answer += event.delta }); else end = event;
				}
			}
			if (!end) throw new Error('The answer stopped. Send your message again.');
			if ('error' in end) throw new Error(end.error.message);
			messages.setData(await api<Page<TutorMessage>>(path)); setOlder([]); setNext(undefined);
			setText(value => value === body ? '' : value); setStatus('The tutor answered.');
		} catch (error) { setError(message(error)); setStatus(''); } finally { busy.current = false; setPending(null); }
	}
	return <>
		<button ref={trigger} aria-expanded={open} aria-controls="tutor" onClick={() => open ? dialog.current!.close() : show()}><Bot size={18} />{student ? 'Ask AI' : 'Read AI chat'}</button>
		<dialog id="tutor" ref={dialog} aria-labelledby="tutor-title" onClose={() => { setOpen(false); remember(false); trigger.current?.focus(); }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); dialog.current!.close(); } }}>
			<header className="tutor-head"><div><h2 id="tutor-title" ref={heading} tabIndex={-1}>AI tutor</h2><p>{title}</p>{!student && <p>The chat of the student. Read only.</p>}</div><button className="icon-button" onClick={() => dialog.current!.close()} aria-label="Close" title="Close"><X size={18} /></button></header>
			<div className="tutor-log" ref={log}>
				{nextOffset != null && <button onClick={() => void loadOlder()}>Older messages</button>}
				<ol className="messages" aria-label="Messages">
					{items.map(m => <li key={m.id} className={m.author === 'student' ? 'feedback student' : undefined}><small>{m.author === 'assistant' ? 'Tutor' : student ? 'You' : 'Student'} - {new Date(m.createdAt).toLocaleString()}</small>{m.author === 'student' ? said(m.body, m.quote) : <Answer text={m.body} streaming={false} highlight={bridge ? highlight : undefined} />}</li>)}
					{pending && <><li className="feedback student"><small>You</small>{said(pending.body, pending.quote)}</li><li aria-busy="true"><small>Tutor</small><Answer text={pending.answer} streaming /></li></>}
				</ol>
				{messages.data && !items.length && !pending && <p className="empty">{student ? 'Ask about this page. The tutor gives hints, not full solutions.' : 'No messages yet.'}</p>}
				{(error || messages.error) && <p className="error" role="alert">{error || messages.error}</p>}
			</div>
			{student && <form className="tutor-compose" onSubmit={event => { event.preventDefault(); input.current!.focus(); void ask(text, null); }}>
				<label>Message<textarea ref={input} value={text} onChange={event => setText(event.target.value)} maxLength={4000} required onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); event.currentTarget.form!.requestSubmit(); } }} /></label>
				<div className="row spread"><small>Using ChatGPT plan. Your parent can read this chat.</small><button className="primary" disabled={Boolean(pending)}>Send</button></div>
			</form>}
			<p role="status" className="visually-hidden">{status}</p>
		</dialog>
		{bridge && <p role="status" aria-label="Lesson highlight" className="visually-hidden">{marked}</p>}
	</>;
}
