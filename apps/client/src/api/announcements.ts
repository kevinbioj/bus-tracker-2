import { queryOptions } from "@tanstack/react-query";

import { client } from "~/api/client";

export type Announcement = {
	id: number;
	title: string;
	content: string | null;
	type: "INFO" | "OUTAGE";
	publishedAt: string | null;
	updatedAt: string;
	createdAt: string;
};

export const GetAnnouncementsQuery = queryOptions({
	queryKey: ["announcements"],
	queryFn: () => {
		const params = new URLSearchParams();
		if (import.meta.env.DEV) {
			params.append("includeUnpublished", "true");
		}
		return client.get(`announcements?${params}`).then((response) => response.json<Announcement[]>());
	},
});
