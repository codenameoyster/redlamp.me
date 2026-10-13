import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';
import { testAccountSecret } from './test/fixtures.ts';

export default defineConfig({
	plugins: [cloudflareTest({
		wrangler: { configPath: './wrangler.toml' },
		// The tests replace env.AI.run, so they need no connection to Cloudflare.
		remoteBindings: false,
		miniflare: { bindings: { LEETCODE_ACCOUNTS: testAccountSecret, TUTOR_TOKEN_KEY: btoa('t'.repeat(32)), TEST_MIGRATIONS: await readD1Migrations('./migrations') } },
	})],
	test: { include: ['test/**/*.test.ts', 'web/**/*.test.ts'], setupFiles: ['./test/setup.ts'] },
});
