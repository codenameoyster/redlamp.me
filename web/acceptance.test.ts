import { afterEach, expect, it, vi } from 'vitest';
import { newApproach, type Attempt, type JudgeOutput, type Judgement, type TestSpec } from '../shared/leetcode';
import { checkAcceptance } from './acceptance';
import * as transport from './api';
import * as python from './python';

const draft: Attempt = {
	id: '00000000-0000-4000-8000-000000000001', problemId: '00000000-0000-4000-8000-000000000002',
	state: 'draft', acceptance: 'not_submitted', understanding: 'needs_practice', version: 7,
	createdAt: '2026-11-02', updatedAt: '2026-11-02', savedAt: null,
	document: { notes: '', approaches: [{ ...newApproach(), code: 'print(input())' }, { ...newApproach(), code: 'print(99)' }] },
};
const accepted: Attempt = { ...draft, state: 'saved', acceptance: 'accepted', version: 8, savedAt: '2026-11-02' };
const spec: TestSpec = { mode: 'stdio' }, path = `/problems/${draft.problemId}`;
const result: python.RunResult = { ok: null, output: '1', stdout: 'debug', error: null, ms: 1 };
const wrong: Judgement = { verdict: 'wrong', failed: { index: 0, input: '1', expected: '2', output: '1' } };
const passed: Judgement = { verdict: 'accepted', failed: null };

afterEach(() => { vi.restoreAllMocks(); });

// The output limit includes the error line prefix.
const checks: { name: string; inputs: string[]; results: python.RunResult[]; outputs: JudgeOutput[]; progress: number[][]; judgement: Judgement }[] = [
	{ name: 'returns the accepted attempt after all inputs finish', inputs: ['1', '2'], results: [result, { ...result, output: '2' }], outputs: [{ value: '1' }, { value: '2' }], progress: [[0, 2], [1, 2], [2, 2]], judgement: passed },
	{ name: 'returns a failed verdict without reading the attempt', inputs: ['1', '2'], results: [result, { ...result, output: '2' }], outputs: [{ value: '1' }, { value: '2' }], progress: [[0, 2], [1, 2], [2, 2]], judgement: wrong },
	{ name: 'stops after a timeout and pads the remaining outputs', inputs: ['1', '2', '3'], results: [result, { ...result, timeout: true, error: { line: null, message: 'Time limit' } }, result], outputs: [{ value: '1' }, { timeout: true }, { timeout: true }], progress: [[0, 3], [1, 3], [2, 3]], judgement: { verdict: 'timeout', failed: { index: 1, input: '2', expected: '2', output: '' } } },
	{ name: 'stops after an error and includes its line', inputs: ['1', '2'], results: [{ ...result, error: { line: 4, message: 'ValueError: bad' } }, result], outputs: [{ error: 'Строка 4: ValueError: bad' }, { timeout: true }], progress: [[0, 2], [1, 2]], judgement: { verdict: 'error', failed: { index: 0, input: '1', expected: '1', output: 'Строка 4: ValueError: bad' } } },
	{ name: 'sends an error without a line prefix when no line is available', inputs: ['1'], results: [{ ...result, error: { line: null, message: 'ValueError: bad' } }], outputs: [{ error: 'ValueError: bad' }], progress: [[0, 1], [1, 1]], judgement: { verdict: 'error', failed: { index: 0, input: '1', expected: '1', output: 'ValueError: bad' } } },
	{ name: 'keeps an output at the one-million-character limit', inputs: ['1'], results: [{ ...result, output: 'v'.repeat(1_000_000) }], outputs: [{ value: 'v'.repeat(1_000_000) }], progress: [[0, 1], [1, 1]], judgement: wrong },
	{ name: 'cuts an output above the one-million-character limit', inputs: ['1'], results: [{ ...result, output: `${'v'.repeat(1_000_000)}extra` }], outputs: [{ value: 'v'.repeat(1_000_000) }], progress: [[0, 1], [1, 1]], judgement: wrong },
	{ name: 'counts the error line prefix within the output limit', inputs: ['1'], results: [{ ...result, error: { line: 4, message: 'e'.repeat(1_000_000) } }], outputs: [{ error: `Строка 4: ${'e'.repeat(999_990)}` }], progress: [[0, 1], [1, 1]], judgement: { verdict: 'error', failed: { index: 0, input: '1', expected: '1', output: 'Строка 4: e…' } } },
];
it.each(checks)('$name', async row => {
	const request = vi.spyOn(transport, 'api').mockResolvedValueOnce({ seed: 7, inputs: row.inputs }).mockResolvedValueOnce(row.judgement).mockResolvedValueOnce(accepted);
	const run = vi.spyOn(python, 'runTests').mockImplementation(async (_code, _spec, _tests, onResult) => {
		for (const output of row.results) if (onResult(output)) break;
	});
	const progress = vi.fn();
	expect(await checkAcceptance(draft, spec, progress)).toEqual(row.judgement.failed ? row.judgement : accepted);
	expect(run.mock.calls).toEqual([[draft.document.approaches[0].code, spec, row.inputs.map(input => ({ input, expected: null })), expect.any(Function), 3]]);
	expect(progress.mock.calls).toEqual(row.progress);
	expect(request).toHaveBeenNthCalledWith(1, `${path}/judge/start`, { method: 'POST' });
	expect(request).toHaveBeenNthCalledWith(2, `${path}/judge`, { method: 'POST', body: expect.any(String) });
	expect(JSON.parse(String(request.mock.calls[1][1]?.body))).toEqual({ seed: 7, attemptId: draft.id, version: 7, outputs: row.outputs });
	expect(request).toHaveBeenCalledTimes(row.judgement.failed ? 2 : 3);
	if (!row.judgement.failed) expect(request).toHaveBeenNthCalledWith(3, `${path}/attempts/${draft.id}`);
});

it.each([
	{ name: 'returns a start failure without running code', replies: [], runError: false, requests: 1, runs: 0, progress: [] },
	{ name: 'returns an execution failure without sending outputs', replies: [{ seed: 7, inputs: ['1'] }], runError: true, requests: 1, runs: 1, progress: [[0, 1]] },
	{ name: 'returns a verdict request failure without reading the attempt', replies: [{ seed: 7, inputs: ['1'] }], runError: false, requests: 2, runs: 1, progress: [[0, 1], [1, 1]] },
	{ name: 'returns an accepted-attempt read failure', replies: [{ seed: 7, inputs: ['1'] }, passed], runError: false, requests: 3, runs: 1, progress: [[0, 1], [1, 1]] },
])('$name', async row => {
	const error = new Error(row.name), request = vi.spyOn(transport, 'api').mockRejectedValue(error);
	for (const reply of row.replies) request.mockResolvedValueOnce(reply);
	const run = vi.spyOn(python, 'runTests').mockImplementation(async (_code, _spec, _tests, onResult) => {
		if (row.runError) throw error;
		onResult(result);
	});
	const progress = vi.fn();
	await expect(checkAcceptance(draft, spec, progress)).rejects.toBe(error);
	expect(request).toHaveBeenCalledTimes(row.requests);
	expect(run).toHaveBeenCalledTimes(row.runs);
	expect(progress.mock.calls).toEqual(row.progress);
});
