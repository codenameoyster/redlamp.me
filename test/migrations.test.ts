import { env } from 'cloudflare:workers';
import { applyD1Migrations, reset } from 'cloudflare:test';
import { expect, it } from 'vitest';

const id = { problem: '11111111-1111-4111-8111-111111111111', attempt: '22222222-2222-4222-8222-222222222222', homework: '33333333-3333-4333-8333-333333333333', submission: '44444444-4444-4444-8444-444444444444', lesson: '55555555-5555-4555-8555-555555555555' };

it('moves each per-problem homework into a bundle with one task', async () => {
	await reset();
	await applyD1Migrations(env.DB, env.TEST_MIGRATIONS.slice(0, 3));
	await env.DB.batch([
		env.DB.prepare("INSERT INTO problems (id,slug,title,difficulty,topics,summary,search_text,created_at,updated_at) VALUES (?,'two-sum','Two Sum','easy','[]','','two sum','t0','t0')").bind(id.problem),
		env.DB.prepare(`INSERT INTO attempts (id,problem_id,state,document,search_text,acceptance,understanding,created_at,updated_at) VALUES (?,?,'saved','{"notes":"","approaches":[]}','','accepted','with_help','t1','t1')`).bind(id.attempt, id.problem),
		env.DB.prepare("INSERT INTO homework (id,problem_id,instructions,due_date,state,version,created_at,updated_at) VALUES (?,?,'Explain the invariant.','2026-10-10','assigned',1,'t2','t2')").bind(id.homework, id.problem),
		env.DB.prepare("INSERT INTO submissions VALUES (?,?,?,2,'t3')").bind(id.submission, id.homework, id.attempt),
		env.DB.prepare("UPDATE homework SET state='submitted',current_submission_id=?,version=2,updated_at='t3'").bind(id.submission),
		env.DB.prepare("INSERT INTO feedback VALUES ('66666666-6666-4666-8666-666666666666',?,?,?,'parent','reply','Why does it work?','t4')").bind(id.problem, id.homework, id.submission),
		env.DB.prepare("INSERT INTO lessons (id,title,description,topics,filename,byte_count,created_at,updated_at) VALUES (?,'Hash maps','','[]','a.html',1,'t0','t0')").bind(id.lesson),
		env.DB.prepare('INSERT INTO lesson_content VALUES (?,?)').bind(id.lesson, '<p>x</p>'),
		env.DB.prepare('INSERT INTO homework_lessons VALUES (?,?)').bind(id.homework, id.lesson),
	]);
	await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
	expect(await env.DB.prepare('SELECT * FROM homework').all().then(r => r.results)).toEqual([{ id: id.homework, title: 'Two Sum', instructions: 'Explain the invariant.', due_date: '2026-10-10', version: 1, created_at: 't2', updated_at: 't3' }]);
	expect(await env.DB.prepare('SELECT * FROM homework_tasks').all().then(r => r.results)).toEqual([{ id: id.homework, homework_id: id.homework, problem_id: id.problem, state: 'submitted', current_submission_id: id.submission, version: 2, created_at: 't2', updated_at: 't3' }]);
	expect(await env.DB.prepare('SELECT task_id,task_version FROM submissions').first()).toEqual({ task_id: id.homework, task_version: 2 });
	expect(await env.DB.prepare('SELECT task_id FROM feedback').first()).toEqual({ task_id: id.homework });
	expect(await env.DB.prepare('SELECT * FROM homework_lessons').first()).toEqual({ homework_id: id.homework, lesson_id: id.lesson });
	const references = await Promise.all(['feedback', 'homework_lessons', 'homework_tasks', 'submissions'].map(async child => [child, (await env.DB.prepare(`PRAGMA foreign_key_list(${child})`).all<{ from: string; table: string }>()).results.filter(f => f.table.startsWith('homework')).map(f => `${f.from} -> ${f.table}`)]));
	expect(Object.fromEntries(references)).toEqual({
		feedback: ['task_id -> homework_tasks'],
		homework_lessons: ['homework_id -> homework'],
		homework_tasks: ['homework_id -> homework'],
		submissions: ['task_id -> homework_tasks'],
	});
	expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
});
