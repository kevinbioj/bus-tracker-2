export function scrollBackToStickyToolbar(toolbar: HTMLElement | null) {
	if (toolbar?.parentElement == null) return;

	const stuckScrollY =
		toolbar.parentElement.getBoundingClientRect().top +
		window.scrollY -
		Number.parseFloat(getComputedStyle(toolbar).top);
	if (window.scrollY > stuckScrollY) {
		window.scrollTo({ top: stuckScrollY, behavior: "instant" });
	}
}
