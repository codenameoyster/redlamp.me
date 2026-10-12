import type { TestCase, TestSpec } from '../shared/leetcode';

export interface Diagnostic { line: number; column: number; message: string }
export interface RunResult { ok: boolean | null; output: string; stdout: string; error: { message: string; line: number | null } | null; ms: number; timeout?: true }

const ruffTexts: Record<string, string> = { F821: 'неизвестное имя {}', F841: 'переменная {} не используется', F401: 'импорт {} не используется', F811: 'имя {} определено повторно' };
// A null code is a syntax error from compile().
export function diagnosticText(line: number, code: string | null, message: string): string {
	const name = /`[^`]+`/.exec(message)?.[0], text = code && ruffTexts[code];
	return `Строка ${line}: ${text && name ? `${text.replace('{}', name)}.` : code ? `замечание Ruff ${code}. ${message}` : `ошибка синтаксиса. ${message}`}`;
}

let worker: Worker | null = null, next = 0;
const calls = new Map<number, { resolve: (value: never) => void; reject: (error: Error) => void }>();
const failed = () => new Error('Не удалось запустить Python. Обновите страницу и попробуйте снова.');
function stop(error: Error) { worker?.terminate(); worker = null; for (const call of calls.values()) call.reject(error); calls.clear(); }
function post<T>(message: object): Promise<T> {
	if (!worker) {
		worker = new Worker('/leetcode/assets/python.worker.js', { type: 'module' });
		worker.onmessage = ({ data }) => { const call = calls.get(data.id); calls.delete(data.id); if (data.failed) call?.reject(failed()); else call?.resolve(data as never); };
		worker.onerror = () => stop(failed());
	}
	const id = ++next, target = worker;
	return new Promise<T>((resolve, reject) => { calls.set(id, { resolve, reject }); target.postMessage({ id, ...message }); });
}

export const checkCode = (code: string) => post<{ diagnostics: Diagnostic[] }>({ type: 'check', code }).then(value => value.diagnostics);

// The run stops when onResult returns true.
export async function runTests(code: string, spec: TestSpec, tests: TestCase[], onResult: (result: RunResult) => boolean | void, seconds = 2): Promise<void> {
	const limit = `Превышено время (${seconds} с)`;
	for (const test of tests) {
		// A new worker answers the check only after Python loads, so the time limit counts only the run.
		await checkCode('');
		let timer = 0;
		const result = await Promise.race([post<RunResult>({ type: 'run', code, spec, test }), new Promise<null>(resolve => { timer = setTimeout(resolve, seconds * 1000, null); })]);
		clearTimeout(timer);
		if (!result) stop(new Error(limit));
		if (onResult(result ?? { ok: test.expected === null ? null : false, output: '', stdout: '', error: { message: limit, line: null }, ms: seconds * 1000, timeout: true })) return;
	}
}
