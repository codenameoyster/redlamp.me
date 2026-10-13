import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, Mic, Square } from 'lucide-react';
import { api, message } from './api';

const LIMIT = 120;

// Puts the text at the cursor with a space on each side where a word touches it. setRangeText does not change the value that React remembers, so the input event makes React run onChange.
function insertText(field: HTMLTextAreaElement, text: string) {
	const { selectionStart: start, selectionEnd: end, value } = field;
	field.setRangeText(`${/\S$/.test(value.slice(0, start)) ? ' ' : ''}${text}${/^\S/.test(value.slice(end)) ? ' ' : ''}`, start, end, 'end');
	field.dispatchEvent(new Event('input', { bubbles: true }));
}

const base64 = (audio: Blob) => new Promise<string>((resolve, reject) => {
	const reader = new FileReader();
	reader.onload = () => resolve((reader.result as string).split(',')[1]);
	reader.onerror = () => reject(reader.error);
	reader.readAsDataURL(audio);
});

// Records speech and puts the Russian text into the textarea of the same label.
export function Dictation() {
	const [state, setState] = useState<'idle' | 'starting' | 'recording' | 'sending'>('idle'), [seconds, setSeconds] = useState(0), [error, setError] = useState('');
	const button = useRef<HTMLButtonElement>(null), recorder = useRef<MediaRecorder | null>(null);
	const stop = () => { if (recorder.current?.state === 'recording') recorder.current.stop(); };
	const textarea = () => button.current?.closest('label')?.querySelector('textarea');
	// React mounts a textarea with the cursor at 0. At the end, the first dictation adds to the saved text.
	useEffect(() => { const field = textarea(); field?.setSelectionRange(field.value.length, field.value.length); }, []);
	// The recorder stops when its tracks end. Without onstop, nothing is sent.
	useEffect(() => () => { const current = recorder.current; if (current) { current.onstop = null; current.stream.getTracks().forEach(track => track.stop()); } }, []);
	useEffect(() => { if (state !== 'recording') return; const timer = setInterval(() => setSeconds(value => value + 1), 1000); return () => clearInterval(timer); }, [state]);
	useEffect(() => { if (seconds >= LIMIT) stop(); }, [seconds]);

	async function start() {
		setError('');
		setState('starting');
		let stream: MediaStream;
		try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
		catch { setError('Разрешите доступ к микрофону.'); setState('idle'); return; }
		if (!button.current) { stream.getTracks().forEach(track => track.stop()); return; }
		const chunks: Blob[] = [], next = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 32_000 });
		next.ondataavailable = event => chunks.push(event.data);
		next.onstop = () => { stream.getTracks().forEach(track => track.stop()); recorder.current = null; void send(new Blob(chunks, { type: next.mimeType })); };
		recorder.current = next;
		next.start();
		setSeconds(0);
		setState('recording');
	}
	async function send(audio: Blob) {
		setState('sending');
		try {
			const { text } = await api<{ text: string }>('/dictation', { method: 'POST', body: JSON.stringify({ audio: await base64(audio) }) });
			const field = textarea();
			if (!text) setError('Речь не распознана. Попробуйте ещё раз.');
			else if (field) { insertText(field, text); field.focus(); }
		} catch (failure) { setError(message(failure)); }
		setState('idle');
	}

	const tip = { idle: 'Записать голос и вставить текст в поле.', starting: 'Включаем микрофон.', recording: 'Остановить запись и вставить текст.', sending: 'Распознаём речь.' }[state];
	return <>
		<button ref={button} type="button" className="icon-button dictation" aria-label="Голосовой ввод" aria-pressed={state === 'recording'} disabled={state === 'starting' || state === 'sending'} onClick={() => state === 'recording' ? stop() : void start()} data-tip={tip}>
			{state === 'sending' ? <LoaderCircle size={16} className="spin" /> : state === 'recording' ? <><Square size={14} />{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</> : <Mic size={16} />}
		</button>
		{error && <span className="error" role="alert">{error}</span>}
	</>;
}
