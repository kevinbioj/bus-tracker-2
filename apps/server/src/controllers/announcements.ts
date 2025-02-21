import { and, desc, isNotNull } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";

import { database } from "../database/database.js";
import { announcements } from "../database/schema.js";
import { createQueryValidator } from "../helpers/validator-helpers.js";

const getAnnouncementsQuerySchema = z.object({
	includeUnpublished: z.coerce.boolean().optional(),
});

export const registerAnnouncementRoutes = (hono: Hono) => {
	hono.get("/announcements", createQueryValidator(getAnnouncementsQuerySchema), async (c) => {
		const { includeUnpublished } = c.req.valid("query");

		const announcementList = await database
			.select()
			.from(announcements)
			.where(includeUnpublished ? and() : isNotNull(announcements.publishedAt))
			.orderBy(desc(announcements.publishedAt));

		return c.json(announcementList);
	});
};
