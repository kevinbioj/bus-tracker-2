import { queryOptions } from "@tanstack/react-query";

import { client } from "./client";

export type Line = {
	id: number;
	networkId: number;
	references: string[];
	number: string;
	cartridgeHref: string;
	color: string;
	textColor: string;
	archivedAt: string;
};

export const GetLineQuery = (lineId?: number) =>
	queryOptions({
		enabled: typeof lineId !== "undefined",
		staleTime: 600_000,
		queryKey: ["lines", lineId],
		queryFn: () => client.get(`lines/${lineId}`).then((response) => response.json<Line>()),
	});
