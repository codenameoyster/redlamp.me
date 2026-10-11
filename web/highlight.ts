import hljs from 'highlight.js/lib/core';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import kotlin from 'highlight.js/lib/languages/kotlin';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';

const languages = { cpp, csharp, go, java, javascript, kotlin, python, rust, swift, typescript };
const names = Object.keys(languages);
for (const name of names) hljs.registerLanguage(name, languages[name as keyof typeof languages]);

// The language field is free text, so an alias such as "C++" or "py" resolves to its registered language. An unknown name falls back to detection.
export function highlight(language: string, code: string): { language: string | undefined; html: string } {
	const alias = hljs.getLanguage(language.trim().toLowerCase()), name = alias && names.find(key => hljs.getLanguage(key) === alias);
	if (name) return { language: name, html: hljs.highlight(code, { language: name }).value };
	const result = hljs.highlightAuto(code, names);
	return { language: result.language, html: result.value };
}
