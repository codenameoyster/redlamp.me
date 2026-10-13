import type { Env } from '../index';
import type { Card, QuizAttempt, QuizCard, QuizDeck, QuizRound, SessionUser } from '../../shared/leetcode';
import { requireRole } from './auth';
import { HttpError, integer, methods, object, readJson, text } from './http';
import { sets } from './sets';

const HOUR = 3_600_000;
const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
const decks = sets.flatMap(set => set.chapters.map((chapter, index) => ({ slug: `${set.slug}-${index + 1}`, title: `${set.title}, глава ${index + 1}`, cards: chapter.cards })));
const strip = (card: Card) => Object.fromEntries(Object.entries(card).filter(([key]) => key !== 'answer' && key !== 'explain')) as QuizCard;
const hourAfter = (time: string) => new Date(Date.parse(time) + HOUR).toISOString();

function grade(card: Card, answer: unknown): { correct: boolean; shown: string } {
	if (card.type === 'short') return { correct: normalize(text(answer, 200, true)) === normalize(card.answer), shown: card.answer };
	return { correct: integer(answer, 0, card.options.length - 1) === card.answer, shown: card.options[card.answer] };
}

export async function handleQuiz(request: Request, env: Env, user: SessionUser): Promise<Response | null> {
	const url = new URL(request.url);
	const match = /^\/leetcode\/api\/quiz(?:\/([^/]+)(?:\/(cards|attempts))?)?$/.exec(url.pathname);
	if (!match) return null;
	const deck = decks.find(item => item.slug === match[1]);
	if (match[1] && !deck) throw new HttpError(404, 'not_found', 'Такой колоды нет.');
	if (match[2] === 'cards') { methods(request, ['GET']); requireRole(user, 'parent'); return Response.json(deck!.cards); }
	if (match[2] === 'attempts') {
		methods(request, ['POST']); requireRole(user, 'student');
		const ids = deck!.cards.map(card => card.id), answers = object(object(await readJson(request), ['answers']).answers, ids);
		const graded = deck!.cards.map(card => ({ card, ...grade(card, answers[card.id]) }));
		const correct = graded.filter(item => item.correct).length, total = ids.length, passed = correct * 5 >= total * 4, now = Date.now();
		// One statement checks the pause and inserts, so of two quick submits only one is stored.
		const [insert, last] = await env.DB.batch<{ last: string }>([
			env.DB.prepare('INSERT INTO quiz_attempts SELECT ?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM quiz_attempts WHERE deck=? AND created_at>?)').bind(crypto.randomUUID(), deck!.slug, correct, total, Number(passed), new Date(now).toISOString(), deck!.slug, new Date(now - HOUR).toISOString()),
			env.DB.prepare('SELECT max(created_at) AS last FROM quiz_attempts WHERE deck=?').bind(deck!.slug),
		]);
		const nextAt = hourAfter(last.results[0].last);
		if (!insert.meta.changes) throw new HttpError(429, 'quiz_paused', 'После попытки квиз закрыт на час.', { nextAt });
		const results = graded.map(({ card, correct, shown }) => passed ? { cardId: card.id, correct, answer: shown, explain: card.explain } : { cardId: card.id, correct });
		return Response.json({ correct, total, passed, nextAt, results } satisfies QuizAttempt, { status: 201 });
	}
	methods(request, ['GET']);
	const rows = await env.DB.prepare('SELECT deck,max(created_at) AS last,max(CASE WHEN passed=1 THEN correct END) AS best,max(CASE WHEN passed=1 THEN total END) AS bestTotal FROM quiz_attempts GROUP BY deck').all<{ deck: string; last: string; best: number | null; bestTotal: number | null }>();
	const now = Date.now(), state = new Map(rows.results.map(row => [row.deck, { best: row.best, bestTotal: row.bestTotal, nextAt: Date.parse(row.last) + HOUR > now ? hourAfter(row.last) : null }]));
	const status = (slug: string) => state.get(slug) ?? { best: null, bestTotal: null, nextAt: null };
	if (!deck) return Response.json(decks.map(({ slug, title, cards }): QuizDeck => ({ slug, title, cardCount: cards.length, ...status(slug) })));
	return Response.json({ title: deck.title, cards: deck.cards.map(strip), nextAt: status(deck.slug).nextAt } satisfies QuizRound);
}
