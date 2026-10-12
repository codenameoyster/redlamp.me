import { useEffect, useState } from 'react';
import { sha256, type ProblemTests, type TestCase, type TestRun } from '../shared/leetcode';
import { api, message } from './api';
import { checkCode, runTests, type Diagnostic, type RunResult } from './python';

export function Runner({ code, tests, live, latest, record }: { code: string; tests: ProblemTests; live: boolean; latest?: TestRun; record?: (run: Pick<TestRun, 'passed' | 'total' | 'codeHash'>) => Promise<void> }) {
	const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]), [results, setResults] = useState<RunResult[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState(''), [hash, setHash] = useState('');
	// The results show the cases of their run. A later change of the own tests does not move them.
	const [ran, setRan] = useState<TestCase[]>([]), cases = [...tests.standard, ...tests.own], total = ran.filter(item => item.expected !== null).length;
	useEffect(() => {
		if (!live || !code.trim()) { setDiagnostics([]); return; }
		const timer = setTimeout(() => void checkCode(code).then(setDiagnostics, () => setDiagnostics([])), 400);
		return () => clearTimeout(timer);
	}, [code, live]);
	useEffect(() => { let current = true; void sha256(code).then(value => { if (current) setHash(value); }); return () => { current = false; }; }, [code]);
	async function run() {
		setBusy(true); setError(''); setResults([]); setRan(cases);
		let passed = 0;
		try {
			await runTests(code, tests.spec!, cases, result => { passed += Number(result.ok === true); setResults(items => [...items, result]); });
			await record?.({ passed, total: cases.filter(item => item.expected !== null).length, codeHash: await sha256(code) });
		} catch (error) { setError(message(error)); } finally { setBusy(false); }
	}
	return <div className="stack">
		{diagnostics.length > 0 && <ul className="messages" aria-label="Замечания к коду">{diagnostics.map((item, index) => <li key={index}>{item.message}</li>)}</ul>}
		{tests.spec && cases.length > 0 ? <button type="button" disabled={busy || !code.trim()} onClick={() => void run()}>Запустить тесты</button> : <p>Тестов для этой задачи пока нет.</p>}
		{latest && latest.total > 0 && latest.passed === latest.total && latest.codeHash === hash && <p><span className="tag good">Тесты пройдены</span></p>}
		{error && <p className="error" role="alert">{error}</p>}
		{results.length > 0 && <ol className="messages" aria-label="Результаты тестов">{results.map((result, index) => <li key={index} aria-label={`Тест ${index + 1}`}>
			<strong>Тест {index + 1}: {result.ok === null ? 'без проверки' : result.ok ? '✓' : '✗'}</strong>
			<span className="prose">Ввод: <code>{ran[index].input}</code></span>
			{ran[index].expected !== null && <span className="prose">Ожидается: <code>{ran[index].expected}</code></span>}
			{result.output && <span className="prose">Ваш ответ: <code>{result.output}</code></span>}
			{result.stdout && <span className="prose">Печать: <code>{result.stdout}</code></span>}
			{result.error && <span className="error">{result.error.line ? `Строка ${result.error.line}: ` : ''}{result.error.message}</span>}
		</li>)}</ol>}
		{!busy && results.length > 0 && total > 0 && <p role="status">Пройдено {results.filter(result => result.ok).length} из {total}</p>}
	</div>;
}

export function OwnTests({ problemId, tests, changed }: { problemId: string; tests: ProblemTests; changed: () => void }) {
	const [input, setInput] = useState(''), [expected, setExpected] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
	async function send(path: string, init: RequestInit): Promise<boolean> {
		setBusy(true); setError('');
		try { await api(`/problems/${problemId}/tests${path}`, init); changed(); return true; } catch (error) { setError(message(error)); return false; } finally { setBusy(false); }
	}
	const call = tests.spec?.mode === 'call';
	return <section className="card card-pad stack"><h2>Мои тесты</h2>{error && <p className="error" role="alert">{error}</p>}
		{tests.own.length > 0 ? <ol className="messages" aria-label="Мои тесты">{tests.own.map((test, index) => <li key={test.id}>
			<strong>Тест {tests.standard.length + index + 1}</strong>
			<span className="prose">Ввод: <code>{test.input}</code></span>
			<span className="prose">Ожидается: <code>{test.expected}</code></span>
			<button type="button" disabled={busy} aria-label={`Удалить тест ${tests.standard.length + index + 1}`} onClick={() => void send(`/${test.id}`, { method: 'DELETE' })}>Удалить</button>
		</li>)}</ol> : <p>Своих тестов пока нет.</p>}
		<form className="stack" onSubmit={async event => { event.preventDefault(); if (await send('', { method: 'POST', body: JSON.stringify({ input, expected }) })) { setInput(''); setExpected(''); } }}>
			<label>Ввод<textarea value={input} required maxLength={10_000} placeholder={call ? 'Аргументы списком, например [[2, 7, 11, 15], 9]' : 'Входные данные, как в условии'} onChange={event => setInput(event.target.value)} /></label>
			<label>Ожидается<textarea value={expected} required maxLength={10_000} placeholder={call ? 'Значение Python, например [0, 1]' : 'Вывод, как в условии'} onChange={event => setExpected(event.target.value)} /></label>
			<button disabled={busy}>Добавить тест</button>
		</form>
	</section>;
}
