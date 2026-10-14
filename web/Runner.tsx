import { useEffect, useState, type ReactNode } from 'react';
import { sha256, type Expected, type Judgement, type ProblemTests, type TestCase, type TestRun } from '../shared/leetcode';
import { api, message } from './api';
import { checkCode, runTests, type Diagnostic, type RunResult } from './python';

const notes = { constraints: 'Ввод нарушает ограничения задачи.', input: 'Решение-образец не смогло прочитать ввод.', size: 'Верный ответ слишком большой для проверки.', none: 'Для этой задачи нет решения-образца.' };
type Case = TestCase & { note?: string };
// An own test gets the answer of the reference solution as its expected value, or a note why it has none.
const ownCase = (input: string, answer: Expected): Case => ({ input, expected: answer && 'value' in answer ? answer.value : null, note: answer ? 'error' in answer ? notes[answer.error] : undefined : notes.none });

// The run button is in one row with the buttons before and after it. The row stays mounted while the tests load, so a focused button keeps the focus.
export function Runner({ problemId, code, tests, live, latest, record, before, after }: { problemId: string; code: string; tests?: ProblemTests; live: boolean; latest?: TestRun; record?: (run: Pick<TestRun, 'passed' | 'total' | 'codeHash'>) => Promise<void>; before: ReactNode; after: ReactNode }) {
	const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]), [results, setResults] = useState<RunResult[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState(''), [hash, setHash] = useState('');
	// The results show the cases of their run. A later change of the own tests does not move them.
	const [ran, setRan] = useState<Case[]>([]), total = ran.filter(item => item.expected !== null).length;
	useEffect(() => {
		if (!live || !code.trim()) { setDiagnostics([]); return; }
		const timer = setTimeout(() => void checkCode(code).then(setDiagnostics, () => setDiagnostics([])), 400);
		return () => clearTimeout(timer);
	}, [code, live]);
	useEffect(() => { let current = true; void sha256(code).then(value => { if (current) setHash(value); }); return () => { current = false; }; }, [code]);
	async function run() {
		setBusy(true); setError(''); setResults([]); setRan([]);
		let passed = 0;
		try {
			const { own, standard, spec } = tests!, answers = own.length ? (await api<{ expected: Expected[] }>(`/problems/${problemId}/tests/expected`, { method: 'POST', body: JSON.stringify({ inputs: own.map(test => test.input) }) })).expected : [];
			const cases = [...standard, ...own.map((test, index) => ownCase(test.input, answers[index]))];
			setRan(cases);
			await runTests(code, spec!, cases, result => { passed += Number(result.ok === true); setResults(items => [...items, result]); });
			await record?.({ passed, total: cases.filter(item => item.expected !== null).length, codeHash: await sha256(code) });
		} catch (error) { setError(message(error)); } finally { setBusy(false); }
	}
	return <div className="stack">
		{diagnostics.length > 0 && <ul className="messages" aria-label="Замечания к коду">{diagnostics.map((item, index) => <li key={index}>{item.message}</li>)}</ul>}
		{/* The code runs with the session of the page, so only the student runs his code. */}
		<div className="row">{before}{record && tests && (tests.spec && tests.standard.length + tests.own.length > 0 ? <button type="button" disabled={busy || !code.trim()} onClick={() => void run()} data-tip="Запустить ваш код на тестах в браузере.">Запустить тесты</button> : <p>Тестов для этой задачи пока нет.</p>)}{after}</div>
		{latest && latest.total > 0 && latest.codeHash === hash && (latest.passed === latest.total ? <p><span className="tag good">Тесты пройдены</span></p> : !record && <p>Последний запуск: пройдено {latest.passed} из {latest.total}</p>)}
		{error && <p className="error" role="alert">{error}</p>}
		{results.length > 0 && <ol className="messages" aria-label="Результаты тестов">{results.map((result, index) => <li key={index} aria-label={`Тест ${index + 1}`} className={result.ok === null ? undefined : result.ok ? 'pass' : 'fail'}>
			<strong>Тест {index + 1}: {result.ok === null ? 'без проверки' : result.ok ? '✓' : '✗'}</strong>
			<span className="prose">Ввод: <code>{ran[index].input}</code></span>
			{ran[index].expected !== null ? <span className="prose">Верный ответ: <code>{ran[index].expected}</code></span> : ran[index].note && <span>{ran[index].note}</span>}
			{result.output && <span className="prose">Ваш ответ: <code>{result.output}</code></span>}
			{result.stdout && <span className="prose">Печать: <code>{result.stdout}</code></span>}
			{result.error && <span className="error">{result.error.line ? `Строка ${result.error.line}: ` : ''}{result.error.message}</span>}
		</li>)}</ol>}
		{!busy && results.length > 0 && total > 0 && <p role="status">Пройдено {results.filter(result => result.ok).length} из {total}</p>}
	</div>;
}

export function OwnTests({ problemId, tests, changed }: { problemId: string; tests: ProblemTests; changed: () => void }) {
	const [input, setInput] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
	async function send(path: string, init: RequestInit): Promise<boolean> {
		setBusy(true); setError('');
		try { await api(`/problems/${problemId}/tests${path}`, init); changed(); return true; } catch (error) { setError(message(error)); return false; } finally { setBusy(false); }
	}
	// The first standard test is an input example in the format of this task. The field is high enough for all lines of the example.
	const example = tests.standard[0]?.input.trimEnd(), placeholder = `${tests.spec?.mode === 'call' ? 'Аргументы списком' : 'Входные данные, как в условии'}${example ? `, например:\n${example}` : ''}`;
	return <section className="card card-pad stack"><h2>Мои тесты</h2>{error && <p className="error" role="alert">{error}</p>}
		{tests.own.length > 0 ? <ol className="messages" aria-label="Мои тесты">{tests.own.map((test, index) => <li key={test.id}>
			<strong>Тест {tests.standard.length + index + 1}</strong>
			<span className="prose">Ввод: <code>{test.input}</code></span>
			<button type="button" disabled={busy} aria-label={`Удалить тест ${tests.standard.length + index + 1}`} onClick={() => void send(`/${test.id}`, { method: 'DELETE' })} data-tip="Удалить этот тест.">Удалить</button>
		</li>)}</ol> : <p>Своих тестов пока нет.</p>}
		<form className="stack" onSubmit={async event => { event.preventDefault(); if (await send('', { method: 'POST', body: JSON.stringify({ input }) })) setInput(''); }}>
			<label>Ввод<textarea value={input} required maxLength={10_000} rows={placeholder.split('\n').length} placeholder={placeholder} onChange={event => setInput(event.target.value)} /></label>
			<button disabled={busy} data-tip="Добавить ваш тест к этой задаче.">Добавить тест</button>
		</form>
	</section>;
}

const failures = { wrong: 'Неверный ответ на тесте', timeout: 'Превышено время на тесте', error: 'Ошибка выполнения на тесте' };
// The first hidden test that the code failed.
export function Failure({ verdict, failed }: Exclude<Judgement, { failed: null }>) {
	return <div className="error stack" role="alert" aria-label="Результат проверки">
		<strong>{failures[verdict]} {failed.index + 1}{verdict === 'error' && `: ${failed.output}`}</strong>
		{verdict === 'wrong' && <><span className="prose">Ввод: <code>{failed.input}</code></span><span className="prose">Верный ответ: <code>{failed.expected}</code></span><span className="prose">Ваш ответ: <code>{failed.output}</code></span></>}
	</div>;
}
