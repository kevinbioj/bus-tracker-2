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
	refetchInterval: 120_000,
	queryKey: ["announcements"],
	queryFn: () =>
		client
			.get(`/announcements`, { searchParams: { includeUnpublished: import.meta.env.DEV ? "true" : undefined } })
			.then((response) => response.json<Announcement[]>()),
});
