import { queryOptions } from "@tanstack/react-query";

import { client } from "./client.js";

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

export const GetLineQuery = (lineId: number) =>
	queryOptions({
		queryKey: ["lines", lineId],
		queryFn: () => client.get(`lines/${lineId}`).then((response) => response.json<Line>()),
	});
