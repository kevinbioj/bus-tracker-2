import { type PageHead, resolvePageHead } from "../core/services/page-head-service.js";
import { siteUrl } from "../options.js";
import type { Locale } from "../paraglide/runtime.js";
import { hono } from "../server.js";
import { resolveRequestLocale } from "../utils/request-locale.js";

const PAGE_HEAD_PREFIX = "/page-head";

const openGraphLocales: Record<Locale, string> = {
	fr: "fr_FR",
	en: "en_GB",
	de: "de_DE",
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

function renderPageHead({ title, description, canonicalPath }: PageHead, locale: Locale) {
	const canonicalUrl = canonicalPath === null ? undefined : `${siteUrl}${canonicalPath}`;
	const tags = [
		`<title data-static-head>${escapeHtml(title)}</title>`,
		description !== undefined && `<meta name="description" content="${escapeHtml(description)}" data-static-head />`,
		canonicalUrl === undefined
			? '<meta name="robots" content="noindex" data-static-head />'
			: `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" data-static-head />`,
		`<meta property="og:title" content="${escapeHtml(title)}" />`,
		description !== undefined && `<meta property="og:description" content="${escapeHtml(description)}" />`,
		canonicalUrl !== undefined && `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
		`<meta property="og:locale" content="${openGraphLocales[locale]}" />`,
		`<meta name="twitter:title" content="${escapeHtml(title)}" />`,
		description !== undefined && `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
	];
	return tags.filter((tag) => tag !== false).join("\n");
}

hono.get(`${PAGE_HEAD_PREFIX}/*`, async (c) => {
	const url = new URL(c.req.url);
	const locale = resolveRequestLocale(c.req.header("user-agent"), c.req.header("accept-language"));
	const head = await resolvePageHead(url.pathname.slice(PAGE_HEAD_PREFIX.length) || "/", url.searchParams, locale);

	return c.html(renderPageHead(head, locale), 200, {
		"Cache-Control": "no-store",
		"Content-Language": locale,
	});
});
