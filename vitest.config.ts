import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';
import { testAccountSecret } from './test/fixtures.ts';

export default defineConfig({
	plugins: [cloudflareTest({
		wrangler: { configPath: './wrangler.toml' },
		miniflare: { bindings: { LEETCODE_ACCOUNTS: testAccountSecret, TEST_MIGRATIONS: await readD1Migrations('./migrations') } },
	})],
	test: { include: ['test/**/*.test.ts'], setupFiles: ['./test/setup.ts'] },
});
