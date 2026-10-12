import { useEffect, useState } from 'react';
import type { ProblemTests } from '../shared/leetcode';
import { message } from './api';
import { checkCode, runTests, type Diagnostic, type RunResult } from './python';

export function Runner({ code, tests, live }: { code: string; tests: ProblemTests; live: boolean }) {
	const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]), [results, setResults] = useState<RunResult[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
	const cases = [...tests.standard, ...tests.own], total = cases.filter(item => item.expected !== null).length;
	useEffect(() => {
		if (!live || !code.trim()) { setDiagnostics([]); return; }
		const timer = setTimeout(() => void checkCode(code).then(setDiagnostics, () => setDiagnostics([])), 400);
		return () => clearTimeout(timer);
	}, [code, live]);
	async function run() {
		setBusy(true); setError(''); setResults([]);
		try { await runTests(code, tests.spec!, cases, result => setResults(items => [...items, result])); } catch (error) { setError(message(error)); } finally { setBusy(false); }
	}
	return <div className="stack">
		{diagnostics.length > 0 && <ul className="messages" aria-label="Замечания к коду">{diagnostics.map((item, index) => <li key={index}>{item.message}</li>)}</ul>}
		{tests.spec && cases.length > 0 ? <button type="button" disabled={busy || !code.trim()} onClick={() => void run()}>Запустить тесты</button> : <p>Тестов для этой задачи пока нет.</p>}
		{error && <p className="error" role="alert">{error}</p>}
		{results.length > 0 && <ol className="messages" aria-label="Результаты тестов">{results.map((result, index) => <li key={index} aria-label={`Тест ${index + 1}`}>
			<strong>Тест {index + 1}: {result.ok === null ? 'без проверки' : result.ok ? '✓' : '✗'}</strong>
			<span className="prose">Ввод: <code>{cases[index].input}</code></span>
			{cases[index].expected !== null && <span className="prose">Ожидается: <code>{cases[index].expected}</code></span>}
			{result.output && <span className="prose">Ваш ответ: <code>{result.output}</code></span>}
			{result.stdout && <span className="prose">Печать: <code>{result.stdout}</code></span>}
			{result.error && <span className="error">{result.error.line ? `Строка ${result.error.line}: ` : ''}{result.error.message}</span>}
		</li>)}</ol>}
		{!busy && results.length > 0 && total > 0 && <p role="status">Пройдено {results.filter(result => result.ok).length} из {total}</p>}
	</div>;
}
