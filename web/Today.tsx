import { Lock } from 'lucide-react';
import type { BadgeId, Dashboard, Game, SessionUser } from '../shared/leetcode';
import { localDate } from '../shared/dates';
import { useResource } from './useResource';
import { homeworkLabels } from './Homework';

const badgeText: Record<BadgeId, [string, string]> = {
	'first-accept': ['First accept', 'Save your first accepted attempt.'],
	'three-day-streak': ['3-day streak', 'Save attempts on three days in a row.'],
	'first-hard': ['First hard', 'Get a hard problem accepted.'],
	'ten-accepted': ['Ten accepted', 'Get ten problems accepted.'],
	'independent-five': ['Independent five', 'Understand five accepted problems without help.'],
	'set-cleared': ['Set cleared', 'Get all problems in a learning set accepted.'],
};

export function Today({ user }: { user: SessionUser }) {
	const today = localDate();
	const { data, error, reload } = useResource<Dashboard>(`/dashboard?today=${today}`);
	const { data: game } = useResource<Game>('/game');
	if (!data) return <div className="stack"><h1>Today</h1><p role="status">{error || 'Opening your learning overview...'}</p>{error && <button onClick={reload}>Retry</button>}</div>;
	const waiting = data.homework.find(h => h.state === 'submitted');
	const active = data.homework.find(h => h.state !== 'submitted');
	const draft = data.drafts[0];
	const focus = user.role === 'parent' && waiting ? { title: waiting.problemTitle, href: `/leetcode/tasks/${waiting.id}`, label: 'Review submission', note: 'A submitted attempt is ready for your feedback.' } : draft ? { title: draft.problemTitle, href: `/leetcode/problems/${draft.problemId}`, label: user.role === 'student' ? 'Continue working' : 'Open notebook', note: 'Return to the current approach and explanation.' } : active ? { title: active.problemTitle, href: `/leetcode/tasks/${active.id}`, label: 'Open task', note: active.instructions } : null;
	const counts = [{ label: 'Problems recorded', value: data.counts.recorded }, { label: 'Accepted on LeetCode', value: data.counts.solved }, { label: 'Solved independently', value: data.counts.independent }, { label: user.role === 'parent' ? 'Waiting for review' : 'Due for revision', value: user.role === 'parent' ? data.counts.waitingReview : data.counts.dueReviews }];
	return <div className="stack"><div className="heading"><div><p className="small">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p><h1>{user.role === 'student' ? 'Build understanding, one problem at a time.' : 'A clear view of the learning.'}</h1><p>{user.role === 'student' ? 'Explain the idea. Test it on LeetCode. Return to what needs practice.' : 'Read the reasoning, ask a useful question, and set the next goal.'}</p></div><a className="button" href={user.role === 'parent' ? '/leetcode/homework' : '/leetcode/problems'}>{user.role === 'parent' ? 'Assign homework' : 'Open problems'}</a></div>
		{game && <section className="card card-pad xp-card stack"><h2>Level {game.level}</h2><p>{game.xp} XP. {game.nextLevelXp - game.xp} XP to level {game.level + 1}.</p><progress className="xp" aria-label={`Progress to level ${game.level + 1}`} value={game.xp - game.levelXp} max={game.nextLevelXp - game.levelXp} />
			<ul className="badges" aria-label="Badges">{game.badges.map(({ id, earned }) => <li className="badge" key={id} data-earned={earned} title={badgeText[id][1]}>{!earned && <Lock size={14} role="img" aria-label="Locked" />}{badgeText[id][0]}</li>)}</ul></section>}
		<div className="stats">{counts.map(item => <div className="stat" key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>)}</div>
		{error && <p className="error" role="alert">{error} <button onClick={reload}>Retry</button></p>}
		<div className="columns"><div className="stack"><section className="card card-pad continue-card stack">{focus ? <><h2><a href={focus.href}>{focus.title}</a></h2><p className="prose">{focus.note}</p><a className="button primary" href={focus.href}>{focus.label}</a></> : data.counts.recorded ? <><h2>Choose your next problem.</h2><p>Continue a recorded problem or add a new one.</p><a className="button primary" href="/leetcode/problems">Open the problem library</a></> : <><h2>Your first problem starts here.</h2><p>Add a problem you are working on. Keep your explanations and code together.</p><a className="button primary" href="/leetcode/problems">Add a problem</a></>}</section>
			<section className="card"><header className="card-head"><h2>{user.role === 'parent' ? 'Assignments and submissions' : 'Your homework'}</h2><a href="/leetcode/homework">View all</a></header>{data.homework.map(h => <article className="list-row" key={h.id}><div className="grow"><h3>{h.unread && <span className="unread" role="img" aria-label="New message" />}<a href={`/leetcode/tasks/${h.id}`}>{h.problemTitle}</a></h3><p className="small">{h.homeworkTitle}</p><p className="small">{h.dueDate ? `Due ${h.dueDate}${h.dueDate < today && h.state !== 'submitted' ? ' - Overdue' : ''}` : 'No due date'}</p></div><span className={`tag ${h.state === 'submitted' ? 'good' : 'medium'}`}>{homeworkLabels[h.state]}</span></article>)}{!data.homework.length && <p className="empty">No active homework.</p>}</section>
		</div><div className="stack"><section className="card"><header className="card-head"><h2>Time to revisit</h2><span className="tag">{data.counts.dueReviews} due</span></header>{data.dueReviews.map(p => <article className="list-row" key={p.id}><div className="grow"><h3><a href={`/leetcode/problems/${p.id}/review`}>{p.title}</a></h3><p className="small">{p.topics.join(', ')}</p></div><a href={`/leetcode/problems/${p.id}/review`}>Recall</a></article>)}{!data.dueReviews.length && <p className="empty">No reviews due. Set a reminder when you save an attempt.</p>}<div className="card-pad"><a href={`/leetcode/problems?due=${today}`}>All due reviews</a></div></section>
			<section className="card card-pad stack"><h2>Topic understanding</h2><p className="small">Independently understood / accepted problems</p>{data.topics.map(topic => <div key={topic.topic}><div className="row spread"><span>{topic.topic}</span><small>{topic.independent} / {topic.solved}</small></div><progress aria-label={`${topic.topic} independently understood`} value={topic.independent} max={topic.solved} /></div>)}{!data.topics.length && <p>Topic progress appears after you save an accepted attempt.</p>}</section></div></div>
	</div>;
}
