import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";

import EmbeddableMapPage from "./-embeddable-map-page";

export const Route = createFileRoute("/embed/$networkId")({
	component: () => (
		<Suspense>
			<EmbeddableMapPage />
		</Suspense>
	),
});
