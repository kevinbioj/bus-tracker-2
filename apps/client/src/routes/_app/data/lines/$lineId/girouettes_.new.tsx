import { createFileRoute } from "@tanstack/react-router";

import { GetLineGirouettesQuery } from "~/api/girouettes";
import { GetLineQuery } from "~/api/lines";
import { GetNetworkQuery } from "~/api/networks";
import { GirouetteFormPage } from "./-components/girouettes/girouette-form-page";

export const Route = createFileRoute("/_app/data/lines/$lineId/girouettes_/new")({
	component: NewGirouettePage,
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
	return <GirouetteFormPage lineId={+lineId} />;
}
