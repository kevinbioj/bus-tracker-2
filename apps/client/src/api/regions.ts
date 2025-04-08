import { queryOptions } from "@tanstack/react-query";

import { client } from "~/api/client";

export type Region = {
	id: number;
	name: string;
	sortOrder: number;
};

export const GetRegionsQuery = queryOptions({
	queryKey: ["regions"],
	queryFn: () => client.get("regions").then((response) => response.json<Region[]>()),
	staleTime: 300_000,
});
