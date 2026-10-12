import { useState } from 'react';
import type { Card, QuizCard, QuizDeck, QuizResult, QuizRound, SessionUser } from '../shared/leetcode';
import { localDate } from '../shared/dates';
import { api, message } from './api';
import { useResource } from './useResource';
import { plural } from './text';
import { Code } from './Code';
import { Tutor } from './Tutor';

const again = (days: number) => days === 1 ? 'Повтор завтра.' : `Повтор через ${days} дн.`;
const shown = (card: Card) => card.type === 'flip' ? card.back : card.type === 'short' ? card.answer : card.options[card.answer];
const cardCount = (count: number) => plural(count, ['карточка', 'карточки', 'карточек']);
const typeLabels = { flip: 'Вопрос и ответ', choice: 'Выбор ответа', short: 'Короткий ответ', code: 'Код' };

export function Quiz({ user, slug }: { user: SessionUser; slug?: string }) {
	if (!slug) return <DeckList user={user} />;
	return user.role === 'student' ? <Round key={slug} slug={slug} user={user} /> : <CardList slug={slug} />;
}

function DeckList({ user }: { user: SessionUser }) {
	const decks = useResource<QuizDeck[]>(`/quiz?today=${localDate()}`);
	return <div className="stack"><div className="heading"><div><h1>Квиз</h1><p>Выберите тему. Ответьте на карточки к повторению, затем на новые.</p></div></div>
		{decks.error && <p className="error" role="alert">{decks.error}</p>}
		<section className="card">{decks.data?.map(deck => <article className="list-row" key={deck.slug}><div className="grow"><h2><a href={`/leetcode/quiz/${deck.slug}`}>{deck.title}</a></h2><p className="small">{cardCount(deck.cardCount)}</p></div><span className={`tag ${deck.dueCount ? 'medium' : 'good'}`}>К повторению: {deck.dueCount}</span><span className="tag">Новых: {deck.newCount}</span>{user.role === 'student' && deck.dueCount + deck.newCount > 0 && <a className="button primary" href={`/leetcode/quiz/${deck.slug}`} data-tip="Начать раунд по этой колоде.">Начать</a>}</article>)}</section>
	</div>;
}

function CardList({ slug }: { slug: string }) {
	const round = useResource<QuizRound>(`/quiz/${slug}?today=${localDate()}`), cards = useResource<Card[]>(`/quiz/${slug}/cards`);
	if (!round.data || !cards.data) return <p role="status">{round.error || cards.error || 'Открываем колоду...'}</p>;
	return <div className="stack"><div className="heading"><div><h1>{round.data.title}</h1><p>{cardCount(cards.data.length)}. В одном раунде не больше 10 карточек.</p></div><a className="button" href="/leetcode/quiz" data-tip="Вернуться к списку колод.">Назад</a></div>
		<section className="card">{cards.data.map(card => <article className="list-row" key={card.id}><div className="grow stack"><h3>{card.prompt}</h3>{card.type === 'code' && <Code language={card.language} text={card.code} blank />}<p className="small">Ответ: {shown(card)}</p><p className="small">{card.explain}</p></div><span className="tag">{typeLabels[card.type]}</span></article>)}</section>
	</div>;
}

// The deck slug is the set slug plus the chapter number; the tutor gets the set context.
function Round({ slug, user }: { slug: string; user: SessionUser }) {
	const today = localDate();
	const round = useResource<QuizRound>(`/quiz/${slug}?today=${today}`);
	const [index, setIndex] = useState(0), [result, setResult] = useState<QuizResult | null>(null), [score, setScore] = useState(0), [revealed, setRevealed] = useState(false), [typed, setTyped] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
	const cards = round.data?.cards ?? [], card = cards[index] as QuizCard | undefined;
	async function send(answer: string | number) {
		setBusy(true); setError('');
		try { const value = await api<QuizResult>(`/quiz/${slug}/answers`, { method: 'POST', body: JSON.stringify({ cardId: card!.id, answer, answeredOn: today }) }); setResult(value); if (value.correct) setScore(score + 1); }
		catch (error) { setError(message(error)); } finally { setBusy(false); }
	}
	function next() { setIndex(index + 1); setResult(null); setRevealed(false); setTyped(''); }
	if (!round.data) return <p role="status">{round.error || 'Открываем колоду...'}</p>;
	const quote = card ? `${card.prompt}${result ? `\nПравильный ответ: ${result.answer}` : ''}` : undefined;
	return <div className="stack"><div className="heading"><div><p className="small">{card ? `Карточка ${index + 1} из ${cards.length}` : 'Раунд завершён'}</p><h1>{round.data.title}</h1></div><div className="row"><Tutor context={{ kind: 'set', id: slug.replace(/-[0-9]+$/, '') }} title={round.data.title} user={user} quote={quote} /><a className="button" href="/leetcode/quiz" data-tip="Закончить раунд и вернуться к списку колод.">Закончить</a></div></div>
		<progress aria-label="Прогресс раунда" value={index} max={cards.length} />
		{card ? <section className="card card-pad stack quiz-card"><p className="prose">{card.prompt}</p>
			{card.type === 'code' && <Code language={card.language} text={card.code} blank />}
			{!result && card.type === 'flip' && (revealed ? <><p className="prose">{card.back}</p><div className="row"><button disabled={busy} onClick={() => void send('not_yet')} data-tip="Отметить, что вы ещё не знаете ответ.">Ещё нет</button><button className="primary" disabled={busy} onClick={() => void send('got_it')} data-tip="Отметить, что вы знаете ответ.">Знаю</button></div></> : <button onClick={() => setRevealed(true)} data-tip="Показать обратную сторону карточки.">Показать ответ</button>)}
			{!result && (card.type === 'choice' || card.type === 'code') && <div className="stack">{card.options.map((option, i) => <button key={i} disabled={busy} onClick={() => void send(i)} data-tip="Выбрать этот вариант ответа.">{option}</button>)}</div>}
			{!result && card.type === 'short' && <form className="row" onSubmit={event => { event.preventDefault(); void send(typed); }}><label className="grow">Ваш ответ<input value={typed} onChange={event => setTyped(event.target.value)} maxLength={200} required /></label><button className="primary" disabled={busy} data-tip="Проверить ваш ответ.">Проверить</button></form>}
			{error && <p className="error" role="alert">{error}</p>}
			{result && <><p role="status" aria-label="Результат">{result.correct ? `Верно. +2 XP. ${again(result.days)}` : `Пока нет. Ответ: ${result.answer}. ${again(result.days)}`}</p><p className="prose">{result.explain}</p><button className="primary" onClick={next} data-tip="Перейти к следующей карточке.">Следующая карточка</button></>}
		</section> : <section className="card card-pad stack"><h2>{cards.length ? `Верных ответов: ${score} из ${cards.length}.` : 'Сегодня отвечать не на что.'}</h2>{round.data.remaining > 0 ? <><p>Сегодня осталось ещё {cardCount(round.data.remaining)}.</p><a className="button primary" href={`/leetcode/quiz/${slug}`} data-tip="Начать ещё один раунд по этой колоде.">Ещё раунд</a></> : <p>На сегодня всё. Возвращайтесь завтра.</p>}<a href="/leetcode/quiz">К колодам</a></section>}
	</div>;
}
