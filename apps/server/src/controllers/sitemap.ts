import { sql } from "drizzle-orm";
import type { Context } from "hono";

import { database } from "../core/database/database.js";
import { siteUrl } from "../options.js";
import { hono } from "../server.js";
import { useCache } from "../utils/use-cache.js";

const MAX_URLS_PER_SITEMAP = 50_000;
const SITEMAP_TTL = 60 * 60 * 1000;

const sitemapSections = ["pages", "map"] as const;
const sitemapFilePattern = new RegExp(`^(${sitemapSections.join("|")})-([1-9]\\d*)\\.xml$`);

type SitemapSection = (typeof sitemapSections)[number];
type SitemapEntry = { path: string; lastModified?: string };

const sectionsCache = useCache<Record<SitemapSection, SitemapEntry[]>>(SITEMAP_TTL);

function loadSections() {
	return sectionsCache.getOrLoad("sections", computeSections);
}

async function computeSections() {
	const networks = await database.execute<{ network_id: number }>(sql`
		SELECT DISTINCT l.network_id
		FROM line l
		WHERE (l.archived_at IS NULL OR l.archived_at > NOW() AT TIME ZONE 'UTC')
			AND EXISTS (SELECT 1 FROM line_activity a WHERE a.line_id = l.id)
		ORDER BY l.network_id
	`);

	const sections: Record<SitemapSection, SitemapEntry[]> = {
		pages: [{ path: "/" }, { path: "/data" }, { path: "/attributions" }],
		map: Array.from(networks, ({ network_id }) => ({ path: `/?network-id=${network_id}` })),
	};

	return sections;
}

const xmlResponse = (c: Context, lines: string[]) =>
	c.body(['<?xml version="1.0" encoding="UTF-8"?>', ...lines, ""].join("\n"), 200, {
		"Cache-Control": "public, max-age=3600",
		"Content-Type": "application/xml; charset=utf-8",
	});

hono.get("/sitemap.xml", async (c) => {
	const sections = await loadSections();
	const files = sitemapSections.flatMap((section) =>
		Array.from(
			{ length: Math.ceil(sections[section].length / MAX_URLS_PER_SITEMAP) },
			(_, index) => `${siteUrl}/sitemaps/${section}-${index + 1}.xml`,
		),
	);

	return xmlResponse(c, [
		'<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...files.map((loc) => `<sitemap><loc>${loc}</loc></sitemap>`),
		"</sitemapindex>",
	]);
});

hono.get("/sitemaps/:file", async (c) => {
	const match = sitemapFilePattern.exec(c.req.param("file"));
	if (match === null) return c.notFound();

	const section = match[1] as SitemapSection;
	const page = Number(match[2]);
	const entries = (await loadSections())[section].slice((page - 1) * MAX_URLS_PER_SITEMAP, page * MAX_URLS_PER_SITEMAP);
	if (entries.length === 0) return c.notFound();

	return xmlResponse(c, [
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...entries.map(
			({ path, lastModified }) =>
				`<url><loc>${siteUrl}${path}</loc>${lastModified === undefined ? "" : `<lastmod>${lastModified}</lastmod>`}</url>`,
		),
		"</urlset>",
	]);
});
