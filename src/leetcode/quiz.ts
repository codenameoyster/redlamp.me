import type { Env } from '../index';
import type { Card, QuizCard, QuizDeck, QuizResult, QuizRound, SessionUser } from '../../shared/leetcode';
import { addCalendarDays } from '../../shared/dates';
import { requireRole } from './auth';
import { calendarDate, choice, HttpError, integer, methods, object, readJson, text } from './http';
import { sets } from './sets';

const LADDER = [3, 7, 14, 30], ROUND_SIZE = 10;
export function nextInterval(previous: number, correct: boolean): number { return correct ? LADDER.find(days => days > previous) ?? 30 : 1; }
const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
const decks = sets.filter(set => set.cards.length > 0);
export const cardIds = JSON.stringify(decks.flatMap(deck => deck.cards.map(card => card.id)));
// The newest row per card. The bare next_date comes from the row with max(answered_on): https://www.sqlite.org/lang_select.html#bareagg
const STATE = 'SELECT card_id AS cardId,next_date AS nextDate,max(answered_on) FROM card_answers WHERE card_id IN (SELECT value FROM json_each(?)) GROUP BY card_id';
export const dueCardsSQL = `SELECT count(*) AS dueCards FROM (${STATE}) WHERE nextDate<=?`;
const strip = (card: Card) => Object.fromEntries(Object.entries(card).filter(([key]) => key !== 'answer' && key !== 'explain')) as QuizCard;

function grade(card: Card, answer: unknown): { correct: boolean; shown: string } {
	if (card.type === 'flip') return { correct: choice(answer, ['got_it', 'not_yet']) === 'got_it', shown: card.back };
	if (card.type === 'short') return { correct: normalize(text(answer, 200, true)) === normalize(card.answer), shown: card.answer };
	return { correct: integer(answer, 0, card.options.length - 1) === card.answer, shown: card.options[card.answer] };
}

export async function handleQuiz(request: Request, env: Env, user: SessionUser): Promise<Response | null> {
	const url = new URL(request.url);
	const match = /^\/leetcode\/api\/quiz(?:\/([^/]+)(?:\/(cards|answers))?)?$/.exec(url.pathname);
	if (!match) return null;
	const deck = decks.find(item => item.slug === match[1]);
	if (match[1] && !deck) throw new HttpError(404, 'not_found', 'Такой колоды нет.');
	if (match[2] === 'cards') { methods(request, ['GET']); requireRole(user, 'parent'); return Response.json(deck!.cards); }
	if (match[2] === 'answers') {
		methods(request, ['POST']); requireRole(user, 'student');
		const data = object(await readJson(request), ['cardId', 'answer', 'answeredOn']);
		const cardId = choice(data.cardId, deck!.cards.map(item => item.id)), answeredOn = calendarDate(text(data.answeredOn, 10, true))!;
		const card = deck!.cards.find(item => item.id === cardId)!;
		const { correct, shown } = grade(card, data.answer);
		const previous = await env.DB.prepare('SELECT interval_days AS days FROM card_answers WHERE card_id=? ORDER BY answered_on DESC LIMIT 1').bind(card.id).first<{ days: number }>();
		const days = nextInterval(previous?.days ?? 0, correct);
		const [, row] = await env.DB.batch<{ correct: number; days: number }>([
			env.DB.prepare('INSERT INTO card_answers VALUES (?,?,?,?,?,?,?) ON CONFLICT DO NOTHING').bind(crypto.randomUUID(), card.id, Number(correct), days, answeredOn, addCalendarDays(answeredOn, days), new Date().toISOString()),
			env.DB.prepare('SELECT correct,interval_days AS days FROM card_answers WHERE card_id=? AND answered_on=?').bind(card.id, answeredOn),
		]);
		const stored = row.results[0];
		return Response.json({ correct: Boolean(stored.correct), answer: shown, explain: card.explain, days: stored.days } satisfies QuizResult, { status: 201 });
	}
	methods(request, ['GET']);
	const today = calendarDate(text(url.searchParams.get('today'), 10, true))!;
	const rows = await env.DB.prepare(STATE).bind(cardIds).all<{ cardId: string; nextDate: string }>();
	const state = new Map(rows.results.map(row => [row.cardId, row.nextDate]));
	const due = (card: Card) => state.has(card.id) && state.get(card.id)! <= today, fresh = (card: Card) => !state.has(card.id);
	if (!deck) return Response.json(decks.map(({ slug, title, cards }): QuizDeck => ({ slug, title, cardCount: cards.length, dueCount: cards.filter(due).length, newCount: cards.filter(fresh).length })));
	const queue = [...deck.cards.filter(due).sort((a, b) => state.get(a.id)!.localeCompare(state.get(b.id)!)), ...deck.cards.filter(fresh)];
	return Response.json({ title: deck.title, cards: queue.slice(0, ROUND_SIZE).map(strip), remaining: Math.max(0, queue.length - ROUND_SIZE) } satisfies QuizRound);
}
