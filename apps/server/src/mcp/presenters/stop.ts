import { stopAreaModes } from "@bus-tracker/contracts";
import * as z from "zod";

import { compareLineNumbers, lineNumbersOfRefs } from "../lookups/lines.js";
import { networkNames } from "../lookups/networks.js";

export const stopSummarySchema = z.object({
	stopRef: z.string(),
	name: z.string(),
	mode: z.enum(stopAreaModes),
	latitude: z.number(),
	longitude: z.number(),
	networks: z.array(z.string()),
	lines: z.array(z.string()),
	distanceMeters: z.number().optional(),
});

type StopLike = {
	ref: string;
	name: string;
	latitude: number;
	longitude: number;
	mode?: (typeof stopAreaModes)[number];
	networkIds: number[];
	lineRefs: string[];
};

export async function presentStops(
	stops: (StopLike & { distanceMeters?: number })[],
): Promise<z.input<typeof stopSummarySchema>[]> {
	const lines = await lineNumbersOfRefs(stops.flatMap((stop) => stop.lineRefs));

	return Promise.all(
		stops.map(async (stop) => ({
			stopRef: stop.ref,
			name: stop.name,
			mode: stop.mode ?? "BUS",
			latitude: stop.latitude,
			longitude: stop.longitude,
			networks: await networkNames(stop.networkIds),
			lines: [...new Set(stop.lineRefs.flatMap((lineRef) => lines.get(lineRef)?.number ?? []))].toSorted(
				compareLineNumbers,
			),
			distanceMeters: stop.distanceMeters !== undefined ? Math.round(stop.distanceMeters) : undefined,
		})),
	);
}
