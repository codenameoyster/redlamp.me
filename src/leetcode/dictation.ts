import type { Env } from '../index';
import type { SessionUser } from '../../shared/leetcode';
import { requireRole } from './auth';
import { HttpError, methods, object, readJson, text } from './http';

// Model: https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/
const MODEL = '@cf/openai/whisper-large-v3-turbo';

export async function handleDictation(request: Request, env: Env, user: SessionUser): Promise<Response | null> {
	if (new URL(request.url).pathname !== '/leetcode/api/dictation') return null;
	methods(request, ['POST']);
	requireRole(user, 'student');
	// Two minutes of 32 kbit/s Opus is about 480 KB, or 640 KB in base64.
	const audio = text(object(await readJson(request, 1_048_576), ['audio']).audio, 1_048_576, true);
	try {
		// The VAD filter removes silence, so silence gives no text.
		const result = await env.AI.run(MODEL, { audio, language: 'ru', vad_filter: true });
		return Response.json({ text: result.text.trim() });
	} catch (error) {
		console.error('Dictation failed.', { message: error instanceof Error ? error.message : 'unknown' });
		throw new HttpError(503, 'dictation_unavailable', 'Распознавание речи сейчас недоступно. Попробуйте позже.');
	}
}
