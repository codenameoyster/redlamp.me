import { createHash } from 'node:crypto';

export const testAccountSecret = JSON.stringify({
	parent: { username: 'parent-test', passwordHash: createHash('sha256').update('parent-test-password-001').digest('hex') },
	student: { username: 'student-test', passwordHash: createHash('sha256').update('student-test-password-01').digest('hex') },
});
