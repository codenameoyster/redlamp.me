import { expect, it } from 'vitest';
import { diagnosticText } from './python';

it.each([
	{ name: 'undefined name', line: 3, code: 'F821', message: 'Undefined name `nums2`', text: 'Строка 3: неизвестное имя `nums2`.' },
	{ name: 'unused variable', line: 5, code: 'F841', message: 'Local variable `x` is assigned to but never used', text: 'Строка 5: переменная `x` не используется.' },
	{ name: 'unused import', line: 1, code: 'F401', message: '`typing.Dict` imported but unused', text: 'Строка 1: импорт `typing.Dict` не используется.' },
	{ name: 'redefinition', line: 7, code: 'F811', message: 'Redefinition of unused `f` from line 4: `f` redefined here', text: 'Строка 7: имя `f` определено повторно.' },
	{ name: 'unknown code', line: 2, code: 'F706', message: '`return` statement outside of a function/method', text: 'Строка 2: замечание Ruff F706. `return` statement outside of a function/method' },
	{ name: 'syntax error', line: 2, code: null, message: "expected ':'", text: "Строка 2: ошибка синтаксиса. expected ':'" },
])('$name', ({ line, code, message, text }) => {
	expect(diagnosticText(line, code, message)).toBe(text);
});
