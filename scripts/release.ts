import { execFileSync } from 'node:child_process';

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
if (git('status', '--porcelain')) throw new Error('Commit all changes before release.');
const { version } = await Bun.file('package.json').json() as { version: string };
const tag = `refs/tags/v${version}`;
const refs = new Map(git('ls-remote', 'origin', tag, `${tag}^{}`).split('\n').map(line => {
	const [sha, ref] = line.split('\t');
	return [ref, sha];
}));
if ((refs.get(`${tag}^{}`) ?? refs.get(tag)) !== git('rev-parse', 'HEAD')) throw new Error(`Publish v${version} at this commit before release.`);
