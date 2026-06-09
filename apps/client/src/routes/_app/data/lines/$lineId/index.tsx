import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { GetLineQuery, GetLineVehicleAssignmentsQuery } from "~/api/lines";
import { GetNetworkQuery } from "~/api/networks";
import { LinePage } from "./-line-page";
import { getLineVehicleAssignmentsDate } from "./-vehicle-assignments-date";

const searchSchema = z.object({
	date: z.string().optional(),
});

export const Route = createFileRoute("/_app/data/lines/$lineId/")({
	component: LinePage,
	validateSearch: searchSchema,
	loaderDeps: ({ search: { date } }) => ({ date }),
	loader: async ({ context: { queryClient }, params: { lineId }, deps: { date } }) => {
		const line = await queryClient.ensureQueryData(GetLineQuery(+lineId));
		const effectiveDate = getLineVehicleAssignmentsDate(line, date);
		await Promise.all([
			queryClient.ensureQueryData(GetNetworkQuery(line.networkId, true)),
			queryClient.ensureQueryData(GetLineVehicleAssignmentsQuery(+lineId, effectiveDate)),
		]);
	},
});
