import { highlight } from './highlight';

// highlight.js escapes the code and emits only span elements, so its output is safe to insert as HTML.
function html(language: string, text: string, blank?: boolean) {
	const value = highlight(language, text).html;
	return { __html: blank ? value.replaceAll('___', '<mark>___</mark>') : value };
}

export function Code({ language, text, blank }: { language: string; text: string; blank?: boolean }) {
	return <pre><code dangerouslySetInnerHTML={html(language, text, blank)} /></pre>;
}

// A transparent textarea over the highlighted copy. Both wrap the same way, so the wrapper takes the height of the copy.
export function CodeField({ language, value, readOnly, onChange }: { language: string; value: string; readOnly: boolean; onChange: (value: string) => void }) {
	return <div className="code-field"><pre aria-hidden="true"><code dangerouslySetInnerHTML={html(language, value.endsWith('\n') ? `${value} ` : value)} /></pre><textarea aria-label="Код решения" className="code" spellCheck={false} value={value} readOnly={readOnly} onChange={event => onChange(event.target.value)} /></div>;
}
