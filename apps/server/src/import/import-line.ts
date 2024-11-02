import { and, eq, gte, isNull, or } from "drizzle-orm";

import type { VehicleJourneyLine } from "@bus-tracker/contracts";

import { database } from "../database/database.js";
import { lines } from "../database/schema.js";

import type { Temporal } from "temporal-polyfill";
import { importNetwork } from "./import-network.js";

export async function importLine(networkRef: string, lineData: VehicleJourneyLine, recordedAt: Temporal.Instant) {
	const network = await importNetwork(networkRef);
	let [line] = await database
		.select()
		.from(lines)
		.where(
			and(
				eq(lines.networkId, network.id),
				eq(lines.ref, lineData.ref),
				or(isNull(lines.archivedAt), gte(lines.archivedAt, recordedAt)),
			),
		);
	if (typeof line === "undefined") {
		line = (
			await database
				.insert(lines)
				.values({
					networkId: network.id,
					ref: lineData.ref,
					number: lineData.number,
					color: lineData.color,
					textColor: lineData.textColor,
				})
				.returning()
		).at(0)!;
	}
	return line;
}
