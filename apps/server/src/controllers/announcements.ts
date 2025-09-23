import { and, desc, isNotNull } from "drizzle-orm";
import { z } from "zod";

import { createQueryValidator } from "../api/validator-helpers.js";
import { database } from "../core/database/database.js";
import { announcementsTable } from "../core/database/schema.js";

import { hono } from "../server.js";

const getAnnouncementsQuerySchema = z.object({
	includeUnpublished: z.coerce.boolean().optional(),
});

hono.get("/announcements", createQueryValidator(getAnnouncementsQuerySchema), async (c) => {
	const { includeUnpublished } = c.req.valid("query");

	const announcementList = await database
		.select()
		.from(announcementsTable)
		.where(includeUnpublished ? and() : isNotNull(announcementsTable.publishedAt))
		.orderBy(desc(announcementsTable.publishedAt));

	return c.json(announcementList);
});
