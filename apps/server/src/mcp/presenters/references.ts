import { vehicleJourneyLineTypes } from "@bus-tracker/contracts";
import * as z from "zod";

import type { LineLabel } from "../lookups/lines.js";
import type { NetworkSummary } from "../lookups/networks.js";
import { lineUrl, networkUrl } from "./links.js";

export const networkReferenceSchema = z.object({
	networkId: z.number(),
	name: z.string(),
	url: z.string(),
});

export const lineReferenceSchema = z.object({
	lineId: z.number(),
	number: z.string(),
	type: z.enum(vehicleJourneyLineTypes).nullable(),
	url: z.string(),
});

export const presentNetworkReference = (network: Pick<NetworkSummary, "id" | "name">) => ({
	networkId: network.id,
	name: network.name,
	url: networkUrl(network.id),
});

export const presentLineReference = (line: Pick<LineLabel, "id" | "number" | "type">) => ({
	lineId: line.id,
	number: line.number,
	type: line.type,
	url: lineUrl(line.id),
});
