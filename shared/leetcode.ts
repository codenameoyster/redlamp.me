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
