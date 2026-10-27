import { env } from 'cloudflare:workers';
import { beforeEach, expect, it } from 'vitest';
import { login, request } from './client';
import type { Card, QuizAttempt, QuizDeck, QuizRound, Role } from '../shared/leetcode';
import { sets } from '../src/leetcode/sets';

const chapters = sets.find(item => item.slug === 'permutations-and-combinations')!.chapters;
const deck = chapters[0].cards;
const slug = 'permutations-and-combinations-1', HOUR = 3_600_000;
const insert = env.DB.prepare('INSERT INTO quiz_attempts VALUES (?,?,?,?,?,?)');
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const hourAfter = (time: string) => new Date(Date.parse(time) + HOUR).toISOString();
const wrong = (card: Card) => card.type === 'short' ? 'нет' : (card.answer + 1) % card.options.length;
// The first `right` cards of the chapter get the right answer, the other cards get a wrong answer.
const answers = (chapter: number, right: number) => Object.fromEntries(chapters[chapter - 1].cards.map((card, i) => [card.id, i < right ? card.answer : wrong(card)]));
const rows = () => env.DB.prepare('SELECT deck,correct,total,passed FROM quiz_attempts ORDER BY created_at').all().then(r => r.results);
let student: string;
beforeEach(async () => { student = await login(); });
const submit = (chapter: number, body: unknown, cookie = student) => request(`/quiz/permutations-and-combinations-${chapter}/attempts`, 'POST', body, cookie);

it.each([
	{ name: '8 of 8 passes', chapter: 1, right: 8, total: 8, passed: true },
	{ name: '7 of 8 passes', chapter: 1, right: 7, total: 8, passed: true },
	{ name: '6 of 8 fails', chapter: 1, right: 6, total: 8, passed: false },
	{ name: '6 of 7 passes', chapter: 3, right: 6, total: 7, passed: true },
	{ name: '5 of 7 fails', chapter: 3, right: 5, total: 7, passed: false },
	{ name: '5 of 6 passes', chapter: 4, right: 5, total: 6, passed: true },
	{ name: '4 of 6 fails', chapter: 4, right: 4, total: 6, passed: false },
])('pass rule: $name', async ({ chapter, right, total, passed }) => {
	const response = await submit(chapter, { answers: answers(chapter, right) });
	expect(response.status).toBe(201);
	expect(await response.json()).toMatchObject({ correct: right, total, passed });
	expect(await rows()).toEqual([{ deck: `permutations-and-combinations-${chapter}`, correct: right, total, passed: Number(passed) }]);
});

it('a passed attempt shows each answer and explanation', async () => {
	const response = await submit(1, { answers: { ...answers(1, 7), 'pc1-medals': '  126 ' } });
	expect(response.status).toBe(201);
	const body = await response.json() as QuizAttempt;
	const createdAt = await env.DB.prepare('SELECT created_at FROM quiz_attempts').first<string>('created_at');
	expect(body).toEqual({ correct: 7, total: 8, passed: true, nextAt: hourAfter(createdAt!), results: deck.map(card => ({ cardId: card.id, correct: card.id !== 'pc1-order-matters', answer: card.type === 'short' ? card.answer : card.options[card.answer], explain: card.explain })) });
});

it('a failed attempt shows the wrong cards without the answers', async () => {
	const body = await (await submit(1, { answers: answers(1, 5) })).json() as QuizAttempt;
	expect(body.results).toEqual(deck.map((card, i) => ({ cardId: card.id, correct: i < 5 })));
});

const all = answers(1, 8), without = (id: string) => Object.fromEntries(Object.entries(all).filter(([key]) => key !== id));
it.each([
	{ name: 'missing card', body: { answers: without('pc1-team') } },
	{ name: 'unknown card id', body: { answers: { ...all, 'pc-missing': 1 } } },
	{ name: 'card from another deck', body: { answers: { ...without('pc1-team'), 'pc2-no-pop': 1 } } },
	{ name: 'option index as text', body: { answers: { ...all, 'pc1-product-rule': '0' } } },
	{ name: 'option index out of range', body: { answers: { ...all, 'pc1-product-rule': 4 } } },
	{ name: 'empty short answer', body: { answers: { ...all, 'pc1-factorial': ' ' } } },
	{ name: 'answers not an object', body: { answers: [0, 1, 2, 3, 4, 5, 6, 7] } },
	{ name: 'unknown field', body: { answers: all, answeredOn: '2026-10-11' } },
])('refuses $name', async ({ body }) => {
	expect((await submit(1, body)).status).toBe(400);
	expect(await rows()).toEqual([]);
});

it.each([
	{ name: 'failed attempt 59 min ago', deck: slug, minutes: 59, correct: 5, passed: 0, status: 429 },
	{ name: 'a passed attempt also starts the cooldown', deck: slug, minutes: 59, correct: 7, passed: 1, status: 429 },
	{ name: 'attempt 61 min ago', deck: slug, minutes: 61, correct: 5, passed: 0, status: 201 },
	{ name: 'attempt 1 min ago on another deck', deck: 'permutations-and-combinations-2', minutes: 1, correct: 5, passed: 0, status: 201 },
])('cooldown: $name', async ({ deck: last, minutes, correct, passed, status }) => {
	const createdAt = ago(minutes);
	await insert.bind('a', last, correct, 8, passed, createdAt).run();
	const response = await submit(1, { answers: all });
	expect(response.status).toBe(status);
	expect(await rows()).toHaveLength(status === 201 ? 2 : 1);
	if (status === 429) expect((await response.json() as { error: { fields: unknown } }).error.fields).toEqual({ nextAt: hourAfter(createdAt) });
});

it('of two quick submits only one is stored', async () => {
	const responses = await Promise.all([submit(1, { answers: all }), submit(1, { answers: all })]);
	expect(responses.map(response => response.status).sort()).toEqual([201, 429]);
	expect(await rows()).toHaveLength(1);
});

it.each([
	{ name: 'no attempt', minutes: null },
	{ name: 'attempt 30 min ago', minutes: 30 },
	{ name: 'attempt 61 min ago', minutes: 61 },
])('round: $name', async ({ minutes }) => {
	const createdAt = minutes === null ? null : ago(minutes);
	if (createdAt) await insert.bind('a', slug, 5, 8, 0, createdAt).run();
	const round = await (await request(`/quiz/${slug}`, 'GET', undefined, student)).json() as QuizRound;
	expect(round.title).toBe('Permutations и Combinations, глава 1');
	expect(round.cards.map(card => card.id)).toEqual(deck.map(card => card.id));
	expect(round.cards.some(card => 'answer' in card || 'explain' in card)).toBe(false);
	expect(round.nextAt).toBe(minutes === 30 ? hourAfter(createdAt!) : null);
});

it.each<{ name: string; role: Role; path: string; method: string; body?: unknown; status: number }>([
	{ name: 'parent cannot submit', role: 'parent', path: `/quiz/${slug}/attempts`, method: 'POST', body: { answers: all }, status: 403 },
	{ name: 'parent reads the cards', role: 'parent', path: `/quiz/${slug}/cards`, method: 'GET', status: 200 },
	{ name: 'student cannot read the cards', role: 'student', path: `/quiz/${slug}/cards`, method: 'GET', status: 403 },
	{ name: 'unknown deck', role: 'student', path: '/quiz/two-sum', method: 'GET', status: 404 },
	{ name: 'attempt of an unknown deck', role: 'student', path: '/quiz/two-sum/attempts', method: 'POST', body: { answers: all }, status: 404 },
	{ name: 'set slug without a chapter number is not a deck', role: 'student', path: '/quiz/permutations-and-combinations', method: 'GET', status: 404 },
])('$name', async ({ role, path, method, body, status }) => {
	const response = await request(path, method, body, role === 'student' ? student : await login('parent'));
	expect(response.status).toBe(status);
	if (path.endsWith('/cards') && status === 200) expect(await response.json()).toEqual(deck);
});

it('lists one deck per chapter with the best passed attempt and the next attempt time', async () => {
	const failedAt = ago(30);
	await env.DB.batch([
		insert.bind('a', slug, 7, 8, 1, ago(180)),
		insert.bind('b', slug, 5, 8, 0, failedAt),
		insert.bind('c', 'permutations-and-combinations-2', 8, 8, 1, ago(120)),
		insert.bind('d', 'permutations-and-combinations-2', 7, 8, 1, ago(90)),
		// The deck had 8 cards at this pass and has 7 now.
		insert.bind('e', 'permutations-and-combinations-3', 8, 8, 1, ago(240)),
		insert.bind('f', 'permutations-and-combinations-4', 4, 6, 0, ago(120)),
		insert.bind('g', 'two-pointers-2', 8, 8, 1, ago(240)),
		insert.bind('h', 'heaps-and-queues-1', 7, 8, 1, ago(240)),
	]);
	const empty = { best: null, bestTotal: null, nextAt: null };
	expect(await (await request('/quiz', 'GET', undefined, student)).json() as QuizDeck[]).toEqual([
		{ slug, title: 'Permutations и Combinations, глава 1', cardCount: 8, best: 7, bestTotal: 8, nextAt: hourAfter(failedAt) },
		{ slug: 'permutations-and-combinations-2', title: 'Permutations и Combinations, глава 2', cardCount: 8, best: 8, bestTotal: 8, nextAt: null },
		{ slug: 'permutations-and-combinations-3', title: 'Permutations и Combinations, глава 3', cardCount: 7, best: 8, bestTotal: 8, nextAt: null },
		{ slug: 'permutations-and-combinations-4', title: 'Permutations и Combinations, глава 4', cardCount: 6, ...empty },
		{ slug: 'two-pointers-1', title: 'Two Pointers, глава 1', cardCount: 8, ...empty },
		{ slug: 'two-pointers-2', title: 'Two Pointers, глава 2', cardCount: 7, best: 8, bestTotal: 8, nextAt: null },
		{ slug: 'two-pointers-3', title: 'Two Pointers, глава 3', cardCount: 8, ...empty },
		{ slug: 'two-pointers-4', title: 'Two Pointers, глава 4', cardCount: 8, ...empty },
		{ slug: 'heaps-and-queues-1', title: 'Heap (Priority Queue), Queue и Deque, глава 1', cardCount: 8, best: 7, bestTotal: 8, nextAt: null },
		{ slug: 'heaps-and-queues-2', title: 'Heap (Priority Queue), Queue и Deque, глава 2', cardCount: 8, ...empty },
		{ slug: 'heaps-and-queues-3', title: 'Heap (Priority Queue), Queue и Deque, глава 3', cardCount: 8, ...empty },
		{ slug: 'heaps-and-queues-4', title: 'Heap (Priority Queue), Queue и Deque, глава 4', cardCount: 8, ...empty },
	]);
});
