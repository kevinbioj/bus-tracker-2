import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import MapPage from "~/pages/map";

const searchSchema = z.object({
	"line-id": z.coerce.number().optional(),
	"marker-id": z.string().optional(),
	from_old: z.string().optional(),
});

export const Route = createFileRoute("/_app/")({
	component: MapPage,
	validateSearch: searchSchema,
});
