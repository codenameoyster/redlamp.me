import type { Page } from '../../shared/leetcode';
import { isCalendarDate } from '../../shared/dates';

export class HttpError extends Error {
	constructor(public status: number, public code: string, message: string, public fields?: Record<string, string>) { super(message); }
}

export function integer(value: unknown, min = 1, max = Number.MAX_SAFE_INTEGER): number {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new HttpError(400, 'invalid_input', 'Проверьте числовые поля.');
	return value;
}
export function choice<T extends string>(value: unknown, options: readonly T[]): T {
	if (typeof value !== 'string' || !options.includes(value as T)) throw new HttpError(400, 'invalid_input', 'Выберите допустимое значение.');
	return value as T;
}
export function uuid(value: unknown): string {
	if (typeof value !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value)) throw new HttpError(400, 'invalid_input', 'Неверный идентификатор записи.');
	return value;
}
export function topics(value: unknown): string[] {
	if (!Array.isArray(value) || value.length > 12) throw new HttpError(400, 'invalid_input', 'Укажите не больше 12 тем.');
	return [...new Set(value.map(item => text(item, 40, true).trim()))];
}
export function calendarDate(value: unknown): string | null {
	if (value === null) return null;
	if (!isCalendarDate(value)) throw new HttpError(400, 'invalid_input', 'Укажите правильную дату.');
	return value;
}
export function pagination(url: URL): { limit: number; offset: number } {
	return { limit: integer(Number(url.searchParams.get('limit') ?? 50), 1, 50), offset: integer(Number(url.searchParams.get('offset') ?? 0), 0) };
}
export function page<T>(items: T[], limit: number, offset: number): Page<T> { return { items: items.slice(0, limit), nextOffset: items.length > limit ? offset + limit : null }; }
export function changed(result: D1Result): void {
	if (!result.meta.changes) throw new HttpError(409, 'conflict', 'Эта запись изменилась. Обновите страницу и повторите.');
}

export function object(value: unknown, keys: string[]): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) {
		throw new HttpError(400, 'invalid_input', 'Проверьте поля запроса.');
	}
	return value as Record<string, unknown>;
}

export function text(value: unknown, max: number, required = false): string {
	if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
		throw new HttpError(400, 'invalid_input', 'Проверьте текстовые поля.');
	}
	return value;
}

export function methods(request: Request, allowed: string[]): void {
	if (!allowed.includes(request.method)) throw new HttpError(405, 'method_not_allowed', allowed.join(', '));
}

export async function readBody(request: Request, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
	if (Number(request.headers.get('content-length')) > maxBytes) throw new HttpError(413, 'too_large', 'Файл или запрос слишком большой.');
	const reader = request.body?.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	if (reader) {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > maxBytes) { await reader.cancel(); throw new HttpError(413, 'too_large', 'Файл или запрос слишком большой.'); }
			chunks.push(value);
		}
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
	return bytes;
}

export async function readJson(request: Request, maxBytes = 32_768): Promise<unknown> {
	if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new HttpError(400, 'invalid_input', 'Отправьте запрос в формате JSON.');
	const bytes = await readBody(request, maxBytes);
	try { return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes)); }
	catch { throw new HttpError(400, 'invalid_input', 'Неверный JSON в запросе.'); }
}
