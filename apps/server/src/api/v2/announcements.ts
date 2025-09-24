import { and, desc, eq, gte, isNotNull } from "drizzle-orm";
import { Hono } from "hono";
import { Temporal } from "temporal-polyfill";
import { z } from "zod";

import { database } from "../../core/database/database.js";
import { announcementsTable, announcementType, type AnnouncementEntity } from "../../core/database/schema.js";

import { authMiddleware } from "../auth-middleware.js";
import { byIdParamValidator } from "../common-validators.js";
import { createJsonValidator } from "../validator-helpers.js";

const announcementsApp = new Hono();

const announcementEntityToAnnouncementDto = (announcement: AnnouncementEntity) => ({
	id: announcement.id,
	title: announcement.title,
	content: announcement.content,
	type: announcement.type,
	publishedAt: announcement.publishedAt,
	updatedAt: announcement.updatedAt,
	createdAt: announcement.createdAt,
});

announcementsApp.get("/", async (c) => {
	const data = await database
		.select()
		.from(announcementsTable)
		.where(and(isNotNull(announcementsTable.publishedAt), gte(announcementsTable.publishedAt, Temporal.Now.instant())))
		.orderBy(desc(announcementsTable.publishedAt));

	const announcements = data.map(announcementEntityToAnnouncementDto);
	return c.json(announcements, 200);
});

announcementsApp.get("/:id", byIdParamValidator, async (c) => {
	const { id } = c.req.valid("param");

	const [item] = await database.select().from(announcementsTable).where(eq(announcementsTable.id, +id));

	if (typeof item === "undefined") {
		return c.json(
			{ status: 404, code: "ANNOUNCEMENT_NOT_FOUND", message: `No announcement found with id '${id}'.` },
			404,
		);
	}

	const announcement = announcementEntityToAnnouncementDto(item);
	return c.json(announcement, 200);
});

announcementsApp.post(
	"/",
	authMiddleware({ role: "ADMIN" }),
	createJsonValidator(
		z.object({
			title: z
				.string({ error: "Title must be a valid string." })
				.min(8, { error: "Title length must be at least 8 characters." })
				.max(64, { error: "Title length must be at most 64 characters." }),
			content: z.string({ error: "Title must be a valid string." }).nullable(),
			type: z.enum(announcementType, { error: `Announcement type must be one of: ${announcementType.join(", ")}.` }),
			publishedAt: z.iso
				.datetime({ error: "Published at date must be a valid ISO datetime." })
				.nullable()
				.transform((value) => (value ? Temporal.Instant.from(value) : null)),
		}),
	),
	async (c) => {
		const fields = c.req.valid("json");

		const [item] = await database.insert(announcementsTable).values(fields).returning();

		if (typeof item === "undefined") {
			return c.json({ status: 500, code: "INTERNAL_ERROR", message: "An internal error occurred." }, 500);
		}

		const announcement = announcementEntityToAnnouncementDto(item);
		return c.json(announcement, 201, { Location: `/announcements/${announcement.id}` });
	},
);

announcementsApp.put(
	"/:id",
	authMiddleware({ role: "ADMIN" }),
	byIdParamValidator,
	createJsonValidator(
		z.object({
			title: z
				.string({ error: "Title must be a valid string." })
				.min(8, { error: "Title length must be at least 8 characters." })
				.max(64, { error: "Title length must be at most 64 characters." }),
			content: z.string({ error: "Title must be a valid string." }).nullable(),
			type: z.enum(announcementType, { error: `Announcement type must be one of: ${announcementType.join(", ")}.` }),
			publishedAt: z.iso
				.datetime({ error: "Published at date must be a valid ISO datetime." })
				.nullable()
				.transform((value) => (value ? Temporal.Instant.from(value) : null)),
		}),
	),
	async (c) => {
		const { id } = c.req.valid("param");
		const fields = c.req.valid("json");

		const [item] = await database
			.update(announcementsTable)
			.set(fields)
			.where(eq(announcementsTable.id, +id))
			.returning();

		if (typeof item === "undefined") {
			return c.json(
				{ status: 404, code: "ANNOUNCEMENT_NOT_FOUND", message: `No announcement found with id '${id}'.` },
				404,
			);
		}

		const announcement = announcementEntityToAnnouncementDto(item);
		return c.json(announcement, 200);
	},
);

announcementsApp.delete("/:id", authMiddleware({ role: "ADMIN" }), byIdParamValidator, async (c) => {
	const { id } = c.req.valid("param");

	const [item] = await database.delete(announcementsTable).where(eq(announcementsTable.id, +id)).returning();

	if (typeof item === "undefined") {
		return c.json(
			{ status: 404, code: "ANNOUNCEMENT_NOT_FOUND", message: `No announcement found with id '${id}'.` },
			404,
		);
	}

	return c.body(null, 204);
});

export default announcementsApp;
