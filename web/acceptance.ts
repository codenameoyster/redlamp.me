import type { Attempt, JudgeOutput, Judgement, TestSpec } from '../shared/leetcode';
import { api } from './api';
import { runTests } from './python';

export async function checkAcceptance(attempt: Attempt, spec: TestSpec, progress: (done: number, total: number) => void): Promise<Attempt | Exclude<Judgement, { failed: null }>> {
	const path = `/problems/${attempt.problemId}`;
	const { seed, inputs } = await api<{ seed: number; inputs: string[] }>(`${path}/judge/start`, { method: 'POST' }), outputs: JudgeOutput[] = [];
	progress(0, inputs.length);
	await runTests(attempt.document.approaches[0].code, spec, inputs.map(input => ({ input, expected: null })), result => {
		outputs.push(result.timeout ? { timeout: true } : result.error ? { error: `${result.error.line ? `Строка ${result.error.line}: ` : ''}${result.error.message}`.slice(0, 1_000_000) } : { value: result.output.slice(0, 1_000_000) });
		progress(outputs.length, inputs.length);
		return Boolean(result.timeout || result.error);
	}, 3);
	// The server requires one output for each input.
	while (outputs.length < inputs.length) outputs.push({ timeout: true });
	const judgement = await api<Judgement>(`${path}/judge`, { method: 'POST', body: JSON.stringify({ seed, attemptId: attempt.id, version: attempt.version, outputs }) });
	if (judgement.failed) return judgement;
	return api<Attempt>(`${path}/attempts/${attempt.id}`);
}
