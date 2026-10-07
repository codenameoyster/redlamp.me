export type Role = 'parent' | 'student';
export interface SessionUser { role: Role; username: string }
export interface ApiFailure { error: { code: string; message: string; fields?: Record<string, string> } }
export interface Page<T> { items: T[]; nextOffset: number | null }
