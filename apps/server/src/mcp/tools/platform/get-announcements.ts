import { desc, isNotNull } from "drizzle-orm";
import * as z from "zod";

import { database } from "../../../core/database/database.js";
import { announcementsTable, announcementType } from "../../../core/database/schema.js";
import { defineTool } from "../../define-tool.js";
import { DEFAULT_TIMEZONE, toLocalTime } from "../../presenters/time.js";

const MAX_ANNOUNCEMENTS = 10;

export const getAnnouncementsTool = defineTool({
	name: "get_announcements",
	title: "Bus Tracker announcements",
	description:
		"Latest announcements published by the Bus Tracker team: new features and known outages of the service itself (e.g. a network whose data is currently unavailable). Check it when data looks missing.",
	icon: "info",
	input: z.object({}),
	output: z.object({
		announcements: z.array(
			z.object({
				title: z.string(),
				content: z.string().nullable(),
				type: z.enum(announcementType),
				publishedAt: z.string(),
			}),
		),
	}),
	handler: async () => {
		const announcements = await database
			.select()
			.from(announcementsTable)
			.where(isNotNull(announcementsTable.publishedAt))
			.orderBy(desc(announcementsTable.publishedAt))
			.limit(MAX_ANNOUNCEMENTS);

		return {
			announcements: announcements.flatMap((announcement) =>
				announcement.publishedAt !== null
					? [
							{
								title: announcement.title,
								content: announcement.content,
								type: announcement.type,
								publishedAt: toLocalTime(announcement.publishedAt, DEFAULT_TIMEZONE),
							},
						]
					: [],
			),
		};
	},
});
