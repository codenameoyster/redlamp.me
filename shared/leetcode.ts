export type Role = 'parent' | 'student';
export interface SessionUser { role: Role; username: string }
export interface Page<T> { items: T[]; nextOffset: number | null }
export const NOTEBOOK_PAGE = /^\/leetcode(?:\/(?:problems|homework)(?:\/[a-f0-9-]{36}(?:\/review)?)?|\/tasks\/[a-f0-9-]{36}|\/sets(?:\/[a-z0-9-]+(?:\/[1-9][0-9]?)?)?|\/quiz(?:\/[a-z0-9-]+)?|\/tutor)?$/;
export type Acceptance = 'not_submitted' | 'not_accepted' | 'accepted';
export type Understanding = 'needs_practice' | 'with_help' | 'independent';
export type Difficulty = 'easy' | 'medium' | 'hard';
export interface ProblemInput {
	url: string;
	number: number | null;
	title: string;
	difficulty: Difficulty;
	topics: string[];
	summary: string;
}
export type ProblemDetails = Pick<ProblemInput, 'number' | 'title' | 'difficulty' | 'topics'>;
export interface Problem extends ProblemInput {
	id: string;
	slug: string;
	version: number;
	progressVersion: number;
	solved: boolean;
	understanding: Understanding;
	nextReviewDate: string | null;
	archivedAt: string | null;
	createdAt: string;
	updatedAt: string;
}
export interface Approach {
	id: string;
	label: string;
	idea: string;
	correctness: string;
	timeComplexity: string;
	spaceComplexity: string;
	edgeCases: string;
	mistakes: string;
	language: string;
	code: string;
}
export interface AttemptDocument { notes: string; approaches: Approach[] }
export interface DraftValue { document: AttemptDocument; acceptance: Acceptance; understanding: Understanding }
export interface Attempt extends DraftValue {
	id: string;
	problemId: string;
	state: 'draft' | 'saved';
	version: number;
	createdAt: string;
	updatedAt: string;
	savedAt: string | null;
}
export type AttemptSummary = Omit<Attempt, 'document'>;
export const MAX_DOCUMENT_BYTES = 256_000;
export type TaskState = 'assigned' | 'in_progress' | 'submitted' | 'changes_requested' | 'completed' | 'cancelled';
export interface Homework { id: string; title: string; instructions: string; dueDate: string | null; postponedTo: string | null; version: number; createdAt: string; updatedAt: string }
export interface HomeworkSummary extends Homework { taskCount: number; completedCount: number; submittedCount: number; requestedCount: number; unread: boolean }
export interface HomeworkTask {
	id: string; homeworkId: string; homeworkTitle: string; instructions: string; dueDate: string | null; postponedTo: string | null; problemId: string; problemTitle: string; difficulty: Difficulty;
	state: TaskState; submissionId: string | null; version: number; createdAt: string; updatedAt: string; unread: boolean;
}
export interface Submission { id: string; taskId: string; attemptId: string; taskVersion: number; createdAt: string }
export interface Feedback { id: string; problemId: string; taskId: string | null; submissionId: string | null; author: Role; kind: 'reply' | 'changes_requested' | 'completed'; body: string; createdAt: string }
export interface HomeworkDetails { homework: Homework; tasks: HomeworkTask[] }
export type HomeworkBoard = Record<'progress' | 'future' | 'accepted', HomeworkTask[]>;
export interface TaskDetails { homework: Homework; task: HomeworkTask; submissions: Submission[] }
export interface TestCase { input: string; expected: string | null }
// call: LeetCode style. input is a Python literal list of the arguments, expected a Python literal.
// check: 'return' compares the return value, 'arg0' the first argument after the call (in-place tasks), 'prefix' the first argument cut to the returned length (Remove Duplicates).
// order: 'exact', 'any' (sort the top-level list), 'any-nested' (sort each inner list, then the outer list).
// stdio: Codeforces style. input is the stdin text, expected the stdout text; compared token by token.
export type TestSpec = { mode: 'call'; method: string; check?: 'return' | 'arg0' | 'prefix'; order?: 'exact' | 'any' | 'any-nested' } | { mode: 'stdio' };
export type TaskTests = TestSpec & { cases: TestCase[] };
export interface OwnTest { id: string; input: string; createdAt: string }
// The answer of the reference solution to an own test: null when the task has no reference.
export type Expected = { value: string } | { error: 'constraints' | 'input' | 'size' } | null;
export interface ProblemTests { spec: TestSpec | null; source: 'set' | 'leetcode' | 'none'; standard: TestCase[]; own: OwnTest[]; skeleton: string }
// An output of the student code on a hidden test: the answer text, the error message or a timeout.
export type JudgeOutput = { value: string } | { error: string } | { timeout: true };
export type Judgement = { verdict: 'accepted'; failed: null } | { verdict: 'wrong' | 'timeout' | 'error'; failed: { index: number; input: string; expected: string; output: string } };
export interface TestRun { approachId: string; passed: number; total: number; codeHash: string; createdAt: string }
export interface SetTask { url: string; number?: number; title: string; difficulty: Difficulty; topics: string[]; note: string; statement?: string; tests?: TaskTests }
// A lesson figure. The site draws each frame as SVG: rows of cells, with indexes from 0. A tree row draws its cells as a binary tree in heapq order. A placeholder <figure data-figure="id"></figure> in the lesson HTML shows it.
export interface FigureRow { label?: string; cells: (number | string)[]; marked?: number[]; dimmed?: number[]; pointers?: Partial<Record<string, number>>; window?: [number, number]; tree?: true }
export interface FigureFrame { caption: string; rows: FigureRow[] }
export interface Figure { id: string; title: string; frames: FigureFrame[] }
export interface Chapter { title: string; summary: string; tasks: SetTask[]; cards: Card[]; links: { title: string; url: string; source: string }[]; figures?: Figure[] }
export interface LearningSet { slug: string; title: string; summary: string; topics: string[]; chapters: Chapter[] }
export interface ChapterRef { set: string; setTitle: string; number: number; title: string }
export interface LearningSetSummary extends Omit<LearningSet, 'chapters'> { chapterCount: number; taskCount: number; acceptedCount: number }
export type SetTaskRow = SetTask & { slug: string; label: string; problemId: string | null; accepted: boolean; activeTask: Pick<HomeworkTask, 'id' | 'homeworkId' | 'homeworkTitle' | 'state'> | null };
export interface LearningSetDetails extends Omit<LearningSet, 'chapters'> { chapters: { number: number; title: string; summary: string; links: Chapter['links']; tasks: SetTaskRow[] }[] }
export type Card = { id: string; prompt: string; explain: string } & (
	{ type: 'choice'; options: string[]; answer: number }
	| { type: 'short'; answer: string }
	| { type: 'code'; language: string; code: string; options: string[]; answer: number });
type Strip<T> = T extends unknown ? Omit<T, 'answer' | 'explain'> : never;
export type QuizCard = Strip<Card>;
// best is the most correct answers of a passed attempt, and bestTotal the most cards of a passed attempt: a deck can change its size after a pass.
// nextAt is the end of the 1 hour pause after the last attempt.
export interface QuizDeck { slug: string; title: string; cardCount: number; best: number | null; bestTotal: number | null; nextAt: string | null }
export interface QuizRound { title: string; cards: QuizCard[]; nextAt: string | null }
// A failed attempt does not show the right answers and the explanations.
export interface QuizAttempt { correct: number; total: number; passed: boolean; nextAt: string; results: { cardId: string; correct: boolean; answer?: string; explain?: string }[] }
export interface Distribution { count: number; from: string | null; to: string | null }
export interface Revision { id: string; problemId: string; result: Understanding; note: string; reviewedOn: string; nextReviewDate: string | null; createdAt: string }
export interface Dashboard {
	counts: { recorded: number; solved: number; independent: number; waitingReview: number; dueReviews: number };
	topics: { topic: string; solved: number; independent: number }[];
	homework: HomeworkTask[];
	drafts: (Omit<Attempt, 'document'> & { problemTitle: string })[];
	dueReviews: (Problem & { fromHomework: boolean })[];
	recallPicks: Omit<SetTaskRow, 'accepted' | 'activeTask'>[];
}
export type TutorKind = 'problem' | 'set';
export interface TutorMessage { id: string; author: 'student' | 'assistant'; body: string; quote: string | null; createdAt: string }
export type TutorEvent = { delta: string } | { done: true } | { error: { code: string; message: string } };
export interface TutorAccount { connected: boolean; connectedAt: string | null; model: string | null; models: { slug: string; name: string }[]; pending: boolean }
export type BadgeId = 'first-accept' | 'three-day-streak' | 'first-hard' | 'ten-accepted' | 'independent-five' | 'set-cleared' | 'week-no-miss' | 'month-no-miss' | 'twenty-five-accepted' | 'fifty-accepted' | 'fifty-cards' | 'ten-recalls' | 'first-codeforces' | 'first-try' | 'two-sets' | 'on-time-five' | 'level-five';
export interface Game { xp: number; level: number; levelXp: number; nextLevelXp: number; late: number; missed: number; badges: { id: BadgeId; earned: boolean }[] }
export function newApproach(): Approach {
	return { id: crypto.randomUUID(), label: '', idea: '', correctness: '', timeComplexity: '', spaceComplexity: '', edgeCases: '', mistakes: '', language: '', code: '' };
}
export async function sha256(value: string): Promise<string> {
	return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, '0')).join('');
}
