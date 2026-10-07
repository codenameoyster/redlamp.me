import type { Env } from '../index';
import type { Role, SessionUser } from '../../shared/leetcode';
import { HttpError, methods, object, readJson, text } from './http';

type Accounts = Record<Role, { username: string; passwordHash: string }>;
let cachedSecret: string;
let cachedAccounts: Accounts;

function accounts(env: Env): Accounts {
	if (cachedAccounts && cachedSecret === env.LEETCODE_ACCOUNTS) return cachedAccounts;
	try {
		const value = object(JSON.parse(env.LEETCODE_ACCOUNTS), ['parent', 'student']);
		for (const role of ['parent', 'student'] as const) {
			const account = object(value[role], ['username', 'passwordHash']);
			if (!/^[A-Za-z0-9._-]{3,40}$/.test(text(account.username, 40)) || !/^[a-f0-9]{64}$/.test(text(account.passwordHash, 64))) throw new Error();
		}
		const parsed = value as Accounts;
		if (parsed.parent.username === parsed.student.username) throw new Error();
		cachedSecret = env.LEETCODE_ACCOUNTS;
		cachedAccounts = parsed;
		return parsed;
	} catch { throw new HttpError(503, 'setup_required', 'The notebook accounts need configuration.'); }
}

function hex(bytes: Uint8Array): string { return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(''); }
async function hash(value: string): Promise<string> { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))); }
function fingerprint(role: Role, account: Accounts[Role]): Promise<string> { return hash(JSON.stringify([role, account.username, account.passwordHash])); }
function local(request: Request, env: Env): boolean {
	const url = new URL(request.url);
	return env.LEETCODE_LOCAL_HTTP === '1' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
}
function cookieName(request: Request, env: Env): string { return local(request, env) ? 'redlamp-leetcode-dev' : '__Host-redlamp-leetcode'; }
function token(request: Request, env: Env): string | null {
	const prefix = `${cookieName(request, env)}=`;
	const value = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(prefix))?.slice(prefix.length);
	return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
function cookie(request: Request, env: Env, value: string, seconds: number): string {
	return `${cookieName(request, env)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${local(request, env) ? '' : '; Secure'}`;
}

export async function readSession(request: Request, env: Env): Promise<SessionUser | null> {
	const configured = accounts(env);
	const value = token(request, env);
	if (!value) return null;
	const row = await env.DB.prepare('SELECT role, credential_fingerprint FROM sessions WHERE token_hash=? AND expires_at>?')
		.bind(await hash(value), Date.now()).first<{ role: Role; credential_fingerprint: string }>();
	if (!row || row.credential_fingerprint !== await fingerprint(row.role, configured[row.role])) return null;
	return { role: row.role, username: configured[row.role].username };
}

export function requireRole(user: SessionUser, role: Role): void {
	if (user.role !== role) throw new HttpError(403, 'forbidden', 'This action is not available for this account.');
}

export async function handleSession(request: Request, env: Env): Promise<Response> {
	methods(request, ['GET', 'POST', 'DELETE']);
	if (request.method === 'POST') {
		if (!(await env.LOGIN_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'local' })).success) throw new HttpError(429, 'rate_limited', 'Too many attempts. Try again in one minute.');
		const data = object(await readJson(request, 4096), ['username', 'password']);
		const username = text(data.username, 40, true);
		const password = text(data.password, 256);
		const configured = accounts(env);
		const role = (['parent', 'student'] as const).find(role => configured[role].username === username);
		const digest = await hash(password);
		const expected = role ? configured[role].passwordHash : '0'.repeat(64);
		const matches = crypto.subtle.timingSafeEqual(new TextEncoder().encode(digest), new TextEncoder().encode(expected));
		if (!role || !matches) throw new HttpError(401, 'invalid_credentials', 'The username or password is incorrect.');
		const value = hex(crypto.getRandomValues(new Uint8Array(32)));
		const now = Date.now();
		await env.DB.batch([
			env.DB.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(now),
			env.DB.prepare('INSERT INTO sessions VALUES (?,?,?,?,?)').bind(await hash(value), role, await fingerprint(role, configured[role]), now, now + 604_800_000),
		]);
		return Response.json({ role, username }, { headers: { 'Set-Cookie': cookie(request, env, value, 604_800) } });
	}
	const user = await readSession(request, env);
	if (request.method === 'DELETE') {
		const value = token(request, env);
		if (value) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hash(value)).run();
		return new Response(null, { status: 204, headers: { 'Set-Cookie': cookie(request, env, '', 0) } });
	}
	if (!user) throw new HttpError(401, 'unauthorized', 'Sign in to continue.');
	return Response.json(user);
}
