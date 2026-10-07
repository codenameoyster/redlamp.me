export type Role = 'parent' | 'student';
export interface SessionUser { role: Role; username: string }
export interface ApiFailure { error: { code: string; message: string; fields?: Record<string, string> } }
export interface Page<T> { items: T[]; nextOffset: number | null }
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
export interface Problem extends ProblemInput {
	id: string;
	slug: string;
	version: number;
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
export interface DraftUpdate extends DraftValue { version: number }
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
export type HomeworkState = 'assigned' | 'in_progress' | 'submitted' | 'changes_requested' | 'completed' | 'cancelled';
export interface Homework {
	id: string; problemId: string; problemTitle: string; instructions: string; dueDate: string | null;
	state: HomeworkState; submissionId: string | null; version: number; createdAt: string; updatedAt: string;
}
export interface SubmitInput { version: number; attemptId: string; attemptVersion: number; nextReviewDate?: string | null }
export interface Submission { id: string; homeworkId: string; attemptId: string; homeworkVersion: number; createdAt: string }
export interface Feedback { id: string; problemId: string; homeworkId: string | null; submissionId: string | null; author: Role; kind: 'reply' | 'changes_requested' | 'completed'; body: string; createdAt: string }
export interface HomeworkDetails { homework: Homework; submissions: Submission[]; feedback: Feedback[] }
export function newApproach(): Approach {
	return { id: crypto.randomUUID(), label: '', idea: '', correctness: '', timeComplexity: '', spaceComplexity: '', edgeCases: '', mistakes: '', language: '', code: '' };
}
