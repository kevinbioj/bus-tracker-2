import {
	type BreadcrumbItem,
	type PageBody,
	type PageHead,
	resolvePageBody,
	resolvePageHead,
} from "../core/services/page-head-service.js";
import { siteUrl } from "../options.js";
import type { Locale } from "../paraglide/runtime.js";
import { hono } from "../server.js";
import { resolveRequestLocale } from "../utils/request-locale.js";

const PAGE_HEAD_PREFIX = "/page-head";
const PAGE_BODY_PREFIX = "/page-body";

const openGraphLocales: Record<Locale, string> = {
	fr: "fr_FR",
	en: "en_GB",
	de: "de_DE",
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

function renderBreadcrumb(items: BreadcrumbItem[]) {
	const data = {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: items.map(({ name, path }, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name,
			item: `${siteUrl}${path}`,
		})),
	};
	const json = JSON.stringify(data).replace(/</g, "\\u003c");
	return `<script type="application/ld+json" data-static-head>${json}</script>`;
}

function renderPageHead({ title, description, canonicalPath, breadcrumb }: PageHead, locale: Locale) {
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
		breadcrumb !== undefined && renderBreadcrumb(breadcrumb),
	];
	return tags.filter((tag) => tag !== false).join("\n");
}

function renderPageBody({ heading, links }: PageBody) {
	const items = links.map(({ label, path }) => `<li><a href="${escapeHtml(path)}">${escapeHtml(label)}</a></li>`);
	return [
		'<nav aria-labelledby="popular-networks-heading" class="sr-only">',
		`<h2 id="popular-networks-heading">${escapeHtml(heading)}</h2>`,
		`<ul>${items.join("")}</ul>`,
		"</nav>",
	].join("");
}

hono.get(`${PAGE_BODY_PREFIX}/*`, async (c) => {
	const url = new URL(c.req.url);
	const locale = resolveRequestLocale(c.req.header("user-agent"), c.req.header("accept-language"));
	const body = await resolvePageBody(url.pathname.slice(PAGE_BODY_PREFIX.length) || "/", url.searchParams, locale);

	return c.html(body === null ? "" : renderPageBody(body), 200, {
		"Cache-Control": "no-store",
		"Content-Language": locale,
	});
});

hono.get(`${PAGE_HEAD_PREFIX}/*`, async (c) => {
	const url = new URL(c.req.url);
	const locale = resolveRequestLocale(c.req.header("user-agent"), c.req.header("accept-language"));
	const head = await resolvePageHead(url.pathname.slice(PAGE_HEAD_PREFIX.length) || "/", url.searchParams, locale);

	return c.html(renderPageHead(head, locale), 200, {
		"Cache-Control": "no-store",
		"Content-Language": locale,
	});
});
