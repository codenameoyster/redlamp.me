// The constraint checks of the set references. A failed check throws RangeError('constraints').
export function need(ok: boolean): asserts ok { if (!ok) throw new RangeError('constraints'); }
export function int(value: unknown, lo: number, hi: number): number { need(typeof value === 'number' && Number.isInteger(value) && value >= lo && value <= hi); return value; }
export function ints(list: unknown, min: number, max: number, lo: number, hi: number): number[] { need(Array.isArray(list) && list.length >= min && list.length <= max); for (const value of list) int(value, lo, hi); return list; }
export function str(value: unknown, pattern: RegExp): string { need(typeof value === 'string' && pattern.test(value)); return value; }

// Reads stdin as tokens between white space. end() rejects a token after the last expected token.
export function reader(stdin: string) {
	const tokens = stdin.split(/\s+/).filter(Boolean);
	let at = 0;
	const word = (pattern: RegExp): string => str(tokens[at++], pattern);
	return { word, int: (lo: number, hi: number): number => int(Number(word(/^\d+$/)), lo, hi), end: (): void => need(at === tokens.length) };
}
