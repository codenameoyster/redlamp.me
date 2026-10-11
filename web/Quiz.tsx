import { Fragment, useState } from 'react';
import type { Card, QuizCard, QuizDeck, QuizResult, QuizRound, SessionUser } from '../shared/leetcode';
import { localDate } from '../shared/dates';
import { api, message } from './api';
import { useResource } from './useResource';
import { Tutor } from './Tutor';

const again = (days: number) => days === 1 ? 'Again tomorrow.' : `Again in ${days} days.`;
const shown = (card: Card) => card.type === 'flip' ? card.back : card.type === 'short' ? card.answer : card.options[card.answer];

export function Quiz({ user, slug }: { user: SessionUser; slug?: string }) {
	if (!slug) return <DeckList user={user} />;
	return user.role === 'student' ? <Round key={slug} slug={slug} user={user} /> : <CardList slug={slug} />;
}

function DeckList({ user }: { user: SessionUser }) {
	const decks = useResource<QuizDeck[]>(`/quiz?today=${localDate()}`);
	return <div className="stack"><div className="heading"><div><h1>Quiz</h1><p>Choose a topic. Answer the cards that are due, then the new ones.</p></div></div>
		{decks.error && <p className="error" role="alert">{decks.error}</p>}
		<section className="card">{decks.data?.map(deck => <article className="list-row" key={deck.slug}><div className="grow"><h2><a href={`/leetcode/quiz/${deck.slug}`}>{deck.title}</a></h2><p className="small">{deck.cardCount} cards</p></div><span className={`tag ${deck.dueCount ? 'medium' : 'good'}`}>{deck.dueCount} due</span><span className="tag">{deck.newCount} new</span>{user.role === 'student' && deck.dueCount + deck.newCount > 0 && <a className="button primary" href={`/leetcode/quiz/${deck.slug}`}>Start</a>}</article>)}</section>
	</div>;
}

function CardList({ slug }: { slug: string }) {
	const round = useResource<QuizRound>(`/quiz/${slug}?today=${localDate()}`), cards = useResource<Card[]>(`/quiz/${slug}/cards`);
	if (!round.data || !cards.data) return <p role="status">{round.error || cards.error || 'Opening deck...'}</p>;
	return <div className="stack"><div className="heading"><div><h1>{round.data.title}</h1><p>{cards.data.length} cards. The student answers up to 10 per round.</p></div><a className="button" href="/leetcode/quiz">Back</a></div>
		<section className="card">{cards.data.map(card => <article className="list-row" key={card.id}><div className="grow stack"><h3>{card.prompt}</h3>{card.type === 'code' && <pre>{card.code}</pre>}<p className="small">Answer: {shown(card)}</p><p className="small">{card.explain}</p></div><span className="tag">{card.type}</span></article>)}</section>
	</div>;
}

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
	if (!round.data) return <p role="status">{round.error || 'Opening deck...'}</p>;
	const quote = card ? `${card.prompt}${result ? `\nCorrect answer: ${result.answer}` : ''}` : undefined;
	return <div className="stack"><div className="heading"><div><p className="small">{card ? `Card ${index + 1} of ${cards.length}` : 'Round done'}</p><h1>{round.data.title}</h1></div><div className="row"><Tutor context={{ kind: 'set', id: slug }} title={round.data.title} user={user} quote={quote} /><a className="button" href="/leetcode/quiz">Stop</a></div></div>
		<progress aria-label="Round progress" value={index} max={cards.length} />
		{card ? <section className="card card-pad stack quiz-card"><p className="prose">{card.prompt}</p>
			{card.type === 'code' && <pre>{card.code.split('___').map((part, i) => i === 0 ? part : <Fragment key={i}><mark>___</mark>{part}</Fragment>)}</pre>}
			{!result && card.type === 'flip' && (revealed ? <><p className="prose">{card.back}</p><div className="row"><button disabled={busy} onClick={() => void send('not_yet')}>Not yet</button><button className="primary" disabled={busy} onClick={() => void send('got_it')}>Got it</button></div></> : <button onClick={() => setRevealed(true)}>Show answer</button>)}
			{!result && (card.type === 'choice' || card.type === 'code') && <div className="stack">{card.options.map((option, i) => <button key={i} disabled={busy} onClick={() => void send(i)}>{option}</button>)}</div>}
			{!result && card.type === 'short' && <form className="row" onSubmit={event => { event.preventDefault(); void send(typed); }}><label className="grow">Your answer<input value={typed} onChange={event => setTyped(event.target.value)} maxLength={200} required /></label><button className="primary" disabled={busy}>Check</button></form>}
			{error && <p className="error" role="alert">{error}</p>}
			{result && <><p role="status" aria-label="Result">{result.correct ? `Correct. +2 XP. ${again(result.days)}` : `Not yet. The answer is ${result.answer}. ${again(result.days)}`}</p><p className="prose">{result.explain}</p><button className="primary" onClick={next}>Next card</button></>}
		</section> : <section className="card card-pad stack"><h2>{cards.length ? `You got ${score} of ${cards.length}.` : 'Nothing to answer today.'}</h2>{round.data.remaining > 0 ? <><p>{round.data.remaining} more cards today.</p><a className="button primary" href={`/leetcode/quiz/${slug}`}>Another round</a></> : <p>Nothing more today. Come back tomorrow.</p>}<a href="/leetcode/quiz">Back to decks</a></section>}
	</div>;
}
