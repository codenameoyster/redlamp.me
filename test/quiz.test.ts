import { env } from 'cloudflare:workers';
import { beforeEach, expect, it } from 'vitest';
import { login, request } from './client';
import type { Dashboard, QuizDeck, QuizRound, Role } from '../shared/leetcode';
import { sets } from '../src/leetcode/sets';
import { nextInterval } from '../src/leetcode/quiz';

const chapters = sets.find(item => item.slug === 'permutations-and-combinations')!.chapters;
const deck = chapters[0].cards;
const slug = 'permutations-and-combinations-1', today = '2026-10-11';
const insert = env.DB.prepare("INSERT INTO card_answers VALUES (?,?,?,?,?,?,'now')");
let student: string;
beforeEach(async () => { student = await login(); });
const answer = (cardId: string, value: unknown, answeredOn = today, chapter = 1) => request(`/quiz/permutations-and-combinations-${chapter}/answers`, 'POST', { cardId, answer: value, answeredOn }, student);

it.each([
	{ name: 'new card correct', previous: 0, correct: true, days: 3 },
	{ name: 'new card wrong', previous: 0, correct: false, days: 1 },
	{ name: '3 to 7', previous: 3, correct: true, days: 7 },
	{ name: '7 to 14', previous: 7, correct: true, days: 14 },
	{ name: '14 to 30', previous: 14, correct: true, days: 30 },
	{ name: '30 stays 30', previous: 30, correct: true, days: 30 },
	{ name: 'wrong at 14 gives 1', previous: 14, correct: false, days: 1 },
	{ name: 'correct after a wrong answer gives 3', previous: 1, correct: true, days: 3 },
])('ladder: $name', ({ previous, correct, days }) => { expect(nextInterval(previous, correct)).toBe(days); });

it.each([
	{ name: 'flip got it', cardId: 'pc-symmetry', value: 'got_it', status: 201, correct: true, days: 3 },
	{ name: 'flip not yet', cardId: 'pc-symmetry', value: 'not_yet', status: 201, correct: false, days: 1 },
	{ name: 'flip with a number', cardId: 'pc-symmetry', value: 1, status: 400 },
	{ name: 'choice right option', cardId: 'pc-product-rule', value: 1, status: 201, correct: true, days: 3 },
	{ name: 'choice wrong option', cardId: 'pc-product-rule', value: 0, status: 201, correct: false, days: 1 },
	{ name: 'option index out of range', cardId: 'pc-product-rule', value: 3, status: 400 },
	{ name: 'option index as text', cardId: 'pc-product-rule', value: '1', status: 400 },
	{ name: 'code right line', cardId: 'pc-undo', chapter: 2, value: 0, status: 201, correct: true, days: 3 },
	{ name: 'short exact', cardId: 'pc-factorial', value: '120', status: 201, correct: true, days: 3 },
	{ name: 'short answer with extra spaces', cardId: 'pc-choose', value: '  10 ', status: 201, correct: true, days: 3 },
	{ name: 'short wrong', cardId: 'pc-factorial', value: '24', status: 201, correct: false, days: 1 },
	{ name: 'short empty', cardId: 'pc-factorial', value: '', status: 400 },
	{ name: 'unknown card', cardId: 'pc-missing', value: 1, status: 400 },
	{ name: 'card from another chapter', cardId: 'pc-template', value: 'got_it', status: 400 },
	{ name: 'bad date', cardId: 'pc-factorial', value: '120', answeredOn: '2026-13-01', status: 400 },
])('grades: $name', async ({ cardId, chapter = 1, value, answeredOn, status, correct, days }) => {
	const response = await answer(cardId, value, answeredOn, chapter);
	expect(response.status).toBe(status);
	if (status !== 201) return;
	const card = chapters[chapter - 1].cards.find(item => item.id === cardId)!;
	const shown = card.type === 'flip' ? card.back : card.type === 'short' ? card.answer : card.options[card.answer];
	expect(await response.json()).toEqual({ correct, answer: shown, explain: card.explain, days });
	expect(await env.DB.prepare('SELECT card_id,correct,interval_days,answered_on,next_date FROM card_answers').all().then(r => r.results)).toEqual([{ card_id: cardId, correct: Number(correct), interval_days: days, answered_on: today, next_date: days === 3 ? '2026-10-14' : '2026-10-12' }]);
});

it('second answer on the same day keeps the first result', async () => {
	expect((await answer('pc-factorial', '24')).status).toBe(201);
	const retry = await answer('pc-factorial', '120');
	expect(retry.status).toBe(201);
	expect(await retry.json()).toMatchObject({ correct: false, days: 1 });
	expect(await env.DB.prepare('SELECT count(*) AS n FROM card_answers').first('n')).toBe(1);
});

it('the next day continues the ladder from the stored interval', async () => {
	await insert.bind('a', 'pc-factorial', 1, 3, '2026-10-01', '2026-10-04').run();
	expect(await (await answer('pc-factorial', '120')).json()).toMatchObject({ correct: true, days: 7 });
});

it.each<{ name: string; role: Role; path: string; method: string; body?: unknown; status: number }>([
	{ name: 'parent cannot answer', role: 'parent', path: `/quiz/${slug}/answers`, method: 'POST', body: { cardId: 'pc-factorial', answer: '120', answeredOn: today }, status: 403 },
	{ name: 'parent reads the cards', role: 'parent', path: `/quiz/${slug}/cards`, method: 'GET', status: 200 },
	{ name: 'student cannot read the cards', role: 'student', path: `/quiz/${slug}/cards`, method: 'GET', status: 403 },
	{ name: 'unknown deck', role: 'student', path: `/quiz/two-sum?today=${today}`, method: 'GET', status: 404 },
	{ name: 'set slug without a chapter number is not a deck', role: 'student', path: `/quiz/permutations-and-combinations?today=${today}`, method: 'GET', status: 404 },
	{ name: 'round without today', role: 'student', path: `/quiz/${slug}`, method: 'GET', status: 400 },
])('$name', async ({ role, path, method, body, status }) => {
	const response = await request(path, method, body, role === 'student' ? student : await login('parent'));
	expect(response.status).toBe(status);
	if (path.endsWith('/cards') && status === 200) expect(await response.json()).toEqual(deck);
});

it('lists one deck per chapter and builds the round from due cards, then new cards', async () => {
	await env.DB.batch([
		insert.bind('a', 'pc-choose', 1, 3, '2026-10-05', '2026-10-08'),
		insert.bind('b', 'pc-product-rule', 0, 1, '2026-10-09', '2026-10-10'),
		insert.bind('c', 'pc-factorial', 1, 7, '2026-10-10', '2026-10-17'),
		insert.bind('d', 'pc-sum-rule', 1, 3, '2026-10-11', '2026-10-14'),
		insert.bind('e', 'pc-removed', 0, 1, '2026-10-01', '2026-10-02'),
		insert.bind('f', 'pc-catalan', 1, 3, '2026-10-05', '2026-10-08'),
	]);
	const decks = await (await request(`/quiz?today=${today}`, 'GET', undefined, student)).json() as QuizDeck[];
	expect(decks).toEqual([
		{ slug, title: 'Permutations and combinations, глава 1', cardCount: 8, dueCount: 2, newCount: 4 },
		{ slug: 'permutations-and-combinations-2', title: 'Permutations and combinations, глава 2', cardCount: 8, dueCount: 0, newCount: 8 },
		{ slug: 'permutations-and-combinations-3', title: 'Permutations and combinations, глава 3', cardCount: 6, dueCount: 1, newCount: 5 },
		{ slug: 'permutations-and-combinations-4', title: 'Permutations and combinations, глава 4', cardCount: 4, dueCount: 0, newCount: 4 },
	]);
	const round = await (await request(`/quiz/${slug}?today=${today}`, 'GET', undefined, student)).json() as QuizRound;
	expect(round.title).toBe('Permutations and combinations, глава 1');
	expect(round.cards.map(card => card.id)).toEqual(['pc-choose', 'pc-product-rule', 'pc-perm-k', 'pc-symmetry', 'pc-subsets-count', 'pc-order-matters']);
	expect(round.remaining).toBe(0);
	expect(round.cards.some(card => 'answer' in card || 'explain' in card)).toBe(false);
	expect(round.cards.find(card => card.id === 'pc-symmetry')).toMatchObject({ type: 'flip', back: expect.any(String) });
	const dashboard = await (await request(`/dashboard?today=${today}`, 'GET', undefined, student)).json() as Dashboard;
	expect(dashboard.counts.dueCards).toBe(3);
});
