import { useState } from 'react';
import type { Card, QuizAttempt, QuizCard, QuizDeck, QuizRound, SessionUser } from '../shared/leetcode';
import { api, ApiError, message } from './api';
import { useResource } from './useResource';
import { plural } from './text';
import { Code } from './Code';
import { Terms } from './Terms';

const shown = (card: Card) => card.type === 'short' ? card.answer : card.options[card.answer];
const cardCount = (count: number) => plural(count, ['карточка', 'карточки', 'карточек']);
const typeLabels = { choice: 'Выбор ответа', short: 'Короткий ответ', code: 'Код' };
// The time goes up to the next full minute, because the deck opens at the exact millisecond.
const after = (nextAt: string) => `Следующая попытка после ${new Date(Math.ceil(Date.parse(nextAt) / 60_000) * 60_000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
const passText = (deck: QuizDeck) => deck.best === null ? 'Не пройден' : `Пройден: ${deck.best} из ${deck.bestTotal}`;
export const deckStatus = (deck: QuizDeck | undefined) => deck ? passText(deck) + (deck.nextAt ? `. ${after(deck.nextAt)}` : '') : '';

export function Quiz({ user, slug }: { user: SessionUser; slug?: string }) {
	if (!slug) return <DeckList user={user} />;
	return user.role === 'student' ? <Round key={slug} slug={slug} /> : <CardList slug={slug} />;
}

function DeckList({ user }: { user: SessionUser }) {
	const decks = useResource<QuizDeck[]>('/quiz');
	return <div className="stack"><div className="heading"><div><h1>Квиз</h1><p>Выберите тему и ответьте на все карточки колоды. Квиз засчитан, если верных ответов не меньше 80 %. Следующая попытка через час после прошлой.</p></div></div>
		{decks.error && <p className="error" role="alert">{decks.error}</p>}
		<section className="card">{decks.data?.map(deck => <article className="list-row" key={deck.slug}><div className="grow"><h2><a href={`/leetcode/quiz/${deck.slug}`}>{deck.title}</a></h2><p className="small">{cardCount(deck.cardCount)}</p></div><span className={`tag${deck.best === null ? '' : ' good'}`}>{passText(deck)}</span>{deck.nextAt ? <span className="tag">{after(deck.nextAt)}</span> : user.role === 'student' && <a className="button primary" href={`/leetcode/quiz/${deck.slug}`} data-tip="Ответить на все карточки этой колоды.">Начать</a>}</article>)}</section>
	</div>;
}

function CardList({ slug }: { slug: string }) {
	const round = useResource<QuizRound>(`/quiz/${slug}`), cards = useResource<Card[]>(`/quiz/${slug}/cards`);
	if (!round.data || !cards.data) return <p role="status">{round.error || cards.error || 'Открываем колоду...'}</p>;
	return <div className="stack"><div className="heading"><div><h1>{round.data.title}</h1><p>{cardCount(cards.data.length)}.</p></div><a className="button" href="/leetcode/quiz" data-tip="Вернуться к списку колод.">Назад</a></div>
		<section className="card">{cards.data.map(card => <article className="list-row" key={card.id}><div className="grow stack"><h3>{card.prompt}</h3>{card.type === 'code' && <Code language={card.language} text={card.code} blank />}<p className="small">Ответ: {shown(card)}</p><p className="small">{card.explain}</p></div><span className="tag">{typeLabels[card.type]}</span></article>)}</section>
	</div>;
}

// The page keeps the answers and sends all of them after the last card.
function Round({ slug }: { slug: string }) {
	const round = useResource<QuizRound>(`/quiz/${slug}`);
	const [index, setIndex] = useState(0), [answers, setAnswers] = useState<Record<string, string | number>>({}), [typed, setTyped] = useState(''), [attempt, setAttempt] = useState<QuizAttempt | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
	const cards = round.data?.cards ?? [], nextAt = attempt?.nextAt ?? round.data?.nextAt, card = nextAt ? undefined : cards[index] as QuizCard | undefined;
	async function answer(value: string | number) {
		const all = { ...answers, [card!.id]: value };
		setAnswers(all);
		if (index < cards.length - 1) { setIndex(index + 1); setTyped(''); return; }
		setBusy(true); setError('');
		try { setAttempt(await api<QuizAttempt>(`/quiz/${slug}/attempts`, { method: 'POST', body: JSON.stringify({ answers: all }) })); }
		catch (error) { if (error instanceof ApiError && error.status === 429) round.reload(); else setError(message(error)); } finally { setBusy(false); }
	}
	if (!round.data) return <p role="status">{round.error || 'Открываем колоду...'}</p>;
	const given = (item: QuizCard) => item.type === 'short' ? answers[item.id] : item.options[answers[item.id] as number];
	return <div className="stack"><div className="heading"><div><p className="small">{attempt ? 'Квиз завершён' : card ? `Карточка ${index + 1} из ${cards.length}` : 'Квиз закрыт'}</p><h1>{round.data.title}</h1></div><a className="button" href="/leetcode/quiz" data-tip="Вернуться к списку колод. Ответы до последней карточки не сохраняются.">Закончить</a></div>
		{card && <><progress aria-label="Прогресс квиза" value={index} max={cards.length} /><section className="card card-pad stack quiz-card"><p className="prose"><Terms text={card.prompt} /></p>
			{card.type === 'code' && <Code language={card.language} text={card.code} blank />}
			{/* The next card shows its options at the same place, so the second click of a double click is ignored. */}
			{(card.type === 'choice' || card.type === 'code') && <div className="stack">{card.options.map((option, i) => <button key={i} disabled={busy} onClick={event => { if (event.detail < 2) void answer(i); }} data-tip="Выбрать этот вариант ответа.">{option}</button>)}</div>}
			{card.type === 'short' && <form className="row" onSubmit={event => { event.preventDefault(); void answer(typed); }}><label className="grow">Ваш ответ<input value={typed} onChange={event => setTyped(event.target.value)} maxLength={200} required /></label><button className="primary" disabled={busy || !typed.trim()} data-tip="Записать ответ и перейти к следующей карточке.">Ответить</button></form>}
			{error && <p className="error" role="alert">{error}</p>}
		</section></>}
		{nextAt && <section className="card card-pad stack" role="status">{attempt && <h2>Верных ответов: {attempt.correct} из {attempt.total}. {attempt.passed ? 'Квиз засчитан.' : 'Квиз не засчитан.'}</h2>}{attempt && !attempt.passed && <p>Нужно не меньше 80 % верных ответов. Ниже карточки с ошибками. Перечитайте главу.</p>}<p>{after(nextAt)}.</p><a href="/leetcode/quiz">К колодам</a></section>}
		{attempt && <section className="card">{attempt.results.filter(result => attempt.passed || !result.correct).map(result => { const item = cards.find(c => c.id === result.cardId)!; return <article className="list-row" key={item.id}><div className="grow stack"><h3><Terms text={item.prompt} /></h3>{item.type === 'code' && <Code language={item.language} text={item.code} blank />}{attempt.passed && <><p className="small">Ваш ответ: {given(item)}</p><p className="small">Правильный ответ: {result.answer}</p><p className="small"><Terms text={result.explain ?? ''} /></p></>}</div><span className={`tag ${result.correct ? 'good' : 'hard'}`}>{result.correct ? 'Верно' : 'Ошибка'}</span></article>; })}</section>}
	</div>;
}
