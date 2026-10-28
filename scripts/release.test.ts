import { expect, test } from 'bun:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const source = resolve(import.meta.dir, '..');
const script = join(source, 'scripts/release.ts');

test.each([
	{ name: 'published lightweight tag at this commit', tag: 'current', annotated: false, dirty: false, ok: true },
	{ name: 'published annotated tag at this commit', tag: 'current', annotated: true, dirty: false, ok: true },
	{ name: 'version has no published tag', tag: 'missing', annotated: false, dirty: false, ok: false },
	{ name: 'published tag points to another commit', tag: 'previous', annotated: false, dirty: false, ok: false },
	{ name: 'tracked files differ from the tagged commit', tag: 'current', annotated: false, dirty: true, ok: false },
])('$name', ({ tag, annotated, dirty, ok }) => {
	const directory = mkdtempSync(join(tmpdir(), 'redlamp-release-'));
	const checkout = join(directory, 'checkout'), remote = join(directory, 'remote');
	const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
	try {
		git(source, 'clone', '--quiet', '--shared', '--no-checkout', source, checkout);
		git(checkout, 'sparse-checkout', 'set', '--no-cone', '/package.json');
		git(checkout, 'checkout', '--quiet', '--detach', 'HEAD');
		git(source, 'clone', '--quiet', '--bare', '--shared', '--no-tags', source, remote);
		git(checkout, 'remote', 'set-url', 'origin', remote);
		const { version } = JSON.parse(readFileSync(join(checkout, 'package.json'), 'utf8')) as { version: string };
		if (tag !== 'missing') git(remote, '-c', 'tag.gpgsign=false', 'tag', ...(annotated ? ['-a', '-m', 'Release fixture'] : []), `v${version}`, tag === 'previous' ? 'HEAD^' : 'HEAD');
		if (dirty) writeFileSync(join(checkout, 'package.json'), '{}\n');
		const result = spawnSync(process.execPath, [script], { cwd: checkout, encoding: 'utf8' });
		expect(result.status, result.stderr).toBe(ok ? 0 : 1);
		if (!ok) expect(result.stderr).toContain(dirty ? 'Commit all changes before release.' : `Publish v${version} at this commit before release.`);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
