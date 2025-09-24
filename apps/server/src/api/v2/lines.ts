import { and, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";

import { database } from "../../core/database/database.js";
import {
	lineActivitiesTable,
	linesTable,
	networksTable,
	vehiclesTable,
	type LineEntity,
} from "../../core/database/schema.js";
import { journeyStore } from "../../core/store/journey-store.js";

import { byIdParamValidator } from "../common-validators.js";

const linesApp = new Hono();

const lineEntityToLineDto = (line: LineEntity) => ({
	id: line.id,
	number: line.number,
	order: line.sortOrder,
	cartridgeHref: line.cartridgeHref,
	colors: { foreground: line.textColor, background: line.color },
	girouette: { routeNumberText: line.girouetteNumber },
	archivedAt: line.archivedAt,
});

linesApp.get("/:id", byIdParamValidator, async (c) => {
	const { id } = c.req.valid("param");

	const [item] = await database
		.select()
		.from(linesTable)
		.innerJoin(networksTable, eq(networksTable.id, linesTable.networkId))
		.where(eq(linesTable.id, +id));

	if (typeof item === "undefined") {
		return c.json({ status: 404, code: "LINE_NOT_FOUND", message: `No line found with id '${id}'.` }, 404);
	}

	const line = lineEntityToLineDto(item.line);
	return c.json(line, 200);
});

linesApp.get("/:id/online-vehicles", async (c) => {
	const id = c.req.param("id");

	const [line] = await database.select().from(linesTable).where(eq(linesTable.id, +id));

	if (typeof line === "undefined") {
		return c.json({ status: 404, code: "LINE_NOT_FOUND", message: `No line found with id '${id}'.` }, 404);
	}

	const onlineVehicleIds = journeyStore
		.values()
		.flatMap((journey) =>
			journey.lineId === line.id && typeof journey.vehicle?.id !== "undefined" ? [journey.vehicle.id] : [],
		)
		.toArray();

	const vehicleList = await database.select().from(vehiclesTable).where(inArray(vehiclesTable.id, onlineVehicleIds));

	const sinceList = Map.groupBy(
		await database
			.select()
			.from(lineActivitiesTable)
			.where(and(inArray(lineActivitiesTable.vehicleId, onlineVehicleIds), eq(lineActivitiesTable.lineId, line.id)))
			.orderBy(desc(lineActivitiesTable.startedAt))
			.limit(vehicleList.length * 2),
		(activity) => activity.vehicleId,
	);

	return c.json(
		vehicleList.map((vehicle) => {
			const journey = journeyStore.values().find((journey) => journey.vehicle?.id === vehicle.id);
			const sinceData = sinceList.get(vehicle.id)?.[0];
			return {
				...vehicle,
				activity: {
					status: "online",
					since: sinceData?.startedAt,
					lineId: line.id,
					markerId: journey?.id,
					position: journey
						? {
								latitude: journey.position.latitude,
								longitude: journey.position.longitude,
							}
						: undefined,
				},
			};
		}),
	);
});

export default linesApp;
