const rules = new Intl.PluralRules('ru-RU');
/** Russian count with the right noun form: plural(3, ['задача', 'задачи', 'задач']) is "3 задачи". */
export function plural(count: number, [one, few, many]: [string, string, string]): string {
	const form = rules.select(count);
	return `${count} ${form === 'one' ? one : form === 'few' ? few : many}`;
}
