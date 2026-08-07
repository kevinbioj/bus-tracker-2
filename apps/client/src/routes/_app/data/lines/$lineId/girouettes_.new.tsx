import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { GetLineGirouettesQuery } from "~/api/girouettes";
import { GetLineQuery } from "~/api/lines";
import { GetNetworkQuery } from "~/api/networks";
import { GirouetteFormPage } from "./-components/girouettes/girouette-form-page";

const searchSchema = z.object({
	/** Identifier of the girouette to copy the appearance from. */
	duplicateFrom: z.coerce.number().int().optional(),
});

export const Route = createFileRoute("/_app/data/lines/$lineId/girouettes_/new")({
	component: NewGirouettePage,
	validateSearch: searchSchema,
	loader: async ({ context: { queryClient }, params: { lineId } }) => {
		const line = await queryClient.ensureQueryData(GetLineQuery(+lineId));
		await Promise.all([
			queryClient.ensureQueryData(GetNetworkQuery(line.networkId, true)),
			queryClient.ensureQueryData(GetLineGirouettesQuery(+lineId)),
		]);
	},
});

function NewGirouettePage() {
	const { lineId } = Route.useParams();
	const { duplicateFrom } = Route.useSearch();
	return <GirouetteFormPage lineId={+lineId} duplicateFromId={duplicateFrom} />;
}
