import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
	{
		files: ['{src,web,shared,scripts,test,e2e}/**/*.{ts,tsx}'],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaVersion: 2025,
				sourceType: 'module',
			},
		},
		plugins: {
			'@typescript-eslint': tseslint,
		},
		rules: {
			...tseslint.configs.recommended.rules,
		},
	},
	{
		// The set references in src/ must not get into the browser bundle, where the student can read them.
		files: ['{web,shared}/**/*.{ts,tsx}'],
		rules: { 'no-restricted-imports': ['error', { patterns: [{ group: ['**/src/**'], message: 'The browser code must not import the server code.' }] }] },
	},
];
