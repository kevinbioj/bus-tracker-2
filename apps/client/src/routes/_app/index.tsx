import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { Canonical } from "~/components/seo";
import { VehiclesMap } from "~/components/vehicles-map/vehicles-map";
import * as m from "~/paraglide/messages";

const searchSchema = z.object({
	"line-id": z.coerce.number().optional(),
	"network-id": z.coerce.number().optional(),
	"marker-id": z.string().optional(),
	from_old: z.string().optional(),
});

export const Route = createFileRoute("/_app/")({
	component: MapPage,
	validateSearch: searchSchema,
});

function MapPage() {
	return (
		<>
			<title>{m.page_title_map()}</title>
			<meta content={m.page_description_map()} name="description" />
			<Canonical path="/" />
			<style>{` body { background-color: var(--color-branding); } `}</style>
			<main>
				<h1 className="sr-only">{m.map_page_heading()}</h1>
				<VehiclesMap className="h-[calc(100dvh-56px)]" />
			</main>
		</>
	);
}
