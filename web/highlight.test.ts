import { expect, it } from 'vitest';
import { highlight } from './highlight';

it.each([
	{ name: 'python keyword', language: 'python', code: 'def f():\n    return 1', detected: 'python', html: '<span class="hljs-keyword">def</span>' },
	{ name: 'alias with spaces and upper case', language: ' Py ', code: 'def f(): pass', detected: 'python', html: '<span class="hljs-keyword">def</span>' },
	{ name: 'c++ alias', language: 'C++', code: '#include <vector>', detected: 'cpp', html: '&lt;vector&gt;' },
	{ name: 'c# alias', language: 'c#', code: 'public class A {}', detected: 'csharp', html: '<span class="hljs-keyword">public</span>' },
	{ name: 'golang alias', language: 'golang', code: 'func main() {}', detected: 'go', html: '<span class="hljs-keyword">func</span>' },
	{ name: 'empty language detects python', language: '', code: 'def f(x):\n    return [i for i in range(x) if i % 2 == 0]', detected: 'python', html: '<span class="hljs-keyword">def</span>' },
	{ name: 'unknown language still highlights by detection', language: 'brainfuck', code: 'public static void main(String[] args) { System.out.println("x"); }', detected: expect.any(String), html: '<span class="hljs-keyword">public</span>' },
	{ name: 'markup in the code is escaped', language: 'python', code: 'x = "<b>&</b>"', detected: 'python', html: '&quot;&lt;b&gt;&amp;&lt;/b&gt;&quot;' },
	{ name: 'empty code', language: 'python', code: '', detected: 'python', html: '' },
])('$name', ({ language, code, detected, html }) => {
	const result = highlight(language, code);
	expect(result.language).toEqual(detected);
	expect(result.html).toContain(html);
});
