import { env } from 'cloudflare:workers';
import { afterEach, expect, it, vi } from 'vitest';
import { login, request } from './client';

afterEach(() => { vi.restoreAllMocks(); });

const UNAVAILABLE = { code: 'dictation_unavailable', message: 'Распознавание речи сейчас недоступно. Попробуйте позже.' };
it.each([
	{ name: 'parent account', role: 'parent', body: { audio: 'AAAA' }, status: 403, code: 'forbidden' },
	{ name: 'no audio', role: 'student', body: {}, status: 400, code: 'invalid_input' },
	{ name: 'empty audio', role: 'student', body: { audio: '' }, status: 400, code: 'invalid_input' },
	{ name: 'audio that is not a string', role: 'student', body: { audio: 1 }, status: 400, code: 'invalid_input' },
	{ name: 'extra field', role: 'student', body: { audio: 'AAAA', language: 'en' }, status: 400, code: 'invalid_input' },
	{ name: 'body over 1 MiB', role: 'student', body: { audio: 'A'.repeat(1_048_576) }, status: 413, code: 'too_large' },
] as const)('rejects $name', async ({ role, body, status, code }) => {
	const run = vi.spyOn(env.AI, 'run');
	const response = await request('/dictation', 'POST', body, await login(role));
	expect(response.status).toBe(status);
	expect((await response.json() as { error: { code: string } }).error.code).toBe(code);
	expect(run).not.toHaveBeenCalled();
});

// The longest recording is 120 s of 32 kbit/s Opus: 480,000 bytes, or 640,000 base64 characters.
it.each([
	{ name: 'speech', audio: 'GkXfow==', output: { text: ' Основная идея – два указателя. ' }, text: 'Основная идея – два указателя.' },
	{ name: 'silence', audio: 'GkXfow==', output: { text: '' }, text: '' },
	{ name: 'the longest recording', audio: 'A'.repeat(640_000), output: { text: 'Два указателя.' }, text: 'Два указателя.' },
])('returns the text of $name', async ({ audio, output, text }) => {
	const run = vi.spyOn(env.AI, 'run').mockResolvedValue(output as never);
	const response = await request('/dictation', 'POST', { audio }, await login());
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({ text });
	expect(run).toHaveBeenCalledWith('@cf/openai/whisper-large-v3-turbo', { audio, language: 'ru', vad_filter: true });
});

it('reports a failed transcription', async () => {
	vi.spyOn(env.AI, 'run').mockRejectedValue(new Error('3010: Invalid or incomplete input for the model'));
	vi.spyOn(console, 'error').mockImplementation(() => {});
	const response = await request('/dictation', 'POST', { audio: 'GkXfow==' }, await login());
	expect(response.status).toBe(503);
	expect((await response.json() as { error: unknown }).error).toEqual(UNAVAILABLE);
});
