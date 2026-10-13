import { useState } from 'react';
import { Lock } from 'lucide-react';
import type { BadgeId, Dashboard, Game, SessionUser } from '../shared/leetcode';
import { localDate } from '../shared/dates';
import { message } from './api';
import { useResource } from './useResource';
import { homeworkLabels } from './Homework';
import { addProblem } from './Sets';
import { go } from './navigate';

const badgeText: Record<BadgeId, [string, string]> = {
	'first-accept': ['Первая принятая', 'Сохраните первую принятую попытку.'],
	'three-day-streak': ['Три дня подряд', 'Сохраняйте попытки три дня подряд.'],
	'first-hard': ['Первая сложная', 'Добейтесь принятия сложной задачи.'],
	'ten-accepted': ['Десять принятых', 'Добейтесь принятия десяти задач.'],
	'independent-five': ['Пять самостоятельных', 'Разберитесь в пяти принятых задачах без подсказок.'],
	'set-cleared': ['Набор пройден', 'Добейтесь принятия всех задач набора.'],
	'week-no-miss': ['Неделя без пропусков', 'Открывайте тетрадь 7 дней подряд.'],
	'month-no-miss': ['Месяц без пропусков', 'Открывайте тетрадь 30 дней подряд.'],
	'twenty-five-accepted': ['25 принятых', 'Добейтесь принятия 25 задач.'],
	'fifty-accepted': ['50 принятых', 'Добейтесь принятия 50 задач.'],
	'fifty-cards': ['50 карточек', 'Ответьте верно на 50 карточек квиза.'],
	'ten-recalls': ['Десять повторений', 'Повторите задачи 10 раз.'],
	'first-codeforces': ['Первая с Codeforces', 'Добейтесь принятия задачи с Codeforces.'],
	'first-try': ['С первого раза', 'Пройдите все тесты задачи первым же запуском.'],
	'two-sets': ['Два набора', 'Добейтесь принятия всех задач двух наборов.'],
	'on-time-five': ['Вовремя', 'Отправьте 5 заданий не позже срока.'],
	'level-five': ['Уровень 5', 'Наберите 1000 XP.'],
};

export function Today({ user }: { user: SessionUser }) {
	const today = localDate();
	const { data, error, reload } = useResource<Dashboard>(`/dashboard?today=${today}`);
	const { data: game } = useResource<Game>('/game');
	const [failure, setFailure] = useState('');
	if (!data) return <div className="stack"><h1>Сегодня</h1><p role="status">{error || 'Открываем обзор обучения...'}</p>{error && <button onClick={reload} data-tip="Загрузить обзор снова.">Попробовать снова</button>}</div>;
	const waiting = data.homework.find(h => h.state === 'submitted');
	const active = data.homework.find(h => h.state !== 'submitted');
	const draft = data.drafts[0], draftTask = draft && data.homework.find(h => h.problemId === draft.problemId && h.state !== 'submitted');
	const focus = user.role === 'parent' && waiting ? { title: waiting.problemTitle, href: `/leetcode/tasks/${waiting.id}`, label: 'Проверить работу', note: 'Отправленная попытка ждёт вашего отзыва.' } : draft ? { title: draft.problemTitle, href: draftTask ? `/leetcode/tasks/${draftTask.id}` : `/leetcode/problems/${draft.problemId}`, label: user.role === 'student' ? 'Продолжить работу' : 'Открыть тетрадь', note: 'Вернитесь к текущему подходу и объяснению.' } : active ? { title: active.problemTitle, href: `/leetcode/tasks/${active.id}`, label: 'Открыть задание', note: active.instructions } : null;
	const counts = [{ label: 'Задач записано', value: data.counts.recorded }, { label: 'Принято', value: data.counts.solved }, { label: 'Решено самостоятельно', value: data.counts.independent }, { label: user.role === 'parent' ? 'Ждут проверки' : 'К повторению', value: user.role === 'parent' ? data.counts.waitingReview : data.counts.dueReviews }];
	return <div className="stack"><div className="heading"><div><p className="small">{new Date().toLocaleDateString('ru-RU', { weekday: 'long', month: 'long', day: 'numeric' })}</p><h1>{user.role === 'student' ? 'Стройте понимание, задача за задачей.' : 'Ясная картина обучения.'}</h1><p>{user.role === 'student' ? 'Объясните идею. Проверьте её на LeetCode. Вернитесь к тому, что нужно потренировать.' : 'Прочитайте рассуждение, задайте полезный вопрос и поставьте следующую цель.'}</p></div><a className="button" href={user.role === 'parent' ? '/leetcode/homework' : '/leetcode/problems'} data-tip={user.role === 'parent' ? 'Перейти к домашним работам.' : 'Перейти к списку задач.'}>{user.role === 'parent' ? 'Назначить домашнюю работу' : 'Открыть задачи'}</a></div>
		{game && <section className="card card-pad stack"><h2>Уровень {game.level}</h2><p>{game.xp} XP. До уровня {game.level + 1}: {game.nextLevelXp - game.xp} XP.</p>{game.late > 0 && <p>Просрочено: {game.late} (−15 XP каждое)</p>}{game.missed > 0 && <p>Пропущено дней: {game.missed} (−5 XP каждый)</p>}<progress className="xp" aria-label={`Прогресс до уровня ${game.level + 1}`} value={game.xp - game.levelXp} max={game.nextLevelXp - game.levelXp} />
			<ul className="badges" aria-label="Значки">{game.badges.map(({ id, earned }) => <li className="badge" key={id} data-earned={earned} title={badgeText[id][1]}>{!earned && <Lock size={14} role="img" aria-label="Не получен" />}{badgeText[id][0]}</li>)}</ul></section>}
		<div className="stats">{counts.map(item => <div className="stat" key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>)}</div>
		{error && <p className="error" role="alert">{error} <button onClick={reload} data-tip="Загрузить обзор снова.">Попробовать снова</button></p>}
		<div className="columns"><div className="stack"><section className="card card-pad stack">{focus ? <><h2><a href={focus.href}>{focus.title}</a></h2><p className="prose">{focus.note}</p><a className="button primary" href={focus.href} data-tip={`Перейти к задаче «${focus.title}».`}>{focus.label}</a></> : data.counts.recorded ? <><h2>Выберите следующую задачу.</h2><p>Продолжите записанную задачу или добавьте новую.</p><a className="button primary" href="/leetcode/problems" data-tip="Перейти к списку задач.">Открыть библиотеку задач</a></> : <><h2>Ваша первая задача начинается здесь.</h2><p>Добавьте задачу, над которой работаете. Храните объяснения и код вместе.</p><a className="button primary" href="/leetcode/problems" data-tip="Перейти к задачам, чтобы добавить новую.">Добавить задачу</a></>}</section>
			<section className="card"><header className="card-head"><h2>{user.role === 'parent' ? 'Задания и отправленные работы' : 'Ваша домашняя работа'}</h2><a href="/leetcode/homework">Показать все</a></header>{data.homework.map(h => <article className="list-row" key={h.id}><div className="grow"><h3>{h.unread && <span className="unread" role="img" aria-label="Новое сообщение" />}<a href={`/leetcode/tasks/${h.id}`}>{h.problemTitle}</a></h3><p className="small">{h.homeworkTitle}</p><p className="small">{h.dueDate ? `Срок ${h.dueDate}${h.dueDate < today && h.state !== 'submitted' ? ' - Просрочено' : ''}` : 'Без срока'}</p></div><span className={`tag ${h.state === 'submitted' ? 'good' : 'medium'}`}>{homeworkLabels[h.state]}</span></article>)}{!data.homework.length && <p className="empty">Нет активной домашней работы.</p>}</section>
		</div><div className="stack"><section className="card"><header className="card-head"><h2>Пора повторить</h2><span className="tag">{data.counts.dueReviews} к повторению</span></header>{data.dueReviews.map(p => { const href = `/leetcode/problems/${p.id}/review${p.fromHomework ? '?pick=1' : ''}`; return <article className="list-row" key={p.id}><div className="grow"><h3><a href={href}>{p.title}</a></h3><p className="small">{p.topics.join(', ')}</p></div><a href={href}>Повторить</a></article>; })}{!data.dueReviews.length && <p className="empty">Нет задач к повторению. Нажмите «Нужно потренироваться» или распределите принятые задачи.</p>}{data.recallPicks.length > 0 && <section aria-labelledby="recall-picks"><header className="card-head"><h3 id="recall-picks">Случайное повторение</h3></header>{failure && <p className="error card-pad" role="alert">{failure}</p>}{data.recallPicks.map(pick => <article className="list-row" key={pick.slug}><span className="small">{pick.label}</span><div className="grow"><h3>{pick.title}</h3><p className="small">{pick.topics.join(', ')}</p></div>{pick.problemId ? <a href={`/leetcode/problems/${pick.problemId}/review?pick=1`}>Повторить</a> : <button onClick={() => addProblem(pick).then(problem => go(`/leetcode/problems/${problem.id}/review?pick=1`), error => setFailure(message(error)))} data-tip="Добавить задачу в библиотеку и начать повторение.">Повторить</button>}</article>)}</section>}<article className="list-row"><div className="grow"><h3><a href="/leetcode/quiz">Карточки квиза</a></h3><p className="small">{data.counts.dueCards} к повторению</p></div><a href="/leetcode/quiz">Тренироваться</a></article><div className="card-pad"><a href={`/leetcode/problems?due=${today}`}>Все задачи к повторению</a></div></section>
			<section className="card card-pad stack"><h2>Понимание тем</h2><p className="small">Решено самостоятельно / принято</p>{data.topics.map(topic => <div key={topic.topic}><div className="row spread"><span>{topic.topic}</span><small>{topic.independent} / {topic.solved}</small></div><progress aria-label={`${topic.topic}: решено самостоятельно`} value={topic.independent} max={topic.solved} /></div>)}{!data.topics.length && <p>Прогресс по темам появится после первой принятой попытки.</p>}</section></div></div>
	</div>;
}
