// A page change without a reload keeps the melody playing. App renders the new page on the popstate event.
export function go(href: string, replace = false) {
	if (replace) history.replaceState(null, '', href);
	else history.pushState(null, '', href);
	scrollTo(0, 0);
	dispatchEvent(new PopStateEvent('popstate'));
}
