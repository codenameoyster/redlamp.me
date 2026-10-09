export type Role = 'parent' | 'student';
export interface SessionUser { role: Role; username: string }
export interface Page<T> { items: T[]; nextOffset: number | null }
export const NOTEBOOK_PAGE = /^\/leetcode(?:\/(?:problems|homework|lessons)(?:\/[a-f0-9-]{36}(?:\/review)?)?|\/tasks\/[a-f0-9-]{36}|\/sets(?:\/[a-z0-9-]+)?|\/tutor)?$/;
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
export interface Homework { id: string; title: string; instructions: string; dueDate: string | null; version: number; createdAt: string; updatedAt: string }
export interface HomeworkSummary extends Homework { taskCount: number; completedCount: number; submittedCount: number; requestedCount: number; unread: boolean }
export interface HomeworkTask {
	id: string; homeworkId: string; homeworkTitle: string; instructions: string; dueDate: string | null; problemId: string; problemTitle: string; difficulty: Difficulty;
	state: TaskState; submissionId: string | null; version: number; createdAt: string; updatedAt: string; unread: boolean;
}
export interface Submission { id: string; taskId: string; attemptId: string; taskVersion: number; createdAt: string }
export interface Feedback { id: string; problemId: string; taskId: string | null; submissionId: string | null; author: Role; kind: 'reply' | 'changes_requested' | 'completed'; body: string; createdAt: string }
export interface HomeworkDetails { homework: Homework; tasks: HomeworkTask[] }
export interface TaskDetails { homework: Homework; task: HomeworkTask; submissions: Submission[] }
export interface Lesson { id: string; title: string; description: string; topics: string[]; filename: string; byteCount: number; archivedAt: string | null; version: number; createdAt: string; updatedAt: string }
export const MAX_LESSON_BYTES = 1_000_000;
export const MAX_UPLOAD_BYTES = 1_032_768;
export interface SetTask { slug: string; number: number; title: string; difficulty: Difficulty; topics: string[]; stage: string; note: string }
export interface LearningSet { slug: string; title: string; summary: string; topics: string[]; links: { title: string; url: string; source: string }[]; tasks: SetTask[] }
export interface LearningSetSummary extends Omit<LearningSet, 'links' | 'tasks'> { taskCount: number; acceptedCount: number }
export interface LearningSetDetails extends Omit<LearningSet, 'tasks'> { tasks: (SetTask & { problemId: string | null; accepted: boolean; activeTask: Pick<HomeworkTask, 'id' | 'homeworkId' | 'homeworkTitle' | 'state'> | null })[] }
export interface Revision { id: string; problemId: string; result: Understanding; note: string; reviewedOn: string; nextReviewDate: string | null; createdAt: string }
export interface Dashboard {
	counts: { recorded: number; solved: number; independent: number; waitingReview: number; dueReviews: number };
	topics: { topic: string; solved: number; independent: number }[];
	homework: HomeworkTask[];
	drafts: (AttemptSummary & { problemTitle: string })[];
	dueReviews: Problem[];
}
export interface TutorAccount { connected: boolean; connectedAt: string | null; model: string | null; models: { slug: string; name: string }[]; pending: boolean }
export function newApproach(): Approach {
	return { id: crypto.randomUUID(), label: '', idea: '', correctness: '', timeComplexity: '', spaceComplexity: '', edgeCases: '', mistakes: '', language: '', code: '' };
}
