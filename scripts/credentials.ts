import { createHash, randomBytes } from 'node:crypto';
import { openSync, writeSync, closeSync } from 'node:fs';

const usernames = process.argv.slice(2).map(value => value.trim());
if (usernames.length !== 2 || usernames.some(value => !/^[A-Za-z0-9._-]{3,40}$/.test(value)) || usernames[0] === usernames[1]) {
	throw new Error('Supply two distinct usernames with 3-40 letters, digits, dots, dashes, or underscores.');
}
const terminal = openSync('/dev/tty', 'w');
const accounts = Object.fromEntries(['parent', 'student'].map((role, index) => {
	const password = randomBytes(18).toString('base64url');
	writeSync(terminal, `${role}: ${usernames[index]}\nPassword: ${password}\n`);
	return [role, { username: usernames[index], passwordHash: createHash('sha256').update(password).digest('hex') }];
}));
writeSync(terminal, 'Save these passwords in your password manager.\n');
closeSync(terminal);
console.log(JSON.stringify(accounts));
