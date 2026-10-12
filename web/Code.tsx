import { highlight } from './highlight';

// highlight.js escapes the code and emits only span elements, so its output is safe to insert as HTML.
function html(language: string, text: string, blank?: boolean) {
	const value = highlight(language, text).html;
	return { __html: blank ? value.replaceAll('___', '<mark>___</mark>') : value };
}

export function Code({ language, text, blank }: { language: string; text: string; blank?: boolean }) {
	return <pre><code dangerouslySetInnerHTML={html(language, text, blank)} /></pre>;
}

// A transparent textarea over the highlighted copy and the line numbers. All three wrap the same way, so the wrapper takes the height of the copy and each number stays on the first row of its line.
export function CodeField({ language, value, readOnly, onChange }: { language: string; value: string; readOnly: boolean; onChange: (value: string) => void }) {
	return <div className="code-field"><pre aria-hidden="true"><code dangerouslySetInnerHTML={html(language, value.endsWith('\n') ? `${value} ` : value)} /></pre><div className="lines" aria-hidden="true">{value.split('\n').map((line, index) => <div key={index}>{line || ' '}</div>)}</div><textarea aria-label="Код решения" className="code" spellCheck={false} value={value} readOnly={readOnly} onChange={event => onChange(event.target.value)} /></div>;
}
