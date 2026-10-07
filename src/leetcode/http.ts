export class HttpError extends Error {
	constructor(public status: number, public code: string, message: string, public fields?: Record<string, string>) { super(message); }
}

export function object(value: unknown, keys: string[]): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) {
		throw new HttpError(400, 'invalid_input', 'Check the request fields.');
	}
	return value as Record<string, unknown>;
}

export function text(value: unknown, max: number, required = false): string {
	if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
		throw new HttpError(400, 'invalid_input', 'Check the text fields.');
	}
	return value;
}

export function methods(request: Request, allowed: string[]): void {
	if (!allowed.includes(request.method)) throw new HttpError(405, 'method_not_allowed', allowed.join(', '));
}

export async function readBody(request: Request, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
	if (Number(request.headers.get('content-length')) > maxBytes) throw new HttpError(413, 'too_large', 'The file or request is too large.');
	const reader = request.body?.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	if (reader) {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > maxBytes) { await reader.cancel(); throw new HttpError(413, 'too_large', 'The file or request is too large.'); }
			chunks.push(value);
		}
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
	return bytes;
}

export async function readJson(request: Request, maxBytes = 32_768): Promise<unknown> {
	if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new HttpError(400, 'invalid_input', 'Send a JSON request.');
	const bytes = await readBody(request, maxBytes);
	try { return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes)); }
	catch { throw new HttpError(400, 'invalid_input', 'The JSON request is invalid.'); }
}
