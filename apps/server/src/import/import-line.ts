import type { VehicleJourneyLine } from "@bus-tracker/contracts";
import { and, arrayContains, eq, gte, isNull, or } from "drizzle-orm";
import type { Temporal } from "temporal-polyfill";

import { database } from "../database/database.js";
import { type Network, lines } from "../database/schema.js";

export async function importLine(network: Network, lineData: VehicleJourneyLine, recordedAt: Temporal.Instant) {
	let [line] = await database
		.select()
		.from(lines)
		.where(
			and(
				eq(lines.networkId, network.id),
				arrayContains(lines.references, [lineData.ref]),
				or(isNull(lines.archivedAt), gte(lines.archivedAt, recordedAt)),
			),
		);
	if (typeof line === "undefined") {
		line = (
			await database
				.insert(lines)
				.values({
					networkId: network.id,
					references: [lineData.ref],
					number: lineData.number,
					color: lineData.color,
					textColor: lineData.textColor,
				})
				.returning()
		).at(0)!;
	}
	return line;
}
