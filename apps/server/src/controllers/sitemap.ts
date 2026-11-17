import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { Context } from "hono";

import { database } from "../core/database/database.js";
import { networksTable, vehiclesTable } from "../core/database/schema.js";
import { siteUrl } from "../options.js";
import { hono } from "../server.js";
import { useCache } from "../utils/use-cache.js";

const MAX_URLS_PER_SITEMAP = 50_000;
const SITEMAP_TTL = 60 * 60 * 1000;

const sitemapSections = ["pages", "networks", "lines", "vehicles"] as const;
const sitemapFilePattern = new RegExp(`^(${sitemapSections.join("|")})-([1-9]\\d*)\\.xml$`);

type SitemapSection = (typeof sitemapSections)[number];
type SitemapEntry = { path: string; lastModified?: string };

const sectionsCache = useCache<Record<SitemapSection, SitemapEntry[]>>(SITEMAP_TTL);

let sectionsInFlight: Promise<Record<SitemapSection, SitemapEntry[]>> | undefined;

async function loadSections() {
	const cached = sectionsCache.get("sections");
	if (cached !== undefined) return cached;

	sectionsInFlight ??= computeSections().finally(() => {
		sectionsInFlight = undefined;
	});
	return sectionsInFlight;
}

async function computeSections() {
	const [regions, networks, lines, vehicles] = await Promise.all([
		database
			.selectDistinct({ id: networksTable.regionId })
			.from(networksTable)
			.where(
				and(
					eq(networksTable.hasVehiclesFeature, true),
					eq(networksTable.countryCode, "FR"),
					isNotNull(networksTable.regionId),
				),
			)
			.orderBy(asc(networksTable.regionId)),
		database
			.select({ id: networksTable.id, hasVehiclesFeature: networksTable.hasVehiclesFeature })
			.from(networksTable)
			.orderBy(asc(networksTable.id)),
		database.execute<{ id: number; last_service_date: string }>(sql`
			SELECT l.id, a.last_service_date
			FROM line l
			CROSS JOIN LATERAL (
				SELECT TO_CHAR(MAX(service_date), 'YYYY-MM-DD') AS last_service_date
				FROM line_activity
				WHERE line_id = l.id
			) a
			WHERE (l.archived_at IS NULL OR l.archived_at > NOW() AT TIME ZONE 'UTC')
				AND a.last_service_date IS NOT NULL
			ORDER BY l.id
		`),
		database
			.select({ id: vehiclesTable.id, lastSeenAt: vehiclesTable.lastSeenAt })
			.from(vehiclesTable)
			.innerJoin(networksTable, eq(networksTable.id, vehiclesTable.networkId))
			.where(
				and(
					eq(networksTable.hasVehiclesFeature, true),
					isNull(vehiclesTable.archivedAt),
					isNotNull(vehiclesTable.lastSeenAt),
				),
			)
			.orderBy(asc(vehiclesTable.id)),
	]);

	const sections: Record<SitemapSection, SitemapEntry[]> = {
		pages: [
			{ path: "/" },
			{ path: "/data" },
			{ path: "/attributions" },
			...regions.map(({ id }) => ({ path: `/data?region=${id}` })),
		],
		networks: networks.flatMap(({ id, hasVehiclesFeature }) =>
			hasVehiclesFeature
				? [{ path: `/data/networks/${id}` }, { path: `/data/networks/${id}?tab=lines` }]
				: [{ path: `/data/networks/${id}` }],
		),
		lines: Array.from(lines, ({ id, last_service_date }) => ({
			path: `/data/lines/${id}`,
			lastModified: last_service_date,
		})),
		vehicles: vehicles.map(({ id, lastSeenAt }) => ({
			path: `/data/vehicles/${id}`,
			lastModified: lastSeenAt?.toZonedDateTimeISO("UTC").toPlainDate().toString(),
		})),
	};

	sectionsCache.set("sections", sections);
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
