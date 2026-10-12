import { useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react';
import { Bot, X } from 'lucide-react';
import type { Page, SessionUser, TutorEvent, TutorKind, TutorMessage } from '../shared/leetcode';
import { api, apiError, message } from './api';
import { Answer } from './Answer';
import { highlightIn, watchSelection } from './lessonTools';
import { useResource } from './useResource';

const wide = () => matchMedia('(min-width: 1400px)').matches;
function remember(open: boolean) {
	try { if (open) localStorage.setItem('leetcode:tutor', 'open'); else localStorage.removeItem('leetcode:tutor'); } catch { /* The panel stays available on this page. */ }
}
function stored() { try { return localStorage.getItem('leetcode:tutor') === 'open'; } catch { return false; } }
const said = (body: string, quote: string | null) => <>{quote && <blockquote>{quote}</blockquote>}<p className="prose">{body}</p></>;

export function Tutor({ context, title, user, flush, quote, lesson, evaluate }: { context: { kind: TutorKind; id: string }; title: string; user: SessionUser; flush?: () => Promise<unknown> | undefined; quote?: string; lesson?: RefObject<HTMLElement | null>; evaluate?: boolean }) {
	const student = user.role === 'student', bridge = student && lesson !== undefined, path = `/tutor/messages?kind=${context.kind}&id=${encodeURIComponent(context.id)}`;
	const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null), heading = useRef<HTMLHeadingElement>(null), input = useRef<HTMLTextAreaElement>(null), log = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false), [text, setText] = useState(''), [error, setError] = useState(''), [status, setStatus] = useState(''), [marked, setMarked] = useState('');
	const [pending, setPending] = useState<{ body: string; quote: string | null; answer: string } | null>(null);
	const busy = useRef(false); // Events from one burst run before React renders, so they see an old `pending`.
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
	const explain = useEffectEvent((text: string) => {
		if (busy.current) return;
		if (!dialog.current!.open) show();
		void ask('Объясните эту часть.', text);
	});
	useEffect(() => bridge ? watchSelection(lesson!, text => explain(text)) : undefined, [bridge, lesson]);
	function highlight(quote: string) {
		if (dialog.current!.matches(':modal')) dialog.current!.close(); // A modal panel covers the lesson.
		setMarked(highlightIn(lesson!.current!, quote) ? 'Отрывок выделен в уроке.' : 'Этого отрывка нет в тексте урока.');
	}
	useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [messages.data, pending]);
	async function loadOlder() {
		try { const page = await api<Page<TutorMessage>>(`${path}&offset=${nextOffset}`); setOlder([...older, ...page.items]); setNext(page.nextOffset); } catch (error) { setError(message(error)); }
	}
	async function ask(body: string, quote: string | null, evaluate?: true) {
		if (busy.current) return;
		busy.current = true;
		setPending({ body, quote, answer: '' }); setError(''); setStatus('Репетитор пишет.');
		try {
			await flush?.(); // A failed flush still sends. The context then has the last saved draft, and the page shows the draft error.
			const response = await fetch('/leetcode/api/tutor/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: context.kind, id: context.id, message: body, quote, evaluate }), cache: 'no-store' });
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
			if (!end) throw new Error('Ответ прервался. Отправьте сообщение ещё раз.');
			if ('error' in end) throw new Error(end.error.message);
			// The panel can open in the same event as this call, so `messages` can still have a null path.
			messages.setData(await api<Page<TutorMessage>>(path), path); setOlder([]); setNext(undefined);
			setText(value => value === body ? '' : value); setStatus('Репетитор ответил.');
		} catch (error) { setError(message(error)); setStatus(''); } finally { busy.current = false; setPending(null); }
	}
	return <>
		<button ref={trigger} aria-expanded={open} aria-controls="tutor" onClick={() => open ? dialog.current!.close() : show()} data-tip="Открыть или закрыть чат с ИИ-репетитором."><Bot size={18} />{student ? 'Спросить ИИ' : 'Читать чат с ИИ'}</button>
		{evaluate && <button onClick={() => { if (!dialog.current!.open) show(); void ask('Оцените моё решение.', null, true); }} data-tip="Попросить ИИ-репетитора оценить ваше решение.">Оценить решение с ИИ</button>}
		<dialog id="tutor" ref={dialog} aria-labelledby="tutor-title" onClose={() => { setOpen(false); remember(false); trigger.current?.focus(); }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); dialog.current!.close(); } }}>
			<header className="tutor-head"><div><h2 id="tutor-title" ref={heading} tabIndex={-1}>ИИ-репетитор</h2><p>{title}</p>{!student && <p>Чат ученика. Только чтение.</p>}</div><button className="icon-button" onClick={() => dialog.current!.close()} aria-label="Закрыть" data-tip="Закрыть чат."><X size={18} /></button></header>
			<div className="tutor-log" ref={log}>
				{nextOffset != null && <button onClick={() => void loadOlder()} data-tip="Загрузить более ранние сообщения.">Более ранние сообщения</button>}
				<ol className="messages" aria-label="Сообщения">
					{items.map(m => <li key={m.id} className={m.author === 'student' ? 'feedback student' : undefined}><small>{m.author === 'assistant' ? 'Репетитор' : student ? 'Вы' : 'Ученик'} - {new Date(m.createdAt).toLocaleString('ru-RU')}</small>{m.author === 'student' ? said(m.body, m.quote) : <Answer text={m.body} streaming={false} highlight={bridge ? highlight : undefined} />}</li>)}
					{pending && <><li className="feedback student"><small>Вы</small>{said(pending.body, pending.quote)}</li><li aria-busy="true"><small>Репетитор</small><Answer text={pending.answer} streaming /></li></>}
				</ol>
				{messages.data && !items.length && !pending && <p className="empty">{student ? 'Спросите об этой странице. Репетитор даёт подсказки, а не полные решения.' : 'Сообщений пока нет.'}</p>}
				{(error || messages.error) && <p className="error" role="alert">{error || messages.error}</p>}
			</div>
			{student && <form className="tutor-compose" onSubmit={event => { event.preventDefault(); input.current!.focus(); void ask(text, quote ?? null); }}>
				<label>Сообщение<textarea ref={input} value={text} onChange={event => setText(event.target.value)} maxLength={4000} required onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); event.currentTarget.form!.requestSubmit(); } }} /></label>
				<div className="row spread"><small>Работает через подписку ChatGPT. Родитель может читать этот чат.</small><button className="primary" disabled={Boolean(pending)} data-tip="Отправить сообщение ИИ-репетитору.">Отправить</button></div>
			</form>}
			<p role="status" className="visually-hidden">{status}</p>
		</dialog>
		{bridge && <p role="status" aria-label="Выделение в уроке" className="visually-hidden">{marked}</p>}
	</>;
}
