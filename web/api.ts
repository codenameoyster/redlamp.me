export class ApiError extends Error {
	constructor(public status: number, public code: string, message: string, public fields?: Record<string, string>) { super(message); }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
	const headers = new Headers(init.headers);
	if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
	const response = await fetch(`/leetcode/api${path}`, { ...init, headers, cache: 'no-store' });
	if (response.status === 204) return undefined as T;
	if (!response.ok) throw await apiError(response);
	return response.json().catch(() => null);
}

export async function apiError(response: Response): Promise<ApiError> {
	const value = await response.json().catch(() => null);
	return new ApiError(response.status, value?.error?.code ?? 'request_failed', value?.error?.message ?? 'Request failed. Try again.', value?.error?.fields);
}

export function message(error: unknown): string { return error instanceof Error ? error.message : 'Request failed. Try again.'; }
