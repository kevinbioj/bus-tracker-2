import { and, desc, eq, inArray } from "drizzle-orm";
import * as z from "zod";

import { createParamValidator } from "../api/validator-helpers.js";
import { database } from "../core/database/database.js";
import { lineActivitiesTable, linesTable, vehiclesTable } from "../core/database/schema.js";
import { journeyStore } from "../core/store/journey-store.js";

import { hono } from "../server.js";

const getLineByIdParamSchema = z.object({
	id: z.coerce.number().min(0),
});

hono.get("/lines/:id", createParamValidator(getLineByIdParamSchema), async (c) => {
	const { id } = c.req.valid("param");

	const [line] = await database.select().from(linesTable).where(eq(linesTable.id, id));
	if (typeof line === "undefined") return c.json({ error: `No line found with id '${id}'.` }, 404);

	return c.json(line);
});

hono.get("/lines/:id/online-vehicles", createParamValidator(getLineByIdParamSchema), async (c) => {
	const { id } = c.req.valid("param");

	const [line] = await database.select().from(linesTable).where(eq(linesTable.id, id));
	if (typeof line === "undefined") return c.json({ error: `No line found with id '${id}'.` }, 404);

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
